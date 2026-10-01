import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .models import NodeReading

NODE_IDS = ["nodo-a", "nodo-b"]


def _parse_fecha(raw):
    if raw:
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


def _parse_hora(raw, default):
    if raw:
        try:
            return datetime.strptime(raw, "%H:%M").time()
        except ValueError:
            pass
    return default


def _to_epoch_ms(naive_dt):
    # reading_time es un TIMESTAMP naive con la hora local de Guatemala ya
    # calculada (ver tiemporeal/models.py y telemetry-worker.py). Tratamos ese
    # valor naive como si fuera UTC (sin conversion real de zona horaria) para
    # que ApexCharts, configurado con datetimeUTC=true, muestre exactamente
    # la misma hora de pared que quedo guardada, sin un doble corrimiento.
    return int(naive_dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _series_promedio(readings, field):
    # Nodo A y Nodo B publican cada uno por su cuenta (mismo periodo de
    # ~60s, ver READ_PERIOD_MS en firmware/ESP32/main/ESP32.c) pero sin
    # relojes sincronizados entre si, asi que sus timestamps no coinciden
    # exactamente. Se agrupan por minuto para poder promediar ambos nodos
    # en cada punto; los minutos en los que solo reporto un nodo se omiten
    # (no hay nada que promediar).
    buckets = defaultdict(dict)
    for r in readings:
        key = r["reading_time"].replace(second=0, microsecond=0)
        buckets[key][r["node_id"]] = r[field]

    series = []
    for key in sorted(buckets):
        values = buckets[key]
        if len(values) < len(NODE_IDS):
            continue
        series.append([_to_epoch_ms(key), round(sum(values.values()) / len(values), 1)])
    return series


def _stats(values):
    if not values:
        return {"promedio": None, "maximo": None, "minimo": None, "mediana": None, "muestras": 0}
    return {
        "promedio": round(sum(values) / len(values), 1),
        "maximo": round(max(values), 1),
        "minimo": round(min(values), 1),
        "mediana": round(statistics.median(values), 1),
        "muestras": len(values),
    }


def _stat_rows(stats_a, stats_b, unit):
    return [
        {"label": "Promedio", "icon": "bi-bullseye", "a": stats_a["promedio"], "b": stats_b["promedio"], "unit": unit},
        {"label": "Maximo", "icon": "bi-arrow-up-circle", "a": stats_a["maximo"], "b": stats_b["maximo"], "unit": unit},
        {"label": "Minimo", "icon": "bi-arrow-down-circle", "a": stats_a["minimo"], "b": stats_b["minimo"], "unit": unit},
        {"label": "Mediana", "icon": "bi-distribute-vertical", "a": stats_a["mediana"], "b": stats_b["mediana"], "unit": unit},
        {"label": "Muestras", "icon": "bi-collection", "a": stats_a["muestras"], "b": stats_b["muestras"], "unit": ""},
    ]


def tiemporeal(request):
    selected_date = _parse_fecha(request.GET.get("fecha"))

    # Vista de stream: hora_fin siempre es "ahora" (no es seleccionable por
    # el usuario, ni editable via querystring). hora_inicio si lo es, y por
    # defecto arranca una hora atras. Nota: si "ahora" cae en la primera
    # hora del dia, "ahora - 1h" cae en el dia anterior pero igual se
    # combina con selected_date (hoy), asi que el rango no cruza medianoche
    # correctamente en ese caso puntual.
    ahora = datetime.now()
    hora_inicio = _parse_hora(request.GET.get("hora_inicio"), (ahora - timedelta(hours=1)).time())
    hora_fin = ahora.time()
    if hora_inicio > hora_fin:
        hora_inicio = hora_fin

    # El rango de horas filtra dentro del dia seleccionado; se incluye el
    # minuto completo de hora_fin (ej. "23:59" cubre hasta 23:59:59.999999).
    range_start = datetime.combine(selected_date, hora_inicio)
    range_end = datetime.combine(selected_date, hora_fin) + timedelta(minutes=1, microseconds=-1)

    readings = list(
        NodeReading.objects.filter(
            reading_time__gte=range_start,
            reading_time__lte=range_end,
            node_id__in=NODE_IDS,
        )
        .order_by("reading_time")
        .values("node_id", "temperature", "humidity", "reading_time")
    )
    # Postgres guarda temperature/humidity como NUMERIC, asi que psycopg2 los
    # entrega como Decimal; sin este cast, json_script los serializa como
    # string ("26.03") en vez de numero, y ApexCharts no puede graficarlos.
    for r in readings:
        r["temperature"] = float(r["temperature"])
        r["humidity"] = float(r["humidity"])

    by_node = {node_id: [r for r in readings if r["node_id"] == node_id] for node_id in NODE_IDS}

    temp_series_a = [[_to_epoch_ms(r["reading_time"]), r["temperature"]] for r in by_node["nodo-a"]]
    temp_series_b = [[_to_epoch_ms(r["reading_time"]), r["temperature"]] for r in by_node["nodo-b"]]
    hum_series_a = [[_to_epoch_ms(r["reading_time"]), r["humidity"]] for r in by_node["nodo-a"]]
    hum_series_b = [[_to_epoch_ms(r["reading_time"]), r["humidity"]] for r in by_node["nodo-b"]]
    temp_series_avg = _series_promedio(readings, "temperature")
    hum_series_avg = _series_promedio(readings, "humidity")

    all_times = [r["reading_time"] for r in readings]
    if all_times:
        x_min = _to_epoch_ms(min(all_times))
        x_max = _to_epoch_ms(max(all_times))
        if x_min == x_max:
            # Un solo dato ese dia: se le da un pequeno margen para que el
            # eje de tiempo no quede con ancho cero.
            x_min -= 5 * 60 * 1000
            x_max += 5 * 60 * 1000
    else:
        x_min = x_max = None

    temps_a = [r["temperature"] for r in by_node["nodo-a"]]
    temps_b = [r["temperature"] for r in by_node["nodo-b"]]
    hums_a = [r["humidity"] for r in by_node["nodo-a"]]
    hums_b = [r["humidity"] for r in by_node["nodo-b"]]

    temp_stats_all = _stats(temps_a + temps_b)
    temp_stats_a = _stats(temps_a)
    temp_stats_b = _stats(temps_b)
    hum_stats_all = _stats(hums_a + hums_b)
    hum_stats_a = _stats(hums_a)
    hum_stats_b = _stats(hums_b)

    context = {
        "selected_hora_inicio": hora_inicio.strftime("%H:%M"),
        "selected_hora_display": f"{hora_inicio.strftime('%H:%M')} - Ahora",
        "temp_min": 18,
        "temp_max": 30,
        "temp_avg": temp_stats_all["promedio"],
        "temp_avg_a": temp_stats_a["promedio"],
        "temp_avg_b": temp_stats_b["promedio"],
        "hum_min": 30,
        "hum_max": 80,
        "hum_avg": hum_stats_all["promedio"],
        "hum_avg_a": hum_stats_a["promedio"],
        "hum_avg_b": hum_stats_b["promedio"],
        "temp_stat_rows": _stat_rows(temp_stats_a, temp_stats_b, "°C"),
        "hum_stat_rows": _stat_rows(hum_stats_a, hum_stats_b, "%"),
        "tiemporeal_chart_data": {
            "tempSeriesA": temp_series_a,
            "tempSeriesB": temp_series_b,
            "tempSeriesAvg": temp_series_avg,
            "humSeriesA": hum_series_a,
            "humSeriesB": hum_series_b,
            "humSeriesAvg": hum_series_avg,
            "xMin": x_min,
            "xMax": x_max,
        },
    }
    return render(request, "tiemporeal.html", context)


def _parse_since(raw):
    # "since" es un epoch-ms ya ajustado por _to_epoch_ms (lo manda el
    # cliente de vuelta tal cual se lo dimos). Se convierte a la hora naive
    # equivalente para poder comparar contra reading_time; es el inverso
    # exacto de _to_epoch_ms.
    try:
        since_ms = int(raw)
    except (TypeError, ValueError):
        since_ms = 0
    if since_ms <= 0:
        return datetime.min
    return datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).replace(tzinfo=None)


