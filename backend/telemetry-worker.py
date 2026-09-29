"""
Suscriptor MQTT que guarda en PostgreSQL (Render) un historial/log de los
mensajes recibidos del broker.

Esta tabla es un log generico (no especifico del sensor AHT10): no guarda
temperatura/humedad, solo el mensaje crudo con su hora exacta. Si luego se
quiere analizar el JSON del sensor, se puede leer desde payload_json.

La tabla 'mqtt_log' debe existir de antemano (ver db_creator.py).

Configuracion (via .env, ver .env.example): MQTT_HOST, MQTT_PORT,
MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC, MQTT_CLIENT_ID, DATABASE_URL.

Uso:
    python telemetry-worker.py
    python telemetry-worker.py --topic "esp32/#"
"""

import argparse
import json
import ssl
import sys
from datetime import datetime

import paho.mqtt.client as mqtt
import psycopg2

import config

INSERT_SQL = """
INSERT INTO mqtt_log (topic, qos, payload_raw, payload_json)
VALUES (%s, %s, %s, %s);
"""


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
    print("[OK] Conectado a PostgreSQL")
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
        print(f"[OK] Conectado a MQTT {userdata['host']}:{userdata['port']}")
        client.subscribe(userdata["topic"], qos=1)
        print(f"[OK] Suscrito a '{userdata['topic']}'\n")
    else:
        print(f"[ERROR] Fallo de conexion MQTT, codigo: {reason_code}")


def on_disconnect(client, userdata, *args):
    print("[WARN] Desconectado del broker MQTT")


def make_on_message(conn):
    def on_message(client, userdata, msg):
        raw_text, data = try_parse_json(msg.payload)
        if raw_text is None:
            raw_text = repr(msg.payload)

        try:
            with conn.cursor() as cur:
                cur.execute(
                    INSERT_SQL,
                    (
                        msg.topic,
                        msg.qos,
                        raw_text,
                        json.dumps(data) if data is not None else None,
                    ),
                )
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{ts}] topic={msg.topic} qos={msg.qos} payload={raw_text}")
        except Exception as e:
            print(f"[ERROR] No se pudo guardar el mensaje de '{msg.topic}': {e}")

    return on_message


def main():
    args = parse_args()

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
    client.on_message = make_on_message(conn)

    print(f"Conectando a MQTT {args.host}:{args.port} (TLS={'no' if args.no_tls else 'si'})...")
    try:
        client.connect(args.host, args.port, keepalive=60)
    except Exception as e:
        print(f"[ERROR] No se pudo conectar al broker MQTT: {e}")
        sys.exit(1)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nSaliendo...")
        client.disconnect()
        conn.close()


if __name__ == "__main__":
    main()
