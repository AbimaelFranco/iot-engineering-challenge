/*
 * Nodo A: lee temperatura y humedad del AHT10 y las publica por MQTT
 * (TLS) a HiveMQ Cloud, siguiendo la estructura de topics definida en
 * Documentation/README.md.
 *
 * Manejo del sensor: aht10_sensor.c/.h
 * WiFi + cliente MQTT: mqtt_telemetry.c/.h
 *
 * Credenciales de WiFi y del broker MQTT en "secrets.h" (no versionado,
 * ver .gitignore). Plantilla de referencia: "secrets.example.h".
 */

#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"

#include "aht10/aht10_sensor.h"
#include "mqtt/mqtt_telemetry.h"

#define READ_PERIOD_MS 5000

void app_main(void)
{
    printf("\n=== NODO A - AHT10 + MQTT ===\n\n");

    // Sin WiFi/MQTT no hay forma de publicar telemetría: si falla, se aborta.
    if (mqtt_telemetry_init() != ESP_OK)
    {
        printf("No se pudo inicializar WiFi/MQTT.\n");
        return;
    }

    // Sin bus I2C no hay forma de hablar con el sensor: si falla, se aborta.
    if (aht10_sensor_init() != ESP_OK)
    {
        printf("No se pudo inicializar el sensor AHT10.\n");
        return;
    }

    printf("\nComenzando lecturas...\n\n");

    uint32_t seq = 0;

    // Bucle principal: lee, imprime el resultado (o el error), publica por
    // MQTT si la lectura fue válida, y espera antes de la siguiente medición.
    while (1)
    {
        float temperature = 0.0f;
        float humidity = 0.0f;

        esp_err_t err = aht10_sensor_read(&temperature, &humidity);
        if (err == ESP_OK)
        {
            printf("Temperatura: %.2f C | Humedad: %.2f %%\n", temperature, humidity);

            err = mqtt_telemetry_publish(temperature, humidity, READ_PERIOD_MS, seq++);
            if (err != ESP_OK)
            {
                printf("No se publico telemetria: %s\n", esp_err_to_name(err));
            }
        }
        else
        {
            printf("ERROR leyendo AHT10: %s\n", esp_err_to_name(err));
        }

        vTaskDelay(pdMS_TO_TICKS(READ_PERIOD_MS));
    }
}
