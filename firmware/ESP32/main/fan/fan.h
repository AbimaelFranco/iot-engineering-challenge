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
// configuracion); quien llama decide el significado de cada patron.
// mqtt/mqtt_telemetry.c hoy usa fan_set_constant() en su lugar (encendido
// fijo, no parpadeo); esta funcion queda disponible para quien si
// necesite un patron intermitente. El cambio aplica de inmediato
// (interrumpe el tramo en curso, por largo que sea) en vez de esperar a
// que termine el ciclo vigente.
void fan_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms);

// Habilita/deshabilita el modo de encendido constante (sin alternar): si
// enabled es true el ventilador queda encendido de forma fija hasta que
// se llame de nuevo con false, sin importar lo que indique
// fan_set_enabled(). Tiene prioridad sobre el parpadeo (si ambos modos
// estan activos, gana el constante). Pensado para una activacion continua
// (p.ej. lectura fuera de umbral), a diferencia del parpadeo que ofrece
// fan_set_enabled().
void fan_set_constant(bool enabled);
