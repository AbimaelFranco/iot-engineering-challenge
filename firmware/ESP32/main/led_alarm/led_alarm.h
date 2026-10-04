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
// alarmas ni de MQTT); quien llama decide el significado de cada patron.
// mqtt/mqtt_telemetry.c hoy usa led_alarm_set_constant() en su lugar para
// la alarma visual (encendido fijo, no parpadeo); esta funcion queda
// disponible para quien si necesite un patron intermitente. El cambio
// aplica de inmediato (interrumpe el tramo en curso, por largo que sea)
// en vez de esperar a que termine el ciclo vigente.
void led_alarm_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);

// Habilita/deshabilita el modo de encendido constante (sin parpadeo): si
// enabled es true el LED queda encendido de forma fija hasta que se llame
// de nuevo con false, sin importar lo que indique led_alarm_set_enabled().
// Tiene prioridad sobre el parpadeo (si ambos modos estan activos, gana
// el constante) pero no sobre led_alarm_pulse(), que siempre interrumpe
// momentaneamente el patron de fondo vigente. Pensado para una alarma
// continua (p.ej. lectura fuera de umbral), a diferencia del parpadeo que
// ofrece led_alarm_set_enabled().
void led_alarm_set_constant(bool enabled);

// Hace una tanda de "count" pulsos rapidos (on_ms encendido, off_ms
// apagado cada uno) e interrumpe de inmediato el patron de fondo vigente
// (el de la ultima llamada a led_alarm_set_enabled() o
// led_alarm_set_constant(), lo que se haya usado mas recientemente) para
// hacerlo; al terminar, retoma ese patron de fondo tal cual estaba, sin
// alterarlo. Pensado para una confirmacion puntual (p.ej. "mensaje de
// configuracion recibido"), no para la alarma continua - ver
// led_alarm_set_enabled()/led_alarm_set_constant().
void led_alarm_pulse(uint8_t count, uint32_t on_ms, uint32_t off_ms);
