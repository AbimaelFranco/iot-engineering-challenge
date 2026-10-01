#pragma once

/*
 * Plantilla de credenciales del Nodo A (WiFi + MQTT).
 *
 * Copia este archivo como "secrets.h" en la misma carpeta y completa los
 * valores reales. "secrets.h" está en .gitignore y NUNCA debe subirse al
 * repositorio.
 */

#define WIFI_SSID "SSID_DE_TU_RED"
#define WIFI_PASSWORD "PASSWORD_DE_TU_RED"

// Broker HiveMQ Cloud (TLS, puerto 8883)
#define MQTT_BROKER_URL "mqtts://TU_INSTANCIA.hivemq.cloud:8883"
#define MQTT_USERNAME "usuario_mqtt"
#define MQTT_PASSWORD "password_mqtt"
