/*
 * Pulsador de emergencia en GPIO25 (pull-down externo: en reposo el pin
 * queda en 0, al presionar sube a 1). A diferencia de led_alarm/buzzer/fan
 * (que sondean su patron de fondo en un loop propio), este modulo detecta
 * la pulsacion por interrupcion (flanco ascendente) y, ante cada una,
 * manda "paro de emergencia" al otro nodo por ESP-NOW (ver
 * espnow_send_emergency_stop() en espnow/espnow.c); es el OTRO nodo quien,
 * al recibir ese mensaje, hace sonar su buzzer local (ver
 * espnow_recv_cb() en espnow/espnow.c) - y viceversa. La ISR no hace mas
 * que notificar a una tarea propia: nunca llama a espnow_send_emergency_stop()
 * ni hace otro trabajo directamente dentro de la interrupcion. Esa tarea
 * tambien resuelve el antirrebote, ignorando pulsaciones nuevas durante
 * EMERGENCY_BUTTON_DEBOUNCE_MS despues de disparar.
 */

#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#include "emergency_button.h"
#include "buzzer/buzzer.h"
#include "espnow/espnow.h"

#define EMERGENCY_BUTTON_GPIO GPIO_NUM_25
#define EMERGENCY_BUTTON_DEBOUNCE_MS 300

#define EMERGENCY_BUTTON_PULSE_COUNT 5
#define EMERGENCY_BUTTON_PULSE_ON_MS 100
#define EMERGENCY_BUTTON_PULSE_OFF_MS 100

static TaskHandle_t s_task_handle = NULL;

// Corre con las interrupciones de flash deshabilitadas: debe quedar en
// IRAM y limitarse a despertar la tarea, nada de I/O ni logica aqui.
static void IRAM_ATTR emergency_button_isr_handler(void *arg)
{
    (void)arg;

    BaseType_t higher_priority_task_woken = pdFALSE;
    vTaskNotifyGiveFromISR(s_task_handle, &higher_priority_task_woken);
    portYIELD_FROM_ISR(higher_priority_task_woken);
}

// Espera cada pulsacion notificada por la ISR y manda el aviso de "paro
// de emergencia" al otro nodo por ESP-NOW. Tras disparar, espera
// EMERGENCY_BUTTON_DEBOUNCE_MS y descarta cualquier notificacion que
// haya llegado durante ese lapso (rebotes del pulsador) antes de volver
// a esperar la proxima pulsacion.
static void emergency_button_task(void *arg)
{
    (void)arg;

    while (1)
    {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        printf("Pulsador de emergencia GPIO%d: pulsacion detectada, enviando \"paro de emergencia\" por ESP-NOW\n",
               EMERGENCY_BUTTON_GPIO);
        espnow_send_emergency_stop();

        // Ya no suena el buzzer local al presionar este boton: ahora el
        // aviso viaja por ESP-NOW y es el OTRO nodo el que suena su
        // buzzer al recibirlo (ver espnow_recv_cb() en espnow/espnow.c).
        // buzzer_pulse(EMERGENCY_BUTTON_PULSE_COUNT, EMERGENCY_BUTTON_PULSE_ON_MS, EMERGENCY_BUTTON_PULSE_OFF_MS);

        vTaskDelay(pdMS_TO_TICKS(EMERGENCY_BUTTON_DEBOUNCE_MS));
        ulTaskNotifyTake(pdTRUE, 0);
    }
}

esp_err_t emergency_button_init(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = 1ULL << EMERGENCY_BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_POSEDGE,
    };
    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK)
    {
        printf("ERROR configurando GPIO%d como entrada: %s\n", EMERGENCY_BUTTON_GPIO, esp_err_to_name(err));
        return err;
    }

    // La tarea debe existir antes de habilitar la interrupcion: la ISR
    // notifica a s_task_handle apenas se registra con gpio_isr_handler_add().
    BaseType_t ok = xTaskCreate(emergency_button_task, "emergency_button", 2048, NULL,
                                tskIDLE_PRIORITY + 1, &s_task_handle);
    if (ok != pdPASS)
    {
        printf("ERROR creando la tarea del pulsador de emergencia\n");
        return ESP_FAIL;
    }

    err = gpio_install_isr_service(0);
    if (err != ESP_OK)
    {
        printf("ERROR instalando el servicio de interrupciones GPIO: %s\n", esp_err_to_name(err));
        return err;
    }

    err = gpio_isr_handler_add(EMERGENCY_BUTTON_GPIO, emergency_button_isr_handler, NULL);
    if (err != ESP_OK)
    {
        printf("ERROR registrando la interrupcion en GPIO%d: %s\n", EMERGENCY_BUTTON_GPIO, esp_err_to_name(err));
        return err;
    }

    return ESP_OK;
}
