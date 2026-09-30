from django.db import models


class NodeReading(models.Model):
    """Lecturas de temperatura/humedad guardadas por backend/telemetry-worker.py.

    Tabla creada y administrada por backend/db_creator.py, no por Django
    (managed = False): Django solo lee, nunca crea/migra esta tabla.
    """

    node_id = models.CharField(max_length=50)
    temperature = models.FloatField()
    humidity = models.FloatField()
    reading_time = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "node_readings"
