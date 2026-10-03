/*
 * Senal visual de alarma: LED integrado en GPIO2, parpadeando mientras
 * "visual_alarm_enabled" (configuracion recibida por MQTT, ver
 * mqtt/mqtt_telemetry.c) este activo. Corre en su propia tarea FreeRTOS
 * para no interferir con el loop principal de lectura del sensor
 * (ESP32.c) ni con el cliente MQTT.
 */

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#include "led_alarm.h"

#define LED_GPIO GPIO_NUM_2
#define LED_ON_MS 1000
#define LED_OFF_MS 3000
#define LED_IDLE_POLL_MS 200

static volatile bool s_enabled = false;

// Ciclo apagado/encendido mientras s_enabled este activo; revisa el flag
// antes y despues de cada tramo para que deshabilitar la alarma corte el
// parpadeo lo antes posible en vez de esperar un ciclo completo.
static void led_alarm_task(void *arg)
{
    (void)arg;

    while (1)
    {
        if (!s_enabled)
        {
            gpio_set_level(LED_GPIO, 0);
            vTaskDelay(pdMS_TO_TICKS(LED_IDLE_POLL_MS));
            continue;
        }

        gpio_set_level(LED_GPIO, 0);
        vTaskDelay(pdMS_TO_TICKS(LED_OFF_MS));
        if (!s_enabled)
        {
            continue;
        }

        gpio_set_level(LED_GPIO, 1);
        vTaskDelay(pdMS_TO_TICKS(LED_ON_MS));
    }
}

esp_err_t led_alarm_init(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = 1ULL << LED_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK)
    {
        printf("ERROR configurando GPIO%d para la alarma visual: %s\n", LED_GPIO, esp_err_to_name(err));
        return err;
    }
    gpio_set_level(LED_GPIO, 0);

    BaseType_t ok = xTaskCreate(led_alarm_task, "led_alarm", 2048, NULL, tskIDLE_PRIORITY + 1, NULL);
    if (ok != pdPASS)
    {
        printf("ERROR creando la tarea de alarma visual\n");
        return ESP_FAIL;
    }

    return ESP_OK;
}

void led_alarm_set_enabled(bool enabled)
{
    if (enabled != s_enabled)
    {
        printf("Alarma visual (GPIO%d): %s\n", LED_GPIO, enabled ? "activada" : "desactivada");
    }
    s_enabled = enabled;
}
