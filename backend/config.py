"""
Carga la configuracion (MQTT + PostgreSQL) desde variables de entorno / .env.

Compartido por telemetry-worker.py y db_creator.py para no duplicar credenciales.
"""

import os

from dotenv import load_dotenv

load_dotenv()

MQTT_HOST = os.environ.get("MQTT_HOST", "")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "8883"))
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "#")
MQTT_CLIENT_ID = os.environ.get("MQTT_CLIENT_ID", "postgres_logger")

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def require_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL no esta definida. Copia .env.example a .env y completa los valores."
        )
    return DATABASE_URL
