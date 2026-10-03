#pragma once

#include <stdbool.h>

#include "esp_err.h"

// Configura el LED integrado (GPIO2) como salida y arranca en segundo
// plano la tarea que lo hace parpadear mientras la alarma visual esta
// habilitada (ver led_alarm_set_enabled()). Llamar una sola vez al
// arrancar; el LED queda apagado hasta la primera llamada a
// led_alarm_set_enabled(true).
esp_err_t led_alarm_init(void);

// Habilita/deshabilita el parpadeo segun "visual_alarm_enabled" recibido
// en la configuracion MQTT (ver mqtt/mqtt_telemetry.c, topic
// iot-challenge/config/<NODE_ID>). Al deshabilitar, el LED se apaga en el
// siguiente ciclo (hasta 3s de latencia, ver LED_OFF_MS en led_alarm.c) en
// vez de cortarse a la mitad de un parpadeo.
void led_alarm_set_enabled(bool enabled);
