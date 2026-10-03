#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"

#include "secrets.h"
#include "aht10/aht10_sensor.h"
#include "mqtt/mqtt_telemetry.h"
#include "led_alarm/led_alarm.h"

#define READ_PERIOD_MS 60000

void app_main(void)
{
    printf("\n=== " NODE_ID " - AHT10 + MQTT ===\n\n");

    // No es fatal si falla: seguimos sin señal visual de alarma, pero el
    // resto del nodo (telemetría/MQTT) no depende de esto.
    if (led_alarm_init() != ESP_OK)
    {
        printf("No se pudo inicializar la alarma visual (GPIO2), se continua sin ella.\n");
    }

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
