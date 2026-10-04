/*
 * Control generico del buzzer en GPIO32: suena con el tiempo en
 * alto/bajo que indique el caller (ver buzzer_set_enabled()), o hace una
 * tanda de pulsos rapidos sin alterar ese patron de fondo (ver
 * buzzer_pulse()). Hoy lo usa mqtt/mqtt_telemetry.c para la alarma sonora
 * y como confirmacion de recepcion de un mensaje de configuracion, pero el
 * modulo no conoce esa semantica: solo sabe sonar, pulsar o quedarse en
 * silencio. Corre en su propia tarea FreeRTOS para no interferir con el
 * loop principal de lectura del sensor (ESP32.c) ni con el cliente MQTT.
 * Misma estructura que led_alarm (ver led_alarm.c).
 */

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#include "buzzer.h"

#define BUZZER_GPIO GPIO_NUM_32
#define BUZZER_IDLE_POLL_MS 200

static TaskHandle_t s_task_handle = NULL;

static volatile bool s_enabled = false;
static volatile uint32_t s_on_ms = 0;
static volatile uint32_t s_off_ms = 0;

static volatile bool s_pulse_pending = false;
static volatile uint8_t s_pulse_count = 0;
static volatile uint32_t s_pulse_on_ms = 0;
static volatile uint32_t s_pulse_off_ms = 0;

// Espera hasta ms_delay, o hasta que buzzer_set_enabled()/buzzer_pulse()
// despierten la tarea antes via xTaskNotifyGive(). Devuelve true si la
// espera se completo sin interrupcion (para que el loop principal sepa si
// debe seguir con el tramo actual o reevaluar desde el inicio).
static bool wait_or_notified(uint32_t ms)
{
    return ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(ms)) == 0;
}

// Tanda de pulsos rapidos (buzzer_pulse()): no mira s_enabled, siempre
// hace exactamente lo que se le pidio y luego retoma el patron de fondo.
static void run_pulse(void)
{
    s_pulse_pending = false;
    uint8_t count = s_pulse_count;
    uint32_t on_ms = s_pulse_on_ms;
    uint32_t off_ms = s_pulse_off_ms;

    for (uint8_t i = 0; i < count; i++)
    {
        gpio_set_level(BUZZER_GPIO, 1);
        vTaskDelay(pdMS_TO_TICKS(on_ms));
        gpio_set_level(BUZZER_GPIO, 0);
        vTaskDelay(pdMS_TO_TICKS(off_ms));
    }
}

// Patron de fondo (buzzer_set_enabled()) cuando no hay un pulso pendiente:
// suena con s_on_ms/s_off_ms mientras s_enabled este activo, o se
// mantiene en silencio. Usa wait_or_notified() en vez de vTaskDelay para
// que un pulso pueda interrumpir un tramo largo (hasta varios segundos)
// de inmediato en vez de esperar a que termine.
static void buzzer_task(void *arg)
{
    (void)arg;

    while (1)
    {
        if (s_pulse_pending)
        {
            run_pulse();
            continue;
        }

        if (!s_enabled)
        {
            gpio_set_level(BUZZER_GPIO, 0);
            wait_or_notified(BUZZER_IDLE_POLL_MS);
            continue;
        }

        gpio_set_level(BUZZER_GPIO, 0);
        if (!wait_or_notified(s_off_ms))
        {
            continue;
        }

        gpio_set_level(BUZZER_GPIO, 1);
        wait_or_notified(s_on_ms);
    }
}

esp_err_t buzzer_init(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = 1ULL << BUZZER_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK)
    {
        printf("ERROR configurando GPIO%d como salida: %s\n", BUZZER_GPIO, esp_err_to_name(err));
        return err;
    }
    gpio_set_level(BUZZER_GPIO, 0);

    BaseType_t ok = xTaskCreate(buzzer_task, "buzzer", 2048, NULL, tskIDLE_PRIORITY + 1, &s_task_handle);
    if (ok != pdPASS)
    {
        printf("ERROR creando la tarea del buzzer\n");
        return ESP_FAIL;
    }

    return ESP_OK;
}

void buzzer_set_enabled(bool enabled, uint32_t on_ms, uint32_t off_ms)
{
    if (enabled != s_enabled || on_ms != s_on_ms || off_ms != s_off_ms)
    {
        printf("Buzzer GPIO%d: %s (on=%ums, off=%ums)\n", BUZZER_GPIO,
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

void buzzer_pulse(uint8_t count, uint32_t on_ms, uint32_t off_ms)
{
    printf("Buzzer GPIO%d: pulso de confirmacion x%u (on=%ums, off=%ums)\n",
           BUZZER_GPIO, (unsigned)count, (unsigned)on_ms, (unsigned)off_ms);

    s_pulse_count = count;
    s_pulse_on_ms = on_ms;
    s_pulse_off_ms = off_ms;
    s_pulse_pending = true;

    if (s_task_handle != NULL)
    {
        xTaskNotifyGive(s_task_handle);
    }
}
