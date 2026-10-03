#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

// Configura el buzzer (GPIO25) como salida y arranca en segundo plano la
// tarea que lo hace sonar segun lo que indique buzzer_set_enabled().
// Llamar una sola vez al arrancar; el buzzer queda apagado hasta la
// primera llamada a buzzer_set_enabled(true, ...).
esp_err_t buzzer_init(void);

// Habilita/deshabilita el buzzer y fija su cadencia: on_ms sonando, off_ms
// en silencio, en milisegundos. El modulo es generico (no sabe de alarmas
// ni de MQTT); quien llama decide el significado de cada patron, por
// ejemplo mqtt/mqtt_telemetry.c usando (1000, 3000) para la alarma sonora
// segun "buzzer_enabled" (topic iot-challenge/config/<NODE_ID>).
// Al deshabilitar, el buzzer se apaga en el siguiente ciclo (hasta off_ms
// de latencia) en vez de cortarse a la mitad de un tramo. Llamar de nuevo
// con otros on_ms/off_ms mientras esta habilitado cambia la cadencia
// vigente para el siguiente tramo.
void buzzer_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);
