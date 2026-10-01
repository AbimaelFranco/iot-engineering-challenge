"""
Suscriptor MQTT que guarda en PostgreSQL (Render) un historial/log de los
mensajes recibidos del broker.

Todo mensaje se guarda primero en 'mqtt_log' (log crudo, generico, tabla
maestra). Ademas, si el topic sigue el arbol documentado en
Documentation/README.md, el mensaje tambien se enruta a una tabla
especializada:
    status/<node_id>       -> node_status_log (historial online/offline)
    cmd/<node_id>           -> node_commands (comando enviado)
    cmd/<node_id>/ack       -> node_commands (actualiza el ack por id)
El enrutado es "best effort": si falla o el payload no trae los campos
esperados, el mensaje ya quedo a salvo en mqtt_log de todas formas.

Las tablas deben existir de antemano (ver db_creator.py). Las columnas de
hora son TIMESTAMP *sin* zona horaria con la hora local de Guatemala ya
calculada (ver GUATEMALA_TZ mas abajo) - no dependen del timezone de la
sesion de PostgreSQL, que resulto no ser confiable en produccion.

Configuracion (via .env, ver .env.example): MQTT_HOST, MQTT_PORT,
MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC, MQTT_CLIENT_ID, DATABASE_URL.

Uso:
    python telemetry-worker.py
    python telemetry-worker.py --topic "esp32/#"

Incluye un servidor HTTP minimo (GET / -> 200 OK) en el puerto de la
variable PORT. Es solo para que Render lo pueda desplegar como Web
Service (plan gratuito) en vez de Background Worker (de pago): Render
exige que el proceso haga bind a $PORT. No tiene ninguna otra funcion;
el trabajo real sigue siendo el loop de MQTT.
"""

import argparse
import json
import os
import ssl
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
import psycopg2

import config

# Zona horaria unica de la app (ver config.DB_TIMEZONE). Todas las horas
# que este script guarda son TIMESTAMP *sin* zona horaria, ya convertidas
# a esta hora local explicitamente en Python o en el propio SQL (ver
# db_creator.py) - no dependen del timezone de la sesion de PostgreSQL,
# que resulto ser poco confiable en Render (conexion de larga duracion /
# posible connection pooler que no respeta SET TIME ZONE entre queries).
GUATEMALA_TZ = ZoneInfo(config.DB_TIMEZONE)

INSERT_MQTT_LOG_SQL = """
INSERT INTO mqtt_log (topic, qos, payload_raw, payload_json)
VALUES (%s, %s, %s, %s);
"""

INSERT_STATUS_SQL = """
INSERT INTO node_status_log (node_id, state, event_ts, topic, payload_raw)
VALUES (%s, %s, %s, %s, %s);
"""

INSERT_READING_SQL = """
INSERT INTO node_readings (node_id, temperature, humidity, reading_time)
VALUES (%s, %s, %s, %s);
"""

INSERT_COMMAND_SQL = """
INSERT INTO node_commands (id, node_id, action, value, sent_topic, sent_payload, sent_at)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (id) DO UPDATE SET
    node_id = EXCLUDED.node_id,
    action = EXCLUDED.action,
    value = EXCLUDED.value,
    sent_topic = EXCLUDED.sent_topic,
    sent_payload = EXCLUDED.sent_payload,
    sent_at = EXCLUDED.sent_at;
"""

UPDATE_COMMAND_ACK_SQL = """
UPDATE node_commands
SET ack_status = %s,
    ack_applied = %s,
    ack_reason = %s,
    ack_topic = %s,
    ack_payload = %s,
    acked_at = %s
WHERE id = %s;
"""


def parse_topic(topic):
    """Ubica un topic dentro del arbol iot-challenge/{telemetria,status,cmd}/... .

    Devuelve (categoria, node_id, es_ack). categoria es None si el topic
    no coincide con ninguna categoria conocida.
    """
    parts = topic.split("/")
    if "telemetria" in parts:
        idx = parts.index("telemetria")
        node_id = parts[idx + 1] if len(parts) > idx + 1 else None
        return "telemetria", node_id, False
    if "status" in parts:
        idx = parts.index("status")
        node_id = parts[idx + 1] if len(parts) > idx + 1 else None
        return "status", node_id, False
    if "cmd" in parts:
        idx = parts.index("cmd")
        node_id = parts[idx + 1] if len(parts) > idx + 1 else None
        is_ack = len(parts) > idx + 2 and parts[idx + 2] == "ack"
        return "cmd", node_id, is_ack
    return None, None, False


