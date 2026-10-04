#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

// Configura el buzzer (GPIO32) como salida y arranca en segundo plano la
// tarea que lo hace sonar segun lo que indique buzzer_set_enabled().
// Llamar una sola vez al arrancar; el buzzer queda apagado hasta la
// primera llamada a buzzer_set_enabled(true, ...).
esp_err_t buzzer_init(void);

// Habilita/deshabilita el buzzer y fija su cadencia: on_ms sonando, off_ms
// en silencio, en milisegundos. El modulo es generico (no sabe de alarmas
// ni de MQTT); quien llama decide el significado de cada patron, por
// ejemplo mqtt/mqtt_telemetry.c usando (1000, 3000) para la alarma sonora
// segun "buzzer_enabled" (topic iot-challenge/config/<NODE_ID>).
// El cambio aplica de inmediato (interrumpe el tramo en curso, por largo
// que sea) en vez de esperar a que termine el ciclo vigente.
void buzzer_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);

// Hace una tanda de "count" pulsos rapidos (on_ms sonando, off_ms en
// silencio cada uno) e interrumpe de inmediato el patron de fondo vigente
// (el de la ultima llamada a buzzer_set_enabled()) para hacerlo; al
// terminar, retoma ese patron de fondo tal cual estaba, sin alterarlo.
// Pensado para una confirmacion puntual (p.ej. "mensaje de configuracion
// recibido"), no para la alarma continua - ver buzzer_set_enabled().
void buzzer_pulse(uint8_t count, uint32_t on_ms, uint32_t off_ms);
