# Documentación

## Firmware

## Electrónica

## Backend

## Base de Datos

## Protocolo MQTT

Definicón de estructura MQTT a utilizar, especificando el árbol de topics, el formato de mensajes y los parámetros de conexión usados en el enlace **nodo ↔ plataforma** a través del broker HiveMQ (ver `Documentation/Architecture/`).


### Árbol de topics

```
iot-challenge/             # namespace raíz
├── telemetria/
│   ├── nodo-a             # lecturas de temperatura y humedad
│   └── nodo-b
├── status/
│   ├── nodo-a             # online / offline (retained + LWT)
│   └── nodo-b
├── config/
│   ├── nodo-a             # parametros de alerta + alarmas (retained)
│   │   └── ack            # confirmación de recepción
│   └── nodo-b
│       └── ack
└── cmd/
    ├── nodo-a             # comando individual al nodo A
    │   └── ack            # confirmación de ejecución
    ├── nodo-b             # comando individual al nodo B
    │   └── ack
    └── all                # comando en broadcast a ambos nodos
```

### Tabla resumen

| Topic | Dirección | QoS | Retained | LWT | Payload (campos clave) |
|---|---|---|---|---|---|
| `telemetria/nodo-a`<br>`telemetria/nodo-b` | nodo → plataforma | 0 | true | no | `ts, temp, hum, actuator, mode, setpoint, sample_ms, seq` |
| `status/nodo-a`<br>`status/nodo-b` | nodo → plataforma | 1 | true | **sí** (`{"state":"offline"}`) | `state: "online"\|"offline", ts` |
| `config/nodo-a`<br>`config/nodo-b` | plataforma → nodo | 1 | **true** | no | `temp_min, temp_max, hum_min, hum_max, buzzer_enabled, visual_alarm_enabled, fan_enabled, ts` |
| `config/nodo-a/ack`<br>`config/nodo-b/ack` | nodo → plataforma | 1 | false | no | `ts, status: "ok"\|"error", applied / reason` |
| `cmd/nodo-a`<br>`cmd/nodo-b`<br>`cmd/all` | plataforma → nodo | 1 | false | no | `id, action, value` |
| `cmd/nodo-a/ack`<br>`cmd/nodo-b/ack` | nodo → plataforma | 1 | false | no | `id, status: "ok"\|"error", applied / reason` |

### Observaciones

- **`telemetria` (QoS 0, retained)**: es una serie periódica; perder una muestra no importa porque la siguiente la reemplaza. Se deja *retained* para que un dashboard que se abre o reconecta vea el último valor de inmediato en vez de esperar el próximo ciclo de muestreo. El campo `ts` permite al frontend marcarlo como obsoleto si es muy viejo.
- **`status` (QoS 1, retained, LWT)**: es el dato crítico para detectar pérdida de comunicación (requisito 7 del reto). *Retained* garantiza que cualquier suscriptor nuevo conozca el estado actual sin esperar un evento. El LWT se registra al conectar (`mqtt_cfg.session.last_will` en `esp-mqtt`) apuntando a este mismo topic con `{"state":"offline"}`; si la conexión TCP se cae sin `DISCONNECT` limpio, el broker lo publica automáticamente tras el *keepalive*. Al conectar, el nodo publica `{"state":"online"}` retained explícitamente.
- **`config` (QoS 1, retained)**: a diferencia de `cmd` (acción puntual, no retenida), esto es *estado de configuración* persistente — los límites de alerta de temperatura/humedad, la habilitación de las alarmas sonora/visual y el encendido/apagado remoto del ventilador. El firmware arranca con valores de fábrica fijos; la vista de Configuración del dashboard es quien los actualiza, publicando acá con `retain=true`, igual que `status`, para que un nodo que reconecta (o que recién bootea) reciba de inmediato la última configuración vigente sin esperar a que alguien la reenvíe manualmente. Se modela como topic propio en vez de una acción más de `cmd` justamente porque su semántica ("el último valor vale hasta que alguien lo cambie") es la opuesta a la de `cmd`, donde retener provocaría que un nodo re-ejecute una acción vieja al reconectarse.
- **`config/.../ack` (QoS 1, no retenido)**: igual que `cmd/.../ack`, confirma de forma confiable que el nodo recibió y aplicó (o rechazó) una configuración puntual — esta confirmación se considera vital, no meramente informativa, así que se prefiere arriesgar un duplicado ocasional a arriesgar perderla con QoS0. El duplicado puede pasar porque el reintento por defecto de `esp-mqtt` (`message_retransmit_timeout`, 1000 ms) es más agresivo que el round-trip real hacia un broker en la nube: si el `PUBACK` tarda un poco de más, la librería reenvía por su cuenta y el broker entrega el mismo ack dos veces al suscriptor (visto en producción: mismo `ts`, dos filas en `mqtt_log`). Un consumidor que necesite exactamente una fila por ack debe deduplicar por `ts` (igual que `node_commands` dedupe por `id`), no es algo que el nodo deba resolver bajando el QoS. *No* se retiene porque, a diferencia de `config/<node_id>`, esto está atado al `ts` de un mensaje específico, no representa "la configuración vigente" (eso ya lo cubre el propio `config/<node_id>` retenido). El nodo responde siempre que procesa un mensaje en `config/<node_id>`, incluso si vino con JSON inválido o campos faltantes (`status: "error"`, `reason`), para que la plataforma nunca se quede sin saber qué pasó.
- **`cmd` (QoS 1, no retenido)**: un comando perdido es peor que uno duplicado (el firmware debe ser idempotente ante comandos repetidos). *No* se retiene: si quedara retenido, un nodo que se reconecta re-ejecutaría el último comando viejo apenas se suscribe.
- **`cmd/.../ack` (QoS 1, no retenido)**: la plataforma debe confirmar de forma confiable que el comando se aplicó (requisito 6: mostrar el estado real reportado, no solo el comando enviado). No se retiene porque cada ack está atado a un `id` de comando específico, no representa "el estado actual".