def _epoch_to_local_naive(ts):
    """Convierte un epoch Unix (siempre UTC por definicion) a la hora
    local de Guatemala, como datetime "naive" (sin tzinfo) listo para
    guardar en una columna TIMESTAMP sin zona horaria."""
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(float(ts), tz=GUATEMALA_TZ).replace(tzinfo=None)
    except (TypeError, ValueError, OSError):
        return None


def _now_local_naive():
    return datetime.now(GUATEMALA_TZ).replace(tzinfo=None)

# Colores ANSI para distinguir el tipo de evento de un vistazo en los logs
# (Render, Docker y la mayoria de terminales los interpretan bien).
_RESET = "\033[0m"
_GREEN = "\033[32m"
_RED = "\033[31m"
_YELLOW = "\033[33m"
_CYAN = "\033[36m"


def _timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log_ok(msg):
    print(f"{_GREEN}[OK]{_RESET}    {_timestamp()} {msg}")


def log_warn(msg):
    print(f"{_YELLOW}[WARN]{_RESET}  {_timestamp()} {msg}")


def log_error(msg):
    print(f"{_RED}[ERROR]{_RESET} {_timestamp()} {msg}")


def log_info(msg):
    print(f"{_CYAN}[INFO]{_RESET}  {_timestamp()} {msg}")


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        pass  # evita que cada ping de health check ensucie el log de MQTT


def start_health_server():
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log_ok(f"Health check HTTP escuchando en :{port}")


def parse_args():
    p = argparse.ArgumentParser(description="Guarda un log de mensajes MQTT en PostgreSQL")
    p.add_argument("--host", default=config.MQTT_HOST, help="Host del broker MQTT")
    p.add_argument("--port", type=int, default=config.MQTT_PORT, help="Puerto MQTT (8883 = TLS)")
    p.add_argument("--user", default=config.MQTT_USERNAME, help="Usuario MQTT")
    p.add_argument("--password", default=config.MQTT_PASSWORD, help="Contrasena MQTT")
    p.add_argument("--topic", default=config.MQTT_TOPIC, help="Filtro de topic (por defecto '#' = todos)")
    p.add_argument("--client-id", default=config.MQTT_CLIENT_ID, help="Client ID MQTT de este logger")
    p.add_argument("--no-tls", action="store_true", help="Desactiva TLS en la conexion MQTT")
    p.add_argument("--db-url", default=config.DATABASE_URL, help="URL de conexion a PostgreSQL")
    return p.parse_args()


def connect_db(db_url: str):
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL no esta definida. Copia .env.example a .env y completa los valores."
        )
    conn = psycopg2.connect(db_url, sslmode="require")
    conn.autocommit = True
    log_ok("Conectado a PostgreSQL")
    return conn


def try_parse_json(raw: bytes):
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None, None
    try:
        return text, json.loads(text)
    except json.JSONDecodeError:
        return text, None


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log_ok(f"Conectado a MQTT {userdata['host']}:{userdata['port']}")
        client.subscribe(userdata["topic"], qos=1)
        log_info(f"Solicitada suscripcion a '{userdata['topic']}', esperando SUBACK...")
    else:
        log_error(f"Fallo de conexion MQTT, codigo: {reason_code}")


def on_disconnect(client, userdata, *args):
    log_warn("Desconectado del broker MQTT")


def on_subscribe(client, userdata, mid, reason_codes, properties=None):
    # reason_code >= 128 significa que el broker denego la suscripcion
    # (p.ej. el usuario MQTT no tiene permiso de "Subscribe" sobre el topic).
    codes = [rc.value if hasattr(rc, "value") else rc for rc in reason_codes]
    if any(c >= 128 for c in codes):
        log_error(f"Suscripcion a '{userdata['topic']}' RECHAZADA por el broker, codigos: {codes}")
    else:
        log_ok(f"Suscrito a '{userdata['topic']}', codigos: {codes}")


def _save_status(conn, msg, node_id, data, raw_text):
    state = data.get("state")
    if not node_id or state is None:
        log_warn(f"Mensaje de status en '{msg.topic}' sin node_id o 'state', no se guarda en node_status_log")
        return
    event_ts = _epoch_to_local_naive(data.get("ts"))
    with conn.cursor() as cur:
        cur.execute(INSERT_STATUS_SQL, (node_id, state, event_ts, msg.topic, raw_text))
    log_ok(f"Estado registrado | node_id={node_id} state={state}")


