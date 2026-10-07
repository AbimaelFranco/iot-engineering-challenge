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
// dashboard. Cada mensaje recibido se guarda (umbrales de temp/hum y los
// flags de habilitacion del buzzer/LED/ventilador) y se usa para encender
// esos actuadores de forma fija cuando la lectura del AHT10 quede fuera
// de los umbrales configurados (ver evaluate_alarm_thresholds() en
// mqtt_telemetry.c).
// Propaga error si falla la conexión WiFi o la inicialización del
// cliente MQTT (el caller en ESP32.c lo trata como no fatal: el nodo
// sigue sin telemetría/configuración remota); si solo falla la
// sincronización de hora, se avisa pero se continúa. En cualquier caso,
// el radio WiFi queda arriba y fijado en WIFI_CHANNEL (ver
// secrets.example.h) antes de intentar conectar, para que el enlace
// ESP-NOW hacia el otro nodo (ver espnow/espnow.c) siga funcionando
// aunque esta conexión falle.
esp_err_t mqtt_telemetry_init(void);

// Arma el payload JSON de telemetría (ver formato de mensajes en
// Documentation/README.md) y lo publica en iot-challenge/telemetria/<NODE_ID>.
esp_err_t mqtt_telemetry_publish(float temperature, float humidity, uint32_t sample_ms, uint32_t seq);

// Publica {"state":"online", "ts": ...} (retained) en iot-challenge/status/<NODE_ID>.
// Se llama al reconectar (MQTT_EVENT_CONNECTED); el estado "offline" lo publica
// el broker automáticamente vía LWT si la conexión se cae sin DISCONNECT limpio.
esp_err_t mqtt_estatus_publish(void);
