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
| `cmd/nodo-a`<br>`cmd/nodo-b`<br>`cmd/all` | plataforma → nodo | 1 | false | no | `id, action, value` |
| `cmd/nodo-a/ack`<br>`cmd/nodo-b/ack` | nodo → plataforma | 1 | false | no | `id, status: "ok"\|"error", applied / reason` |

### Observaciones

- **`telemetria` (QoS 0, retained)**: es una serie periódica; perder una muestra no importa porque la siguiente la reemplaza. Se deja *retained* para que un dashboard que se abre o reconecta vea el último valor de inmediato en vez de esperar el próximo ciclo de muestreo. El campo `ts` permite al frontend marcarlo como obsoleto si es muy viejo.
- **`status` (QoS 1, retained, LWT)**: es el dato crítico para detectar pérdida de comunicación (requisito 7 del reto). *Retained* garantiza que cualquier suscriptor nuevo conozca el estado actual sin esperar un evento. El LWT se registra al conectar (`mqtt_cfg.session.last_will` en `esp-mqtt`) apuntando a este mismo topic con `{"state":"offline"}`; si la conexión TCP se cae sin `DISCONNECT` limpio, el broker lo publica automáticamente tras el *keepalive*. Al conectar, el nodo publica `{"state":"online"}` retained explícitamente.
- **`cmd` (QoS 1, no retenido)**: un comando perdido es peor que uno duplicado (el firmware debe ser idempotente ante comandos repetidos). *No* se retiene: si quedara retenido, un nodo que se reconecta re-ejecutaría el último comando viejo apenas se suscribe.
- **`cmd/.../ack` (QoS 1, no retenido)**: la plataforma debe confirmar de forma confiable que el comando se aplicó (requisito 6: mostrar el estado real reportado, no solo el comando enviado). No se retiene porque cada ack está atado a un `id` de comando específico, no representa "el estado actual".

### Formato de mensajes

```jsonc
// telemetria/nodo-x
{"ts": 1732740000, "temp": 24.3, "hum": 51.2, "actuator": "on", "mode": "auto", "setpoint": 25.0, "sample_ms": 5000, "seq": 142}

// status/nodo-x
{"state": "online", "ts": 1732740000}

// cmd/nodo-x  (y cmd/all)
{"id": "c-045", "action": "set_setpoint", "value": 26.0}
// acciones: set_actuator | set_setpoint | set_sample_period | set_mode

// cmd/nodo-x/ack
{"id": "c-045", "status": "ok", "applied": {"setpoint": 26.0}}
{"id": "c-045", "status": "error", "reason": "out_of_range"}
```

El `id` del comando permite a la plataforma asociar cada `ack` con el comando específico que lo originó, en vez de asumir que corresponde al último enviado.

### Parámetros de conexión (por nodo)

| Parámetro | Valor | Motivo |
|---|---|---|
| `client_id` | `nodo-a` / `nodo-b` | Consistente con los topics; si dos firmwares se conectan con el mismo id, HiveMQ cierra la sesión más antigua (ayuda a detectar instancias duplicadas). |
| `keepalive` | 15 s | El broker declara muerto a un cliente tras ~1.5× keepalive sin `PINGREQ` (~22-23 s), suficientemente rápido para demostrar la detección de desconexión sin falsos positivos por jitter normal de Wi-Fi. |
| `clean_session` | `true` | Sesión limpia en cada reconexión, coherente con que `cmd` no sea retained: un nodo que estuvo offline no debe recibir en cola comandos viejos al volver. |