@require_GET
def tiemporeal_latest(request):
    """Lecturas nuevas desde la ultima vez que el cliente pregunto.

    Endpoint de polling para el stream en vivo de Datos en Tiempo Real: el
    navegador llama esto cada pocos segundos en vez de abrir una conexion
    MQTT propia, asi ninguna credencial de broker llega al cliente.
    """
    since = _parse_since(request.GET.get("since"))
    # Nunca se consulta mas atras del inicio del dia de hoy, incluso si
    # "since" viene vacio o corrupto: evita un escaneo sin limite de la tabla.
    today_start = datetime.combine(date.today(), datetime.min.time())
    effective_since = max(since, today_start)

    readings = list(
        NodeReading.objects.filter(
            reading_time__gt=effective_since,
            node_id__in=NODE_IDS,
        )
        .order_by("reading_time")
        .values("node_id", "temperature", "humidity", "reading_time")
    )
    for r in readings:
        r["temperature"] = float(r["temperature"])
        r["humidity"] = float(r["humidity"])

    by_node = {node_id: [r for r in readings if r["node_id"] == node_id] for node_id in NODE_IDS}

    all_times = [r["reading_time"] for r in readings]
    last_epoch_ms = _to_epoch_ms(max(all_times)) if all_times else None

    return JsonResponse({
        "tempSeriesA": [[_to_epoch_ms(r["reading_time"]), r["temperature"]] for r in by_node["nodo-a"]],
        "tempSeriesB": [[_to_epoch_ms(r["reading_time"]), r["temperature"]] for r in by_node["nodo-b"]],
        "humSeriesA": [[_to_epoch_ms(r["reading_time"]), r["humidity"]] for r in by_node["nodo-a"]],
        "humSeriesB": [[_to_epoch_ms(r["reading_time"]), r["humidity"]] for r in by_node["nodo-b"]],
        "lastEpochMs": last_epoch_ms,
    })
