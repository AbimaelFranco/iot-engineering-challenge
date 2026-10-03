"""
Script de mantenimiento de esquema: crea (si no existen) las tablas de
PostgreSQL usadas por el proyecto.

Las columnas de hora son TIMESTAMP *sin* zona horaria (no TIMESTAMPTZ) y
guardan directamente la hora local de Guatemala, calculada de forma
explicita con "AT TIME ZONE" en cada DEFAULT/expresion. Esto es a
proposito: depender de "SET TIME ZONE" por sesion resulto ser poco
confiable en produccion (conexiones de larga duracion, y probablemente
un connection pooler en Render que no respeta el SET entre transacciones)
- con columnas TIMESTAMP planas, el valor guardado se ve igual sin
importar que herramienta o sesion lo consulte, porque no hay conversion
que depender.

Esquema alineado con el arbol de topics documentado en
Documentation/README.md (iot-challenge/telemetria|status|cmd/...).

No se ejecuta automaticamente desde telemetry-worker.py: se corre a mano,
una vez, cuando hace falta crear o actualizar el esquema.

Uso:
    python db_creator.py
"""

import psycopg2

from config import DB_TIMEZONE, require_database_url

_NOW_LOCAL = f"(now() AT TIME ZONE '{DB_TIMEZONE}')"

# ---- mqtt_log: tabla maestra con el log crudo de todos los mensajes MQTT ----
# logged_at: TIMESTAMP(0) sin zona horaria, hora local de Guatemala, sin
# milisegundos (segundo de precision).
CREATE_MQTT_LOG_SQL = f"""
CREATE TABLE IF NOT EXISTS mqtt_log (
    id           BIGSERIAL PRIMARY KEY,
    topic        TEXT NOT NULL,
    qos          SMALLINT NOT NULL,
    payload_raw  TEXT NOT NULL,
    payload_json JSONB,
    logged_at    TIMESTAMP(0) NOT NULL DEFAULT {_NOW_LOCAL}
);
"""

# ---- node_status_log: historial online/offline por nodo -----------------
# Topic: status/<node_id> (QoS 1, retained, LWT). node_id se extrae del
# topic al insertar; event_ts es el campo "ts" del payload del nodo.
CREATE_NODE_STATUS_LOG_SQL = f"""
CREATE TABLE IF NOT EXISTS node_status_log (
    id           BIGSERIAL PRIMARY KEY,
    node_id      TEXT NOT NULL,
    state        TEXT NOT NULL,
    event_ts     TIMESTAMP(0),
    topic        TEXT NOT NULL,
    payload_raw  TEXT NOT NULL,
    received_at  TIMESTAMP(0) NOT NULL DEFAULT {_NOW_LOCAL}
);
CREATE INDEX IF NOT EXISTS idx_node_status_log_node_received
    ON node_status_log (node_id, received_at DESC);
"""

# ---- node_commands: comando enviado + su ack, correlacionados por id ----
# Topic comando: cmd/<node_id> o cmd/all (plataforma -> nodo).
# Topic ack:     cmd/<node_id>/ack (nodo -> plataforma), mismo "id".
# Una fila por comando: se inserta al enviarlo y se actualiza (ack_*)
# cuando llega su confirmacion, distinguiendo "enviado" de "confirmado"
# sin necesitar dos tablas separadas.
CREATE_NODE_COMMANDS_SQL = f"""
CREATE TABLE IF NOT EXISTS node_commands (
    id            TEXT PRIMARY KEY,
    node_id       TEXT NOT NULL,
    action        TEXT NOT NULL,
    value         JSONB,
    sent_topic    TEXT NOT NULL,
    sent_payload  TEXT NOT NULL,
    sent_at       TIMESTAMP(0) NOT NULL DEFAULT {_NOW_LOCAL},
    ack_status    TEXT,
    ack_applied   JSONB,
    ack_reason    TEXT,
    ack_topic     TEXT,
    ack_payload   TEXT,
    acked_at      TIMESTAMP(0)
);
CREATE INDEX IF NOT EXISTS idx_node_commands_node_sent
    ON node_commands (node_id, sent_at DESC);
"""

# ---- node_readings: lecturas de sensor "limpias" (sin log crudo) --------
# Topic: telemetria/<node_id>. Solo lo que hace falta para graficar/leer:
# nodo, temperatura, humedad (3 decimales) y hora de la lectura (la del
# propio nodo, campo "ts" del payload; segundo de precision).
CREATE_NODE_READINGS_SQL = """
CREATE TABLE IF NOT EXISTS node_readings (
    id            BIGSERIAL PRIMARY KEY,
    node_id       TEXT NOT NULL,
    temperature   NUMERIC(6,3),
    humidity      NUMERIC(6,3),
    reading_time  TIMESTAMP(0) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_node_readings_node_time
    ON node_readings (node_id, reading_time DESC);
"""

