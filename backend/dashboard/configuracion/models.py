from django.db import models

# "Valores de fabrica" del firmware (ver tambien configuracion/views.py).
# Se usan mientras ningun operador haya publicado todavia una configuracion
# propia para un nodo (node_config_log vacia para ese node_id).
DEFAULT_CONFIG = {
    "temp_min": 18.0,
    "temp_max": 30.0,
    "hum_min": 30.0,
    "hum_max": 80.0,
    "buzzer_enabled": True,
    "visual_alarm_enabled": True,
    "fan_enabled": False,
    "fan_manual_enabled": False,
}


class NodeConfigLog(models.Model):
    """Historial de parametros de alerta/alarmas publicados por nodo.

    Topic: config/<node_id> (plataforma -> nodo, QoS 1, retained - ver
    Documentation/README.md). A diferencia de NodeStatus (tiemporeal/models.py),
    que llena backend/telemetry-worker.py al SUSCRIBIRSE al broker, esta tabla
    la llena directamente la vista de esta app en el mismo request que
    publica el mensaje retained (ver mqtt_publish.py): el dashboard es aqui
    el publicador, no un suscriptor.

    Tabla creada y administrada por backend/db_creator.py, no por Django
    (managed = False).
    """

    node_id = models.CharField(max_length=50)
    temp_min = models.FloatField()
    temp_max = models.FloatField()
    hum_min = models.FloatField()
    hum_max = models.FloatField()
    buzzer_enabled = models.BooleanField()
    visual_alarm_enabled = models.BooleanField()
    # Dos formas de activar el ventilador, independientes entre si (ver
    # evaluate_alarm_thresholds() en firmware/ESP32/main/mqtt/mqtt_telemetry.c):
    # fan_enabled lo arma para que reaccione a temp_min/temp_max/hum_min/hum_max
    # igual que buzzer/LED; fan_manual_enabled lo fuerza encendido sin
    # importar la lectura y tiene mas peso que fan_enabled.
    fan_enabled = models.BooleanField()
    fan_manual_enabled = models.BooleanField()
    topic = models.TextField()
    payload_raw = models.TextField()
    sent_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "node_config_log"

    @classmethod
    def latest_thresholds(cls, node_id="nodo-a"):
        """Ultimos umbrales de alerta (temp/hum min/max) publicados para
        node_id, o DEFAULT_CONFIG si todavia no se publico ninguno.

        Usado por historico/views.py y tiemporeal/views.py para que la
        linea de alerta de sus graficas refleje lo que de verdad se publico
        desde Configuracion, en vez de un valor fijo en el codigo. Los dos
        nodos pueden en teoria tener configuraciones distintas (el topic es
        config/<node_id>, no uno compartido), pero esas vistas grafican un
        unico par de lineas para ambos nodos a la vez: se usa nodo-a como
        referencia, que es consistente con que "Ambos nodos" (la opcion por
        defecto en Configuracion) mantenga a los dos sincronizados.
        """
        row = (
            cls.objects.filter(node_id=node_id)
            .order_by("-sent_at")
            .values("temp_min", "temp_max", "hum_min", "hum_max")
            .first()
        )
        if not row:
            return {k: DEFAULT_CONFIG[k] for k in ("temp_min", "temp_max", "hum_min", "hum_max")}
        return {
            "temp_min": float(row["temp_min"]),
            "temp_max": float(row["temp_max"]),
            "hum_min": float(row["hum_min"]),
            "hum_max": float(row["hum_max"]),
        }


class MqttLog(models.Model):
    """Log crudo de todo mensaje MQTT, llenado por backend/telemetry-worker.py
    sin importar el topic (tabla maestra, ver comentario al inicio de ese
    archivo). Aqui se usa puntualmente para leer los acks de
    config/<node_id>/ack (ver views.py, configuracion_ack_latest): como ese
    topic no tiene todavia una tabla especializada propia, es mas simple
    leerlo del log generico que agregar una columna/tabla nueva solo para
    esto.

    Tabla creada y administrada por backend/db_creator.py, no por Django
    (managed = False).
    """

    topic = models.TextField()
    qos = models.SmallIntegerField()
    payload_raw = models.TextField()
    payload_json = models.JSONField(null=True)
    logged_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "mqtt_log"
