#pragma once

/*
 * Plantilla de credenciales + identidad de nodo (WiFi + MQTT + sensor).
 *
 * Copia este archivo como "secrets.h" en la misma carpeta y completa los
 * valores reales. "secrets.h" está en .gitignore y NUNCA debe subirse al
 * repositorio.
 */

// Identidad del nodo: todo lo que cambia entre Nodo A y Nodo B vive aqui.
// NODE_ID arma el MQTT_CLIENT_ID y los topics (ver mqtt/mqtt_telemetry.c)
// via concatenacion de strings adyacentes, asi que debe ser exactamente
// "nodo-a" o "nodo-b" (coincidiendo con el arbol de topics documentado en
// Documentation/README.md). AHT10_I2C_ADDR es la direccion I2C del AHT10
// fisico conectado a este nodo (ver aht10/aht10_sensor.c).
#define NODE_ID "nodo-a" // "nodo-a" o "nodo-b"
#define AHT10_I2C_ADDR 0x38

#define WIFI_SSID "SSID_DE_TU_RED"
#define WIFI_PASSWORD "PASSWORD_DE_TU_RED"

// Broker HiveMQ Cloud (TLS, puerto 8883)
#define MQTT_BROKER_URL "mqtts://TU_INSTANCIA.hivemq.cloud:8883"
#define MQTT_USERNAME "usuario_mqtt"
#define MQTT_PASSWORD "password_mqtt"

// MAC de estacion WiFi de cada nodo, para el enlace directo ESP-NOW entre
// Nodo A y Nodo B (ver espnow/espnow.c): cada nodo le envia su mensaje de
// emergencia al MAC del OTRO nodo, elegido en tiempo de ejecucion segun
// NODE_ID, asi que ambas MAC deben estar definidas (y ser correctas) en
// los dos nodos. Se obtienen encendiendo cada ESP32 y leyendo la MAC de
// estacion WiFi que imprime por consola al arrancar (o con
// esp_wifi_get_mac(WIFI_IF_STA, ...)).
#define NODE_A_MAC {0x00, 0x00, 0x00, 0x00, 0x00, 0x00} // MAC WiFi STA del Nodo A
#define NODE_B_MAC {0x00, 0x00, 0x00, 0x00, 0x00, 0x00} // MAC WiFi STA del Nodo B
