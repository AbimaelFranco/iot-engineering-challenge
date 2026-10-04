#pragma once

#include "esp_err.h"

// Configura el pulsador de emergencia (GPIO25, pull-down externo: en
// reposo el pin esta en 0, al presionar sube a 1) como entrada con
// interrupcion por flanco ascendente, y arranca en segundo plano la
// tarea que, ante cada pulsacion, hace sonar el buzzer (ver
// buzzer/buzzer.h) 5 veces muy rapido a modo de alerta. Llamar una sola
// vez al arrancar.
esp_err_t emergency_button_init(void);
