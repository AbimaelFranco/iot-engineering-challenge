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
// Al deshabilitar, el LED se apaga en el siguiente ciclo (hasta off_ms de
// latencia) en vez de cortarse a la mitad de un parpadeo. Llamar de nuevo
// con otros on_ms/off_ms mientras esta habilitado cambia la cadencia
// vigente para el siguiente tramo.
void led_alarm_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);
