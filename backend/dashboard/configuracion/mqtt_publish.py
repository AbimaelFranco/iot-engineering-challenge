"""Publicador MQTT de la vista de Configuracion.

A diferencia del resto del dashboard (que solo LEE de Postgres, llenado por
backend/telemetry-worker.py al suscribirse al broker - ver tiemporeal/views.py),
esta vista necesita PUBLICAR: los parametros de alerta/alarmas que el
usuario define en la interfaz se envian directo al broker HiveMQ, al topic
retained config/<node_id> documentado en Documentation/README.md.

No se usa paho.mqtt.publish.single()/multiple(): esos helpers corren
client.loop_forever() internamente, que con reconexion automatica reintenta
sin limite si el broker nunca manda PUBACK (por ejemplo, si rechaza el
publish por permisos y simplemente cierra la conexion sin avisar, que es
el comportamiento tipico de HiveMQ ante un ACL denegado en MQTT 3.1.1) -
eso colgaria indefinidamente el request de Django. Aqui se maneja el
cliente a mano con limites de tiempo explicitos en cada paso.
"""

import json
import ssl
import time

import paho.mqtt.client as mqtt
from django.conf import settings

TOPIC_PREFIX = "iot-challenge/config"

CONNECT_TIMEOUT_S = 8
PUBLISH_ACK_TIMEOUT_S = 8


class MqttPublishError(Exception):
    """El mensaje no se pudo publicar en el broker MQTT."""


def publish_node_config(node_id: str, config: dict) -> tuple[str, str]:
    """Publica `config` (ya validado por el caller) retained + QoS 1.

    Devuelve (topic, payload_raw) para que el caller pueda auditar en
    node_config_log exactamente lo que se envio (ver views.py). Lanza
    MqttPublishError si no se pudo conectar o si el broker no confirmo
    la publicacion (PUBACK) dentro de PUBLISH_ACK_TIMEOUT_S.
    """
    if not settings.MQTT_HOST:
        raise MqttPublishError(
            "MQTT_HOST no esta configurado (ver backend/dashboard/.env.example)."
        )

    topic = f"{TOPIC_PREFIX}/{node_id}"
    payload = dict(config)
    payload["ts"] = int(time.time())
    payload_raw = json.dumps(payload)

    # reconnect_on_failure=False: una sola conexion, un solo intento. Si se
    # cae, se reporta como error en vez de reintentar en loop sin limite.
    client = mqtt.Client(
        client_id=settings.MQTT_CLIENT_ID,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        reconnect_on_failure=False,
    )
    client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
    client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)

    try:
        client.connect(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=CONNECT_TIMEOUT_S)
    except Exception as exc:
        raise MqttPublishError(f"No se pudo conectar al broker MQTT: {exc}") from exc

    client.loop_start()
    try:
        info = client.publish(topic, payload=payload_raw, qos=1, retain=True)
        info.wait_for_publish(timeout=PUBLISH_ACK_TIMEOUT_S)
        if not info.is_published():
            raise MqttPublishError(
                f"El broker no confirmo la publicacion en '{topic}' (sin PUBACK tras "
                f"{PUBLISH_ACK_TIMEOUT_S}s). Revisa que las credenciales MQTT "
                f"(MQTT_USERNAME) tengan permiso de Publish sobre "
                f"'{TOPIC_PREFIX}/#' en HiveMQ Cloud."
            )
    finally:
        client.loop_stop()
        client.disconnect()

    return topic, payload_raw
