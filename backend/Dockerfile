# python:3.13-slim en vez de la imagen completa: mismo glibc que necesitan
# las wheels precompiladas de psycopg2-binary, sin el peso de herramientas
# de build que no se usan en runtime. Esta misma base servira mas adelante
# para el servicio Django.
FROM python:3.13-slim

WORKDIR /app

# Sin esto, stdout queda bufferizado al no haber TTY y "docker logs" /
# journalctl no muestran nada hasta que el buffer se llena.
ENV PYTHONUNBUFFERED=1

RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config.py db_creator.py telemetry-worker.py ./

USER app

CMD ["python", "telemetry-worker.py"]
