/*
 * Control generico del LED integrado en GPIO2: parpadea con el tiempo en
 * alto/bajo que indique el caller (ver led_alarm_set_enabled()). Hoy lo
 * usa mqtt/mqtt_telemetry.c para la alarma visual (segun
 * "visual_alarm_enabled" recibido por MQTT), pero el modulo no conoce esa
 * semantica: solo sabe parpadear o quedarse apagado. Corre en su propia
 * tarea FreeRTOS para no interferir con el loop principal de lectura del
 * sensor (ESP32.c) ni con el cliente MQTT.
 */

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#include "led_alarm.h"

#define LED_GPIO GPIO_NUM_2
#define LED_IDLE_POLL_MS 200

static volatile bool s_enabled = false;
static volatile uint32_t s_on_ms = 0;
static volatile uint32_t s_off_ms = 0;

// Ciclo apagado/encendido mientras s_enabled este activo, con los tiempos
// vigentes al momento de cada tramo (s_on_ms/s_off_ms pueden cambiar entre
// un tramo y otro si el caller llama led_alarm_set_enabled() de nuevo).
// Revisa el flag antes y despues de cada tramo para que deshabilitar la
// alarma corte el parpadeo lo antes posible en vez de esperar un ciclo
// completo.
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
        vTaskDelay(pdMS_TO_TICKS(s_off_ms));
        if (!s_enabled)
        {
            continue;
        }

        gpio_set_level(LED_GPIO, 1);
        vTaskDelay(pdMS_TO_TICKS(s_on_ms));
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
        printf("ERROR configurando GPIO%d como salida: %s\n", LED_GPIO, esp_err_to_name(err));
        return err;
    }
    gpio_set_level(LED_GPIO, 0);

    BaseType_t ok = xTaskCreate(led_alarm_task, "led_alarm", 2048, NULL, tskIDLE_PRIORITY + 1, NULL);
    if (ok != pdPASS)
    {
        printf("ERROR creando la tarea de parpadeo del LED\n");
        return ESP_FAIL;
    }

    return ESP_OK;
}

void led_alarm_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms)
{
    if (enabled != s_enabled || on_ms != s_on_ms || off_ms != s_off_ms)
    {
        printf("LED GPIO%d: %s (on=%ums, off=%ums)\n", LED_GPIO,
               enabled ? "activado" : "desactivado", (unsigned)on_ms, (unsigned)off_ms);
    }
    s_on_ms = on_ms;
    s_off_ms = off_ms;
    s_enabled = enabled;
}
