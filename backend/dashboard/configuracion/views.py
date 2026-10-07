import json
from datetime import datetime, timezone
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .models import DEFAULT_CONFIG, MqttLog, NodeConfigLog
from .mqtt_publish import MqttPublishError, publish_node_config

NODE_IDS = ["nodo-a", "nodo-b"]


def staff_required(view_func):
    """Exige sesion iniciada (redirige a login, igual que login_required)
    y ademas staff status: Configuracion publica por MQTT hacia los nodos
    (ver mqtt_publish.py), asi que un usuario sin privilegios de staff no
    debe poder verla ni modificarla.
    """
    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        if not request.user.is_staff:
            raise PermissionDenied
        return view_func(request, *args, **kwargs)
    return wrapper

# Topics de confirmacion (ver Documentation/README.md, config/.../ack).
# telemetry-worker.py ya los guarda en mqtt_log sin ningun cambio de su
# parte (es el log crudo/generico, ver MqttLog); no hace falta una tabla
# especializada para leerlos desde aqui.
ACK_TOPICS = [f"iot-challenge/config/{node_id}/ack" for node_id in NODE_IDS]

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
                "buzzer_enabled", "visual_alarm_enabled", "fan_enabled",
                "fan_manual_enabled", "sent_at",
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
                "fan_enabled": row["fan_enabled"],
                "fan_manual_enabled": row["fan_manual_enabled"],
                "sent_at": row["sent_at"].strftime("%Y-%m-%d %H:%M:%S"),
                "is_default": False,
            }
        else:
            config[node_id] = {**DEFAULT_CONFIG, "sent_at": None, "is_default": True}
    return config


def _to_epoch_ms(naive_dt):
    # mqtt_log.logged_at es TIMESTAMP naive con la hora local de Guatemala
    # ya calculada (igual que node_config_log/node_readings/etc, ver
    # comentario identico en historico/views.py y tiemporeal/views.py).
    # Tratarlo como UTC (sin conversion real) es lo que le permite a
    # configuracion.js comparar este epoch con Date.now() del navegador
    # usando la misma convencion que el resto del dashboard.
    return int(naive_dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _parse_since(raw):
    try:
        since_ms = int(raw)
    except (TypeError, ValueError):
        since_ms = 0
    if since_ms <= 0:
        return datetime.min
    return datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).replace(tzinfo=None)


@staff_required
def configuracion(request):
    return render(request, "configuracion.html", {
        "node_config": _latest_config_by_node(),
        # Punto de partida del polling de acks (ver configuracion_ack_latest
        # / dashboard.js): "ahora", para no bombardear al usuario con acks
        # viejos de configuraciones pasadas apenas abre la pagina.
        "ack_since_ms": _to_epoch_ms(datetime.now()),
    })


@staff_required
@require_GET
def configuracion_ack_latest(request):
    """Acks nuevos (config/.../ack) desde la ultima vez que el cliente
    pregunto. Mismo endpoint de polling que tiemporeal_latest
    (tiemporeal/views.py): el navegador pregunta cada pocos segundos en
    vez de abrir una conexion MQTT propia.

    Deduplica por (node_id, ts del payload): el ack usa QoS1 a proposito
    (ver mqtt_telemetry.c) y puede llegar duplicado si el PUBACK tarda -
    eso es correcto a nivel de protocolo, pero mostrar el mismo aviso dos
    veces en la interfaz seria confuso, asi que aqui se queda con la
    primera copia de cada (node_id, ts) y descarta el resto.
    """
    since = _parse_since(request.GET.get("since"))

    rows = list(
        MqttLog.objects.filter(topic__in=ACK_TOPICS, logged_at__gt=since)
        .order_by("logged_at")
        .values("topic", "payload_json", "logged_at")
    )

    seen = set()
    acks = []
    last_epoch_ms = None
    for row in rows:
        last_epoch_ms = _to_epoch_ms(row["logged_at"])

        node_id = row["topic"].split("/")[-2]  # iot-challenge/config/<node_id>/ack
        data = row["payload_json"] or {}
        dedup_key = (node_id, data.get("ts"))
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        acks.append({
            "node_id": node_id,
            "status": data.get("status"),
            "reason": data.get("reason"),
            "applied": data.get("applied"),
        })

    return JsonResponse({"acks": acks, "lastEpochMs": last_epoch_ms})