def _save_command_sent(conn, msg, node_id, data, raw_text):
    cmd_id = data.get("id")
    action = data.get("action")
    if not node_id or cmd_id is None or action is None:
        log_warn(f"Comando en '{msg.topic}' sin node_id, 'id' o 'action', no se guarda en node_commands")
        return
    value = data.get("value")
    with conn.cursor() as cur:
        cur.execute(
            INSERT_COMMAND_SQL,
            (
                cmd_id,
                node_id,
                action,
                json.dumps(value) if value is not None else None,
                msg.topic,
                raw_text,
                _now_local_naive(),
            ),
        )
    log_ok(f"Comando registrado | id={cmd_id} node_id={node_id} action={action}")


def _save_command_ack(conn, msg, data, raw_text):
    cmd_id = data.get("id")
    status = data.get("status")
    if cmd_id is None or status is None:
        log_warn(f"Ack en '{msg.topic}' sin 'id' o 'status', no se guarda en node_commands")
        return
    applied = data.get("applied")
    reason = data.get("reason")
    with conn.cursor() as cur:
        cur.execute(
            UPDATE_COMMAND_ACK_SQL,
            (
                status,
                json.dumps(applied) if applied is not None else None,
                reason,
                msg.topic,
                raw_text,
                _now_local_naive(),
                cmd_id,
            ),
        )
        if cur.rowcount == 0:
            log_warn(f"Ack de comando '{cmd_id}' no corresponde a ningun registro en node_commands")
            return
    log_ok(f"Ack aplicado | id={cmd_id} status={status}")


def _save_reading(conn, msg, node_id, data, raw_text):
    temp = data.get("temp")
    hum = data.get("hum")
    if not node_id or temp is None or hum is None:
        log_warn(f"Telemetria en '{msg.topic}' sin node_id, 'temp' o 'hum', no se guarda en node_readings")
        return
    reading_time = _epoch_to_local_naive(data.get("ts")) or _now_local_naive()
    with conn.cursor() as cur:
        cur.execute(INSERT_READING_SQL, (node_id, temp, hum, reading_time))
    log_ok(f"Lectura registrada | node_id={node_id} temp={temp} hum={hum}")


def make_on_message(conn):
    def on_message(client, userdata, msg):
        raw_text, data = try_parse_json(msg.payload)
        if raw_text is None:
            raw_text = repr(msg.payload)

        try:
            with conn.cursor() as cur:
                cur.execute(
                    INSERT_MQTT_LOG_SQL,
                    (
                        msg.topic,
                        msg.qos,
                        raw_text,
                        json.dumps(data) if data is not None else None,
                    ),
                )
            log_ok(f"Guardado en DB | topic={msg.topic} qos={msg.qos} payload={raw_text}")
        except Exception as e:
            log_error(f"No se pudo guardar el mensaje de '{msg.topic}' en mqtt_log: {e}")
            return

        if data is None:
            return

        category, node_id, is_ack = parse_topic(msg.topic)
        try:
            if category == "telemetria":
                _save_reading(conn, msg, node_id, data, raw_text)
            elif category == "status":
                _save_status(conn, msg, node_id, data, raw_text)
            elif category == "cmd" and is_ack:
                _save_command_ack(conn, msg, data, raw_text)
            elif category == "cmd":
                _save_command_sent(conn, msg, node_id, data, raw_text)
        except Exception as e:
            log_error(f"No se pudo enrutar '{msg.topic}' a su tabla especializada: {e}")

    return on_message


def main():
    # Fuerza salida sin buffer: si no, en plataformas como Render (sin
    # PYTHONUNBUFFERED, sin TTY) los print() no aparecen en los logs hasta
    # que el buffer se llena, dando la falsa impresion de que no pasa nada.
    sys.stdout.reconfigure(line_buffering=True)

    args = parse_args()

    start_health_server()

    conn = connect_db(args.db_url)

    client = mqtt.Client(
        client_id=args.client_id,
        userdata={"host": args.host, "port": args.port, "topic": args.topic},
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )
    client.username_pw_set(args.user, args.password)

    if not args.no_tls:
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_subscribe = on_subscribe
    client.on_message = make_on_message(conn)

    log_info(f"Conectando a MQTT {args.host}:{args.port} (TLS={'no' if args.no_tls else 'si'})...")
    try:
        client.connect(args.host, args.port, keepalive=60)
    except Exception as e:
        log_error(f"No se pudo conectar al broker MQTT: {e}")
        sys.exit(1)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        log_warn("Saliendo...")
        client.disconnect()
        conn.close()


if __name__ == "__main__":
    main()
