#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"

#include "secrets.h"
#include "aht10/aht10_sensor.h"
#include "mqtt/mqtt_telemetry.h"
#include "led_alarm/led_alarm.h"
#include "buzzer/buzzer.h"
#include "fan/fan.h"
#include "emergency_button/emergency_button.h"
#include "espnow/espnow.h"

#define READ_PERIOD_MS 60000

void app_main(void)
{

    printf("\n=== " NODE_ID " - AHT10 + MQTT ===\n\n");

    // configuracion de alarma visual
    if (led_alarm_init() != ESP_OK)
    {
        printf("No se pudo inicializar la alarma visual (GPIO2), se continua sin ella.\n");
    }

    // configuracion de alarma auditiva
    if (buzzer_init() != ESP_OK)
    {
        printf("No se pudo inicializar el buzzer (GPIO32), se continua sin el.\n");
    }

    // configuracion de ventilador
    if (fan_init() != ESP_OK)
    {
        printf("No se pudo inicializar el ventilador (GPIO23), se continua sin el.\n");
    }

    // inicia wifi y cliente mqtt
    if (mqtt_telemetry_init() != ESP_OK)
    {
        printf("No se pudo inicializar WiFi/MQTT, se continua sin telemetria/configuracion remota.\n");
    }

    // inicia espnow
    if (espnow_init() != ESP_OK)
    {
        printf("No se pudo inicializar ESP-NOW, se continua sin el.\n");
    }

    // inicia boton de emergencia
    if (emergency_button_init() != ESP_OK)
    {
        printf("No se pudo inicializar el pulsador de emergencia (GPIO25), se continua sin el.\n");
    }

    // Obliga la detección de comunicacion I2C o aborta
    if (aht10_sensor_init() != ESP_OK)
    {
        printf("No se pudo inicializar el sensor AHT10.\n");
        return;
    }

    printf("\nComenzando lecturas...\n\n");

    uint32_t seq = 0;

    // Lecturas y publicaciones de telemetria por MQTT
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
