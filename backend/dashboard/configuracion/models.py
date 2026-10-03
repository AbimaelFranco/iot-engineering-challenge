from django.db import models


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
    topic = models.TextField()
    payload_raw = models.TextField()
    sent_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "node_config_log"
