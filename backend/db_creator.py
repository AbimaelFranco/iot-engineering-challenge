"""
Script de mantenimiento de esquema: crea (si no existen) las tablas de
PostgreSQL usadas por el proyecto, y configura el timezone de la base de
datos a America/Guatemala para que las columnas TIMESTAMPTZ se muestren
en hora local sin conversion manual (el valor almacenado sigue siendo un
instante UTC sin ambiguedad; el timezone solo afecta como se despliega).

Esquema alineado con el arbol de topics documentado en
Documentation/README.md (iot-challenge/telemetria|status|cmd/...).

No se ejecuta automaticamente desde telemetry-worker.py: se corre a mano,
una vez, cuando hace falta crear o actualizar el esquema.

Uso:
    python db_creator.py
"""

import psycopg2

from config import DB_TIMEZONE, require_database_url

# ---- mqtt_log: tabla maestra con el log crudo de todos los mensajes MQTT ----
# logged_at es TIMESTAMPTZ(0): no hace falta precision de milisegundos, solo
# fecha hora:minuto:segundo.
CREATE_MQTT_LOG_SQL = """
CREATE TABLE IF NOT EXISTS mqtt_log (
    id           BIGSERIAL PRIMARY KEY,
    topic        TEXT NOT NULL,
    qos          SMALLINT NOT NULL,
    payload_raw  TEXT NOT NULL,
    payload_json JSONB,
    logged_at    TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
"""

# ---- node_status_log: historial online/offline por nodo -----------------
# Topic: status/<node_id> (QoS 1, retained, LWT). node_id se extrae del
# topic al insertar; event_ts es el campo "ts" del payload del nodo.
CREATE_NODE_STATUS_LOG_SQL = """
CREATE TABLE IF NOT EXISTS node_status_log (
    id           BIGSERIAL PRIMARY KEY,
    node_id      TEXT NOT NULL,
    state        TEXT NOT NULL,
    event_ts     TIMESTAMPTZ,
    topic        TEXT NOT NULL,
    payload_raw  TEXT NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE_NODE_COMMANDS_SQL = """
CREATE TABLE IF NOT EXISTS node_commands (
    id            TEXT PRIMARY KEY,
    node_id       TEXT NOT NULL,
    action        TEXT NOT NULL,
    value         JSONB,
    sent_topic    TEXT NOT NULL,
    sent_payload  TEXT NOT NULL,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ack_status    TEXT,
    ack_applied   JSONB,
    ack_reason    TEXT,
    ack_topic     TEXT,
    ack_payload   TEXT,
    acked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_node_commands_node_sent
    ON node_commands (node_id, sent_at DESC);
"""

# Agregar aqui futuras tablas segun se vayan necesitando, cada una en su
# propia constante CREATE_..._SQL.

TABLES = [
    ("mqtt_log", CREATE_MQTT_LOG_SQL),
    ("node_status_log", CREATE_NODE_STATUS_LOG_SQL),
    ("node_commands", CREATE_NODE_COMMANDS_SQL),
]

# Migraciones sobre tablas que ya pudieron existir de una version anterior
# del esquema (CREATE TABLE IF NOT EXISTS no las alcanza). Seguras de
# re-ejecutar: no fallan ni pierden datos si ya estan aplicadas.
MIGRATIONS = [
    (
        "mqtt_log.logged_at -> TIMESTAMPTZ(0)",
        "ALTER TABLE mqtt_log ALTER COLUMN logged_at TYPE TIMESTAMPTZ(0);",
    ),
]


def set_database_timezone(cur):
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
            # El ALTER DATABASE de arriba solo afecta conexiones nuevas
            # futuras; se fuerza tambien en esta sesion para que quede
            # consistente desde ya.
            cur.execute(f"SET TIME ZONE '{DB_TIMEZONE}';")
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
