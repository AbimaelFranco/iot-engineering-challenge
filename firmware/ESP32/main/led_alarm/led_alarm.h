#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

// Configura el LED integrado (GPIO2) como salida y arranca en segundo
// plano la tarea que lo hace parpadear segun lo que indique
// led_alarm_set_enabled(). Llamar una sola vez al arrancar; el LED queda
// apagado hasta la primera llamada a led_alarm_set_enabled(true, ...).
esp_err_t led_alarm_init(void);

// Habilita/deshabilita el parpadeo y fija su cadencia: on_ms encendido,
// off_ms apagado, en milisegundos. El modulo es generico (no sabe de
// alarmas ni de MQTT); quien llama decide el significado de cada patron,
// por ejemplo mqtt/mqtt_telemetry.c usando (1000, 3000) para la alarma
// visual segun "visual_alarm_enabled" (topic iot-challenge/config/<NODE_ID>).
// El cambio aplica de inmediato (interrumpe el tramo en curso, por largo
// que sea) en vez de esperar a que termine el ciclo vigente.
void led_alarm_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);

// Hace una tanda de "count" pulsos rapidos (on_ms encendido, off_ms
// apagado cada uno) e interrumpe de inmediato el patron de fondo vigente
// (el de la ultima llamada a led_alarm_set_enabled()) para hacerlo; al
// terminar, retoma ese patron de fondo tal cual estaba, sin alterarlo.
// Pensado para una confirmacion puntual (p.ej. "mensaje de configuracion
// recibido"), no para la alarma continua - ver led_alarm_set_enabled().
void led_alarm_pulse(uint8_t count, uint32_t on_ms, uint32_t off_ms);
