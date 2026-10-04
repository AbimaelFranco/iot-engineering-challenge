/*
 * Enlace directo ESP-NOW entre Nodo A y Nodo B (ver diagrama de
 * arquitectura en Documentation/Architecture/), separado del enlace
 * nodo<->plataforma por MQTT (ver mqtt/mqtt_telemetry.c). No abre una
 * conexion propia: reutiliza el radio WiFi que mqtt_telemetry_init() ya
 * deja inicializado y arrancado en modo estacion, asi que este modulo
 * debe inicializarse despues de eso.
 *
 * Este nodo agrega como unico peer la MAC del OTRO nodo: si NODE_ID es
 * "nodo-a" le habla a NODE_B_MAC, si es "nodo-b" le habla a NODE_A_MAC
 * (ambas en secrets.h, ver secrets.example.h). Del lado del envio,
 * espnow_send_emergency_stop() manda "paro de emergencia" a ese peer, y
 * todavia no esta conectada a ningun trigger (p.ej. el pulsador de
 * emergencia, ver emergency_button/emergency_button.c). Del lado de la
 * recepcion si hay trigger: espnow_recv_cb() (el listener que se registra
 * en espnow_init()) detecta ese mismo mensaje viniendo del otro nodo y
 * hace sonar el buzzer local (ver buzzer/buzzer.h) con el mismo patron de
 * alerta que usa el pulsador de emergencia, para que un "paro de
 * emergencia" en cualquiera de los dos nodos se note en ambos.
 */

#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#include "esp_now.h"
#include "esp_wifi.h"
#include "esp_mac.h"
#include "esp_err.h"

#include "secrets.h"
#include "espnow.h"
#include "buzzer/buzzer.h"

#define ESPNOW_EMERGENCY_STOP_MSG "paro de emergencia"

// Mismo patron que usa el pulsador de emergencia local (ver
// emergency_button/emergency_button.c) para que la alerta se sienta
// igual sin importar si el "paro de emergencia" se origino en este nodo
// o llego por ESP-NOW desde el otro.
#define ESPNOW_EMERGENCY_STOP_PULSE_COUNT 5
#define ESPNOW_EMERGENCY_STOP_PULSE_ON_MS 100
#define ESPNOW_EMERGENCY_STOP_PULSE_OFF_MS 100

// MAC del otro nodo (peer): se resuelve una sola vez en espnow_init()
// segun NODE_ID.
static uint8_t s_peer_mac[ESP_NOW_ETH_ALEN];

// Solo informativo: confirma si el peer recibio el ultimo envio o no.
// esp_now_send() ya devuelve si se pudo encolar; esto es la confirmacion
// real de entrega, que llega async.
static void espnow_send_cb(const esp_now_send_info_t *tx_info, esp_now_send_status_t status)
{
    printf("ESP-NOW: envio a " MACSTR " %s\n", MAC2STR(tx_info->des_addr),
           status == ESP_NOW_SEND_SUCCESS ? "confirmado" : "fallido");
}

// Listener: se registra como callback de recepcion ESP-NOW en
// espnow_init(). Si lo recibido es exactamente ESPNOW_EMERGENCY_STOP_MSG,
// dispara el buzzer local (ver buzzer_pulse()) a modo de alerta; cualquier
// otro mensaje solo se imprime (hoy este es el unico mensaje que manda
// este modulo, ver espnow_send_emergency_stop()).
static void espnow_recv_cb(const esp_now_recv_info_t *info, const uint8_t *data, int data_len)
{
    printf("ESP-NOW: recibido de " MACSTR " (%d bytes): %.*s\n",
           MAC2STR(info->src_addr), data_len, data_len, (const char *)data);

    if ((size_t)data_len == strlen(ESPNOW_EMERGENCY_STOP_MSG) &&
        memcmp(data, ESPNOW_EMERGENCY_STOP_MSG, (size_t)data_len) == 0)
    {
        printf("ESP-NOW: paro de emergencia recibido del otro nodo, alertando con el buzzer\n");
        buzzer_pulse(ESPNOW_EMERGENCY_STOP_PULSE_COUNT, ESPNOW_EMERGENCY_STOP_PULSE_ON_MS,
                     ESPNOW_EMERGENCY_STOP_PULSE_OFF_MS);
    }
}

esp_err_t espnow_init(void)
{
    static const uint8_t node_a_mac[ESP_NOW_ETH_ALEN] = NODE_A_MAC;
    static const uint8_t node_b_mac[ESP_NOW_ETH_ALEN] = NODE_B_MAC;

    // El peer es siempre "el otro nodo": si este nodo es "nodo-a" le
    // habla al "nodo-b", y viceversa.
    bool is_node_a = strcmp(NODE_ID, "nodo-a") == 0;
    memcpy(s_peer_mac, is_node_a ? node_b_mac : node_a_mac, ESP_NOW_ETH_ALEN);

    esp_err_t err = esp_now_init();
    if (err != ESP_OK)
    {
        printf("ERROR inicializando ESP-NOW: %s\n", esp_err_to_name(err));
        return err;
    }

    err = esp_now_register_send_cb(espnow_send_cb);
    if (err != ESP_OK)
    {
        printf("ERROR registrando el callback de envio ESP-NOW: %s\n", esp_err_to_name(err));
        return err;
    }

    err = esp_now_register_recv_cb(espnow_recv_cb);
    if (err != ESP_OK)
    {
        printf("ERROR registrando el callback de recepcion ESP-NOW: %s\n", esp_err_to_name(err));
        return err;
    }

    esp_now_peer_info_t peer = {
        .channel = 0, // 0 = usar el canal actual de la estacion WiFi
        .ifidx = WIFI_IF_STA,
        .encrypt = false,
    };
    memcpy(peer.peer_addr, s_peer_mac, ESP_NOW_ETH_ALEN);

    err = esp_now_add_peer(&peer);
    if (err != ESP_OK)
    {
        printf("ERROR agregando el peer ESP-NOW " MACSTR ": %s\n", MAC2STR(s_peer_mac), esp_err_to_name(err));
        return err;
    }

    printf("ESP-NOW listo, peer (%s): " MACSTR "\n", is_node_a ? "nodo-b" : "nodo-a", MAC2STR(s_peer_mac));
    return ESP_OK;
}

esp_err_t espnow_send_emergency_stop(void)
{
    esp_err_t err = esp_now_send(s_peer_mac, (const uint8_t *)ESPNOW_EMERGENCY_STOP_MSG,
                                  strlen(ESPNOW_EMERGENCY_STOP_MSG));
    if (err != ESP_OK)
    {
        printf("ERROR enviando \"%s\" por ESP-NOW: %s\n", ESPNOW_EMERGENCY_STOP_MSG, esp_err_to_name(err));
    }
    return err;
}
