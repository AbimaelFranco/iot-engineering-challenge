#pragma once

#include <stdint.h>

#include "esp_err.h"

// Conecta WiFi, sincroniza la hora por SNTP y arranca el cliente MQTT
// (TLS) contra HiveMQ Cloud. Parámetros de conexión del Nodo A (client_id,
// keepalive, clean_session) según la tabla en Documentation/README.md.
// Es fatal (propaga error) si falla WiFi o la inicialización del cliente
// MQTT; si solo falla la sincronización de hora, se avisa pero se continúa.
esp_err_t mqtt_telemetry_init(void);

// Arma el payload JSON de telemetría (ver formato de mensajes en
// Documentation/README.md) y lo publica en iot-challenge/telemetria/nodo-a.
esp_err_t mqtt_telemetry_publish(float temperature, float humidity, uint32_t sample_ms, uint32_t seq);

// Publica {"state":"online", "ts": ...} (retained) en iot-challenge/status/nodo-a.
// Se llama al reconectar (MQTT_EVENT_CONNECTED); el estado "offline" lo publica
// el broker automáticamente vía LWT si la conexión se cae sin DISCONNECT limpio.
esp_err_t mqtt_estatus_publish(void);