### Formato de mensajes

```jsonc
// telemetria/nodo-x
{"ts": 1732740000, "temp": 24.3, "hum": 51.2, "actuator": "on", "mode": "auto", "setpoint": 25.0, "sample_ms": 5000, "seq": 142}

// status/nodo-x
{"state": "online", "ts": 1732740000}

// config/nodo-x
{"temp_min": 18.0, "temp_max": 30.0, "hum_min": 30.0, "hum_max": 80.0, "buzzer_enabled": true, "visual_alarm_enabled": true, "fan_enabled": true, "ts": 1732740000}

// config/nodo-x/ack
{"ts": 1732740000, "status": "ok", "applied": {"temp_min": 18.0, "temp_max": 30.0, "hum_min": 30.0, "hum_max": 80.0, "buzzer_enabled": true, "visual_alarm_enabled": true, "fan_enabled": true}}
{"ts": 1732740000, "status": "error", "reason": "invalid_fields"}
// reason: invalid_json | invalid_fields | fragmented

// cmd/nodo-x  (y cmd/all)
{"id": "c-045", "action": "set_setpoint", "value": 26.0}
// acciones: set_actuator | set_setpoint | set_sample_period | set_mode

// cmd/nodo-x/ack
{"id": "c-045", "status": "ok", "applied": {"setpoint": 26.0}}
{"id": "c-045", "status": "error", "reason": "out_of_range"}
```

El `id` del comando permite a la plataforma asociar cada `ack` con el comando específico que lo originó, en vez de asumir que corresponde al último enviado. En `config/.../ack` cumple el mismo rol el campo `ts`: el nodo lo copia tal cual del mensaje de `config/<node_id>` que está confirmando (no genera uno propio), salvo que ese mensaje nunca se haya podido parsear (JSON inválido o fragmentado), en cuyo caso usa su propia hora local como mejor esfuerzo.

### Parámetros de conexión (por nodo)

| Parámetro | Valor | Motivo |
|---|---|---|
| `client_id` | `nodo-a` / `nodo-b` | Consistente con los topics; si dos firmwares se conectan con el mismo id, HiveMQ cierra la sesión más antigua (ayuda a detectar instancias duplicadas). |
| `keepalive` | 15 s | El broker declara muerto a un cliente tras ~1.5× keepalive sin `PINGREQ` (~22-23 s), suficientemente rápido para demostrar la detección de desconexión sin falsos positivos por jitter normal de Wi-Fi. |
| `clean_session` | `true` | Sesión limpia en cada reconexión, coherente con que `cmd` no sea retained: un nodo que estuvo offline no debe recibir en cola comandos viejos al volver. |
