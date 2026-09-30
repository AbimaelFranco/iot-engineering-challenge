from datetime import date, datetime, timezone

from django.shortcuts import render

from .models import NodeReading

NODE_IDS = ["nodo-a", "nodo-b"]

MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _parse_fecha(raw):
    if raw:
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


def _to_epoch_ms(naive_dt):
    # reading_time es un TIMESTAMP naive con la hora local de Guatemala ya
    # calculada (ver historico/models.py y telemetry-worker.py). Tratamos ese
    # valor naive como si fuera UTC (sin conversion real de zona horaria) para
    # que ApexCharts, configurado con datetimeUTC=true, muestre exactamente
    # la misma hora de pared que quedo guardada, sin un doble corrimiento.
    return int(naive_dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _avg(values):
    return round(sum(values) / len(values), 1) if values else None


def historico(request):
    selected_date = _parse_fecha(request.GET.get("fecha"))

    readings = list(
        NodeReading.objects.filter(
            reading_time__date=selected_date,
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

    temp_avg_a = _avg(temps_a)
    temp_avg_b = _avg(temps_b)
    hum_avg_a = _avg(hums_a)
    hum_avg_b = _avg(hums_b)

    context = {
        "selected_date": selected_date.strftime("%Y-%m-%d"),
        "selected_date_display": f"{selected_date.day} de {MESES_ES[selected_date.month - 1]} de {selected_date.year}",
        "temp_min": 18,
        "temp_max": 30,
        "temp_avg": _avg(temps_a + temps_b),
        "temp_avg_a": temp_avg_a,
        "temp_avg_b": temp_avg_b,
        "hum_min": 30,
        "hum_max": 70,
        "hum_avg": _avg(hums_a + hums_b),
        "hum_avg_a": hum_avg_a,
        "hum_avg_b": hum_avg_b,
        "historico_chart_data": {
            "tempSeriesA": temp_series_a,
            "tempSeriesB": temp_series_b,
            "humSeriesA": hum_series_a,
            "humSeriesB": hum_series_b,
            "xMin": x_min,
            "xMax": x_max,
        },
    }
    return render(request, "historico.html", context)
