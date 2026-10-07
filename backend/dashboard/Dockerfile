# Misma base que backend/Dockerfile (telemetry-worker): python:3.13-slim
# trae el glibc que piden las wheels precompiladas de psycopg2-binary, sin
# el peso de herramientas de build que no se usan en runtime.
FROM python:3.13-slim

WORKDIR /app

# Sin esto, stdout queda bufferizado al no haber TTY y "docker logs" /
# journalctl no muestran nada hasta que el buffer se llena.
ENV PYTHONUNBUFFERED=1

# --create-home (no --no-create-home): gunicorn escribe en $HOME en
# runtime (socket de control) y sin un /home/app real eso tiraba
# "Permission denied" en Render.
RUN groupadd --system app && useradd --system --gid app --create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh && chown -R app:app /app

USER app

EXPOSE 8000

CMD ["./entrypoint.sh"]