# ---- node_config_log: historial de parametros de alerta/alarmas enviados ----
# Topic: config/<node_id> (plataforma -> nodo, QoS 1, retained). A diferencia
# de node_commands (llenada por telemetry-worker.py al VER el mensaje pasar
# por el broker), esta tabla la llena directamente la vista de Configuracion
# del dashboard (backend/dashboard/configuracion/views.py) en el mismo
# request que publica el mensaje retained, porque el dashboard es aqui el
# publicador, no un suscriptor.
CREATE_NODE_CONFIG_LOG_SQL = f"""
CREATE TABLE IF NOT EXISTS node_config_log (
    id                    BIGSERIAL PRIMARY KEY,
    node_id               TEXT NOT NULL,
    temp_min              NUMERIC(6,2) NOT NULL,
    temp_max              NUMERIC(6,2) NOT NULL,
    hum_min               NUMERIC(6,2) NOT NULL,
    hum_max               NUMERIC(6,2) NOT NULL,
    buzzer_enabled        BOOLEAN NOT NULL,
    visual_alarm_enabled  BOOLEAN NOT NULL,
    topic                 TEXT NOT NULL,
    payload_raw           TEXT NOT NULL,
    sent_at               TIMESTAMP(0) NOT NULL DEFAULT {_NOW_LOCAL}
);
CREATE INDEX IF NOT EXISTS idx_node_config_log_node_sent
    ON node_config_log (node_id, sent_at DESC);
"""

# Agregar aqui futuras tablas segun se vayan necesitando, cada una en su
# propia constante CREATE_..._SQL.

TABLES = [
    ("mqtt_log", CREATE_MQTT_LOG_SQL),
    ("node_status_log", CREATE_NODE_STATUS_LOG_SQL),
    ("node_commands", CREATE_NODE_COMMANDS_SQL),
    ("node_readings", CREATE_NODE_READINGS_SQL),
    ("node_config_log", CREATE_NODE_CONFIG_LOG_SQL),
]

# Migraciones sobre tablas/columnas que ya pudieron existir de una version
# anterior del esquema (CREATE TABLE IF NOT EXISTS no las alcanza).
# Seguras de re-ejecutar. El "USING columna AT TIME ZONE '...'" en las
# conversiones TIMESTAMPTZ -> TIMESTAMP reinterpreta cada valor ya
# guardado a su hora local de Guatemala correcta (el instante guardado
# siempre fue el correcto; lo que fallaba era solo como se mostraba), asi
# que esta migracion tambien corrige los datos historicos, no solo el
# tipo de columna.
MIGRATIONS = [
    (
        "mqtt_log.logged_at -> TIMESTAMP(0) hora local",
        f"ALTER TABLE mqtt_log ALTER COLUMN logged_at TYPE TIMESTAMP(0) "
        f"USING (logged_at AT TIME ZONE '{DB_TIMEZONE}');",
    ),
    (
        "node_status_log.event_ts/received_at -> TIMESTAMP(0) hora local",
        f"ALTER TABLE node_status_log "
        f"ALTER COLUMN event_ts TYPE TIMESTAMP(0) USING (event_ts AT TIME ZONE '{DB_TIMEZONE}'), "
        f"ALTER COLUMN received_at TYPE TIMESTAMP(0) USING (received_at AT TIME ZONE '{DB_TIMEZONE}');",
    ),
    (
        "node_commands.sent_at/acked_at -> TIMESTAMP(0) hora local",
        f"ALTER TABLE node_commands "
        f"ALTER COLUMN sent_at TYPE TIMESTAMP(0) USING (sent_at AT TIME ZONE '{DB_TIMEZONE}'), "
        f"ALTER COLUMN acked_at TYPE TIMESTAMP(0) USING (acked_at AT TIME ZONE '{DB_TIMEZONE}');",
    ),
    (
        "node_readings.reading_time -> TIMESTAMP(0) hora local",
        f"ALTER TABLE node_readings "
        f"ALTER COLUMN reading_time TYPE TIMESTAMP(0) USING (reading_time AT TIME ZONE '{DB_TIMEZONE}');",
    ),
    (
        "node_readings.temperature/humidity -> NUMERIC(6,3)",
        "ALTER TABLE node_readings "
        "ALTER COLUMN temperature TYPE NUMERIC(6,3), "
        "ALTER COLUMN humidity TYPE NUMERIC(6,3);",
    ),
]


def set_database_timezone(cur):
    """Default de conveniencia para quien consulte con 'now()'/TIMESTAMPTZ
    a mano (p.ej. psql). Ya no es necesario para la correctitud de las
    columnas propias de la app (son TIMESTAMP planas, ver arriba)."""
    cur.execute("SELECT current_database();")
    dbname = cur.fetchone()[0]
    try:
        cur.execute(f'ALTER DATABASE "{dbname}" SET timezone TO \'{DB_TIMEZONE}\';')
        print(f"[OK] Timezone de la base de datos '{dbname}' -> {DB_TIMEZONE}")
    except psycopg2.Error as e:
        print(f"[WARN] No se pudo configurar el timezone de la base de datos: {e}")


def main():
    db_url = require_database_url()
    conn = psycopg2.connect(db_url, sslmode="require")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            set_database_timezone(cur)
            for name, sql in TABLES:
                cur.execute(sql)
                print(f"[OK] Tabla '{name}' lista")
            for description, sql in MIGRATIONS:
                cur.execute(sql)
                print(f"[OK] Migracion aplicada: {description}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
