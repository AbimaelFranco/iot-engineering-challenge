"""
Script de mantenimiento de esquema: crea (si no existen) las tablas de
PostgreSQL usadas por el proyecto.

No se ejecuta automaticamente desde mqtt_to_postgres.py: se corre a mano,
una vez, cuando hace falta crear o actualizar el esquema.

Uso:
    python db_creator.py
"""

import psycopg2

from config import require_database_url

# ---- mqtt_log: tabla maestra con el log crudo de todos los mensajes MQTT ----
CREATE_MQTT_LOG_SQL = """
CREATE TABLE IF NOT EXISTS mqtt_log (
    id           BIGSERIAL PRIMARY KEY,
    topic        TEXT NOT NULL,
    qos          SMALLINT NOT NULL,
    payload_raw  TEXT NOT NULL,
    payload_json JSONB,
    logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

# Agregar aqui futuras tablas (p.ej. telemetria normalizada por nodo) segun
# se vayan necesitando, cada una en su propia constante CREATE_..._SQL.

TABLES = [
    ("mqtt_log", CREATE_MQTT_LOG_SQL),
]


def main():
    db_url = require_database_url()
    conn = psycopg2.connect(db_url, sslmode="require")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for name, sql in TABLES:
                cur.execute(sql)
                print(f"[OK] Tabla '{name}' lista")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
