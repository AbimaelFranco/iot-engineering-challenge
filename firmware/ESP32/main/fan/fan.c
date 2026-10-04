/*
 * Control generico del ventilador en GPIO23: queda encendido/apagado con
 * el tiempo en alto/bajo que indique el caller (ver fan_set_enabled()), o
 * se queda encendido de forma fija (ver fan_set_constant()). Hoy lo usa
 * mqtt/mqtt_telemetry.c para encenderlo con fan_set_constant() cuando
 * corresponda segun "fan_enabled"/"fan_manual_enabled" (topic
 * iot-challenge/config/<NODE_ID>: umbral del AHT10 o encendido forzado,
 * ver evaluate_alarm_thresholds() en mqtt_telemetry.c), pero el modulo no
 * conoce esa semantica: solo sabe quedarse encendido, apagado o alternar
 * segun la cadencia indicada. Corre en su propia tarea FreeRTOS para no
 * interferir con el loop principal de lectura del sensor (ESP32.c) ni con
 * el cliente MQTT. Misma estructura que buzzer (ver buzzer/buzzer.c).
 */

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#include "fan.h"

#define FAN_GPIO GPIO_NUM_23
#define FAN_IDLE_POLL_MS 200

static TaskHandle_t s_task_handle = NULL;

static volatile bool s_enabled = false;
static volatile uint32_t s_on_ms = 0;
static volatile uint32_t s_off_ms = 0;

static volatile bool s_constant_enabled = false;

// Espera hasta ms_delay, o hasta que fan_set_enabled()/fan_set_constant()
// despierten la tarea antes via xTaskNotifyGive(). Devuelve true si la
// espera se completo sin interrupcion (para que el loop principal sepa si
// debe seguir con el tramo actual o reevaluar desde el inicio).
static bool wait_or_notified(uint32_t ms)
{
    return ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(ms)) == 0;
}

// Patron de fondo (fan_set_enabled()/fan_set_constant()): si esta en modo
// constante se queda encendido de forma fija; si no, encendido con
// s_on_ms/s_off_ms mientras s_enabled este activo, o apagado por completo
// en caso contrario. El modo constante tiene prioridad sobre el parpadeo
// (ver fan_set_constant()).
static void fan_task(void *arg)
{
    (void)arg;

    while (1)
    {
        if (s_constant_enabled)
        {
            gpio_set_level(FAN_GPIO, 1);
            wait_or_notified(FAN_IDLE_POLL_MS);
            continue;
        }

        if (!s_enabled)
        {
            gpio_set_level(FAN_GPIO, 0);
            wait_or_notified(FAN_IDLE_POLL_MS);
            continue;
        }

        gpio_set_level(FAN_GPIO, 0);
        if (!wait_or_notified(s_off_ms))
        {
            continue;
        }

        gpio_set_level(FAN_GPIO, 1);
        wait_or_notified(s_on_ms);
    }
}

esp_err_t fan_init(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = 1ULL << FAN_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK)
    {
        printf("ERROR configurando GPIO%d como salida: %s\n", FAN_GPIO, esp_err_to_name(err));
        return err;
    }
    gpio_set_level(FAN_GPIO, 0);

    BaseType_t ok = xTaskCreate(fan_task, "fan", 2048, NULL, tskIDLE_PRIORITY + 1, &s_task_handle);
    if (ok != pdPASS)
    {
        printf("ERROR creando la tarea del ventilador\n");
        return ESP_FAIL;
    }

    return ESP_OK;
}

void fan_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms)
{
    if (enabled != s_enabled || on_ms != s_on_ms || off_ms != s_off_ms)
    {
        printf("Ventilador GPIO%d: %s (on=%ums, off=%ums)\n", FAN_GPIO,
               enabled ? "activado" : "desactivado", (unsigned)on_ms, (unsigned)off_ms);
    }
    s_on_ms = on_ms;
    s_off_ms = off_ms;
    s_enabled = enabled;

    if (s_task_handle != NULL)
    {
        xTaskNotifyGive(s_task_handle);
    }
}

void fan_set_constant(bool enabled)
{
    if (enabled != s_constant_enabled)
    {
        printf("Ventilador GPIO%d: modo constante %s\n", FAN_GPIO, enabled ? "activado" : "desactivado");
    }
    s_constant_enabled = enabled;

    if (s_task_handle != NULL)
    {
        xTaskNotifyGive(s_task_handle);
    }
}
