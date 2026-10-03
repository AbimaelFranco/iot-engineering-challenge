import json
from datetime import datetime

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .models import DEFAULT_CONFIG, NodeConfigLog
from .mqtt_publish import MqttPublishError, publish_node_config

NODE_IDS = ["nodo-a", "nodo-b"]

# Rango fisico del sensor AHT10 (ver Documentation/Datasheet/AHT10.PDF):
# limites fuera de este rango no tienen sentido como umbral de alerta.
TEMP_PHYSICAL_RANGE = (-40.0, 85.0)
HUM_PHYSICAL_RANGE = (0.0, 100.0)


def _latest_config_by_node():
    """Ultima configuracion publicada por nodo (tabla node_config_log,
    llenada por esta misma vista al publicar - ver _actualizar mas abajo).
    Si un nodo nunca recibio una configuracion propia, se usan los valores
    de fabrica (DEFAULT_CONFIG).
    """
    config = {}
    for node_id in NODE_IDS:
        row = (
            NodeConfigLog.objects.filter(node_id=node_id)
            .order_by("-sent_at")
            .values(
                "temp_min", "temp_max", "hum_min", "hum_max",
                "buzzer_enabled", "visual_alarm_enabled", "sent_at",
            )
            .first()
        )
        if row:
            # Postgres guarda estas columnas como NUMERIC, asi que psycopg2 las
            # entrega como Decimal; sin este cast, json_script las serializa
            # como string ("17.50") en vez de numero (ver mismo comentario en
            # historico/views.py y tiemporeal/views.py).
            config[node_id] = {
                "temp_min": float(row["temp_min"]),
                "temp_max": float(row["temp_max"]),
                "hum_min": float(row["hum_min"]),
                "hum_max": float(row["hum_max"]),
                "buzzer_enabled": row["buzzer_enabled"],
                "visual_alarm_enabled": row["visual_alarm_enabled"],
                "sent_at": row["sent_at"].strftime("%Y-%m-%d %H:%M:%S"),
                "is_default": False,
            }
        else:
            config[node_id] = {**DEFAULT_CONFIG, "sent_at": None, "is_default": True}
    return config


def configuracion(request):
    return render(request, "configuracion.html", {
        "node_config": _latest_config_by_node(),
    })


def _parse_config_payload(data):
    """Valida el payload JSON recibido del formulario. Devuelve
    ((config_dict, target_node_ids), error_msg); el primer elemento es None
    si error_msg no es None (y viceversa).
    """
    node_target = data.get("node_target")
    if node_target not in ("nodo-a", "nodo-b", "ambos"):
        return None, "node_target invalido."

    try:
        temp_min = float(data["temp_min"])
        temp_max = float(data["temp_max"])
        hum_min = float(data["hum_min"])
        hum_max = float(data["hum_max"])
    except (KeyError, TypeError, ValueError):
        return None, "Los limites de temperatura/humedad deben ser numericos."

    buzzer_enabled = bool(data.get("buzzer_enabled"))
    visual_alarm_enabled = bool(data.get("visual_alarm_enabled"))

    t_lo, t_hi = TEMP_PHYSICAL_RANGE
    h_lo, h_hi = HUM_PHYSICAL_RANGE
    if not (t_lo <= temp_min < temp_max <= t_hi):
        return None, f"Temperatura: minima < maxima, ambas entre {t_lo:.0f} y {t_hi:.0f} C."
    if not (h_lo <= hum_min < hum_max <= h_hi):
        return None, f"Humedad: minima < maxima, ambas entre {h_lo:.0f}% y {h_hi:.0f}%."

    config = {
        "temp_min": temp_min,
        "temp_max": temp_max,
        "hum_min": hum_min,
        "hum_max": hum_max,
        "buzzer_enabled": buzzer_enabled,
        "visual_alarm_enabled": visual_alarm_enabled,
    }
    targets = NODE_IDS if node_target == "ambos" else [node_target]
    return (config, targets), None


@require_POST
def configuracion_actualizar(request):
    """Publica la configuracion recibida (retained + QoS1, ver
    configuracion/mqtt_publish.py) en config/<node_id> para cada nodo
    objetivo, y deja constancia en node_config_log.

    "Segunda confirmacion" (el cuadro de dialogo antes de enviar) vive del
    lado del cliente (ver configuracion.html / dashboard.js); este endpoint
    asume que, si llego aqui, el usuario ya confirmo.
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "JSON invalido."}, status=400)

    parsed, error = _parse_config_payload(data)
    if error:
        return JsonResponse({"ok": False, "error": error}, status=400)
    config, targets = parsed

    results = []
    for node_id in targets:
        try:
            topic, payload_raw = publish_node_config(node_id, config)
        except MqttPublishError as exc:
            return JsonResponse({"ok": False, "error": str(exc), "results": results}, status=502)

        sent_at = datetime.now()
        NodeConfigLog.objects.create(
            node_id=node_id,
            topic=topic,
            payload_raw=payload_raw,
            sent_at=sent_at,
            **config,
        )
        results.append({
            "node_id": node_id,
            "topic": topic,
            "sent_at": sent_at.strftime("%Y-%m-%d %H:%M:%S"),
        })

    return JsonResponse({"ok": True, "results": results})
