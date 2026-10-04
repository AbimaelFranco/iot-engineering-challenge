#pragma once

#include "esp_err.h"

// Inicializa el enlace directo ESP-NOW entre Nodo A y Nodo B: agrega como
// unico peer la MAC del OTRO nodo (NODE_A_MAC/NODE_B_MAC en secrets.h,
// elegida segun NODE_ID) y registra los callbacks de envio/recepcion
// (ver espnow.c). El listener de recepcion queda activo desde este
// momento: si llega "paro de emergencia" desde el otro nodo, dispara el
// buzzer local de inmediato (ver espnow_recv_cb() en espnow.c). Requiere
// que el WiFi ya este arriba en modo estacion (ver mqtt_telemetry_init());
// llamar una sola vez, despues de eso.
esp_err_t espnow_init(void);

// Envia "paro de emergencia" al otro nodo por ESP-NOW (ver peer elegido
// en espnow_init()). El modulo no decide cuando llamar a esto; por ahora
// no esta conectado a ningun trigger (p.ej. el pulsador de emergencia,
// ver emergency_button/emergency_button.c, queda para una integracion
// futura), asi que queda disponible para que el caller lo use.
esp_err_t espnow_send_emergency_stop(void);