# Cada grupo es lo que el switch "Enviar" de configuracion.html habilita o
# no (ver config-include-<grupo> en el template y configReadForm() en
# dashboard.js): si el operador lo deja apagado, ese campo (o par de
# campos, en temp/hum) no se toca para ningun nodo objetivo - cada nodo
# conserva el valor que ya tenia (ver configuracion_actualizar()).
CONFIG_FIELD_GROUPS = {
    "temp": ("temp_min", "temp_max"),
    "hum": ("hum_min", "hum_max"),
    "buzzer": ("buzzer_enabled",),
    "visual_alarm": ("visual_alarm_enabled",),
    "fan": ("fan_enabled",),
    "fan_manual": ("fan_manual_enabled",),
}


def _parse_config_payload(data):
    """Valida el payload JSON recibido del formulario. Devuelve
    ((new_values, target_node_ids), error_msg); el primer elemento es None
    si error_msg no es None (y viceversa).

    new_values solo trae los campos de los grupos marcados con
    "include_<grupo>": true (ver CONFIG_FIELD_GROUPS) - los grupos
    apagados ni se validan ni se incluyen, porque configuracion_actualizar()
    los va a resolver con el valor que cada nodo objetivo ya tenia, no con
    lo que haya quedado en el formulario (que para "Ambos" es solo un
    punto de partida visual, ver configFillForm() en dashboard.js).
    """
    node_target = data.get("node_target")
    if node_target not in ("nodo-a", "nodo-b", "ambos"):
        return None, "node_target invalido."

    include = {group: bool(data.get("include_" + group)) for group in CONFIG_FIELD_GROUPS}
    if not any(include.values()):
        return None, "Selecciona al menos un parametro para incluir en el envio."

    new_values = {}

    if include["temp"]:
        try:
            temp_min = float(data["temp_min"])
            temp_max = float(data["temp_max"])
        except (KeyError, TypeError, ValueError):
            return None, "Los limites de temperatura deben ser numericos."
        t_lo, t_hi = TEMP_PHYSICAL_RANGE
        if not (t_lo <= temp_min < temp_max <= t_hi):
            return None, f"Temperatura: minima < maxima, ambas entre {t_lo:.0f} y {t_hi:.0f} C."
        new_values["temp_min"] = temp_min
        new_values["temp_max"] = temp_max

    if include["hum"]:
        try:
            hum_min = float(data["hum_min"])
            hum_max = float(data["hum_max"])
        except (KeyError, TypeError, ValueError):
            return None, "Los limites de humedad deben ser numericos."
        h_lo, h_hi = HUM_PHYSICAL_RANGE
        if not (h_lo <= hum_min < hum_max <= h_hi):
            return None, f"Humedad: minima < maxima, ambas entre {h_lo:.0f}% y {h_hi:.0f}%."
        new_values["hum_min"] = hum_min
        new_values["hum_max"] = hum_max

    if include["buzzer"]:
        new_values["buzzer_enabled"] = bool(data.get("buzzer_enabled"))
    if include["visual_alarm"]:
        new_values["visual_alarm_enabled"] = bool(data.get("visual_alarm_enabled"))
    if include["fan"]:
        new_values["fan_enabled"] = bool(data.get("fan_enabled"))
    if include["fan_manual"]:
        new_values["fan_manual_enabled"] = bool(data.get("fan_manual_enabled"))

    targets = NODE_IDS if node_target == "ambos" else [node_target]
    return (new_values, targets), None


@staff_required
@require_POST
def configuracion_actualizar(request):
    """Publica la configuracion recibida (retained + QoS1, ver
    configuracion/mqtt_publish.py) en config/<node_id> para cada nodo
    objetivo, y deja constancia en node_config_log.

    Solo los grupos marcados para incluir (ver _parse_config_payload) se
    actualizan; para cada nodo objetivo, el resto de los campos se toma de
    NodeConfigLog.latest_config(node_id) - la configuracion que ESE nodo ya
    tenia, no la de otro nodo ni la que haya quedado visible en el
    formulario. Asi, enviar "Ambos" marcando solo, por ejemplo, el
    ventilador manual aplica ese mismo cambio a los dos nodos sin alterar
    los umbrales u otros actuadores que cada uno tuviera configurados de
    forma distinta. El payload publicado y guardado es siempre completo
    (los 8 campos): el firmware rechaza un config/<node_id> incompleto
    (ver handle_config_event() en mqtt_telemetry.c).

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
    new_values, targets = parsed

    results = []
    for node_id in targets:
        config = {**NodeConfigLog.latest_config(node_id), **new_values}

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
            "applied": config,
        })

    return JsonResponse({"ok": True, "results": results})
