#!/bin/sh
# collectstatic y migrate corren aqui (en el arranque del contenedor) y no
# en el build de la imagen, porque config/settings.py exige
# DJANGO_SECRET_KEY/DATABASE_URL ya definidas, y esas solo existen como
# variables de entorno en runtime (Render las inyecta al levantar el
# servicio, no durante el build de la imagen).
set -e

python manage.py collectstatic --noinput
python manage.py migrate --noinput

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
