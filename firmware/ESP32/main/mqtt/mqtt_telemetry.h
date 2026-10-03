#pragma once

#include <stdint.h>

#include "esp_err.h"

// Conecta WiFi, sincroniza la hora por SNTP y arranca el cliente MQTT
// (TLS) contra HiveMQ Cloud. Parámetros de conexión del nodo (client_id,
// keepalive, clean_session) según NODE_ID (secrets.h) y la tabla en
// Documentation/README.md.
// Al conectar (y en cada reconexión) tambien se suscribe a
// iot-challenge/config/<NODE_ID> (retained, QoS1): el broker reentrega de
// inmediato la ultima configuracion de alertas/alarmas publicada desde el
// dashboard. De momento cada mensaje recibido solo se imprime por consola
// (ver mqtt_telemetry.c); todavia no se usa para accionar nada.
// Es fatal (propaga error) si falla WiFi o la inicialización del cliente
// MQTT; si solo falla la sincronización de hora, se avisa pero se continúa.
esp_err_t mqtt_telemetry_init(void);

// Arma el payload JSON de telemetría (ver formato de mensajes en
// Documentation/README.md) y lo publica en iot-challenge/telemetria/<NODE_ID>.
esp_err_t mqtt_telemetry_publish(float temperature, float humidity, uint32_t sample_ms, uint32_t seq);

// Publica {"state":"online", "ts": ...} (retained) en iot-challenge/status/<NODE_ID>.
// Se llama al reconectar (MQTT_EVENT_CONNECTED); el estado "offline" lo publica
// el broker automáticamente vía LWT si la conexión se cae sin DISCONNECT limpio.
esp_err_t mqtt_estatus_publish(void);
