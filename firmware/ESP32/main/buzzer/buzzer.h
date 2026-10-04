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
// ni de MQTT); quien llama decide el significado de cada patron.
// mqtt/mqtt_telemetry.c hoy usa buzzer_set_constant() en su lugar para la
// alarma sonora (encendido fijo, no parpadeo); esta funcion queda
// disponible para quien si necesite un patron intermitente. El cambio
// aplica de inmediato (interrumpe el tramo en curso, por largo que sea)
// en vez de esperar a que termine el ciclo vigente.
void buzzer_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);

// Habilita/deshabilita el modo de sonido constante (sin alternar): si
// enabled es true el buzzer queda sonando de forma fija hasta que se
// llame de nuevo con false, sin importar lo que indique
// buzzer_set_enabled(). Tiene prioridad sobre el parpadeo (si ambos modos
// estan activos, gana el constante) pero no sobre buzzer_pulse(), que
// siempre interrumpe momentaneamente el patron de fondo vigente. Pensado
// para una alarma continua (p.ej. lectura fuera de umbral), a diferencia
// del parpadeo que ofrece buzzer_set_enabled().
void buzzer_set_constant(bool enabled);

// Hace una tanda de "count" pulsos rapidos (on_ms sonando, off_ms en
// silencio cada uno) e interrumpe de inmediato el patron de fondo vigente
// (el de la ultima llamada a buzzer_set_enabled() o
// buzzer_set_constant(), lo que se haya usado mas recientemente) para
// hacerlo; al terminar, retoma ese patron de fondo tal cual estaba, sin
// alterarlo. Pensado para una confirmacion puntual (p.ej. "mensaje de
// configuracion recibido"), no para la alarma continua - ver
// buzzer_set_enabled()/buzzer_set_constant().
void buzzer_pulse(uint8_t count, uint32_t on_ms, uint32_t off_ms);
