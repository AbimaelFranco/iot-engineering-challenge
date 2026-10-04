#pragma once

#include "esp_err.h"

// Configura el pulsador de emergencia (GPIO25, pull-down externo: en
// reposo el pin esta en 0, al presionar sube a 1) como entrada con
// interrupcion por flanco ascendente, y arranca en segundo plano la
// tarea que, ante cada pulsacion, manda "paro de emergencia" al otro
// nodo por ESP-NOW (ver espnow_send_emergency_stop() en
// espnow/espnow.h) - es el otro nodo quien hace sonar su buzzer al
// recibirlo. Llamar una sola vez al arrancar, despues de espnow_init().
esp_err_t emergency_button_init(void);
