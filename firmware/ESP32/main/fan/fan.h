#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

// Configura el ventilador (GPIO23) como salida y arranca en segundo plano
// la tarea que lo controla segun lo que indique fan_set_enabled(). Llamar
// una sola vez al arrancar; el ventilador queda apagado hasta la primera
// llamada a fan_set_enabled(true, ...).
esp_err_t fan_init(void);

// Habilita/deshabilita el ventilador y fija su cadencia: on_ms encendido,
// off_ms apagado, en milisegundos (misma logica que buzzer_set_enabled(),
// ver buzzer/buzzer.c). El modulo es generico (no sabe de MQTT ni de
// configuracion); quien llama decide el significado de cada patron, por
// ejemplo mqtt/mqtt_telemetry.c usando un on_ms largo y off_ms=0 para
// "encendido fijo" segun "fan_enabled" (topic iot-challenge/config/<NODE_ID>).
// El cambio aplica de inmediato (interrumpe el tramo en curso, por largo
// que sea) en vez de esperar a que termine el ciclo vigente.
void fan_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);
