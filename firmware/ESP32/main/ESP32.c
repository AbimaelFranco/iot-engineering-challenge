/*
 * Nodo A: lectura de temperatura y humedad con un sensor AHT10 por I2C
 * (ESP32), publicadas por MQTT (TLS) a HiveMQ Cloud siguiendo la
 * estructura de topics definida en Documentation/README.md.
 *
 * I2C:   SDA = GPIO21, SCL = GPIO22
 * AHT10: dirección 0x38
 *
 * Credenciales de WiFi y del broker MQTT en "secrets.h" (no versionado,
 * ver .gitignore). Plantilla de referencia: "secrets.example.h".
 */

#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <time.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "driver/i2c_master.h"
#include "esp_err.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "nvs_flash.h"
#include "mqtt_client.h"
#include "esp_crt_bundle.h"
#include "cJSON.h"

#include "secrets.h"

#define I2C_PORT I2C_NUM_0
#define I2C_SDA_GPIO 21
#define I2C_SCL_GPIO 22
#define I2C_FREQ_HZ 100000
#define I2C_TIMEOUT_MS 100

#define AHT10_ADDR 0x38
#define AHT10_CMD_INIT 0xE1
#define AHT10_CMD_MEASURE 0xAC
#define AHT10_STATUS_BUSY 0x80
#define AHT10_STATUS_CAL 0x08
#define AHT10_POWERON_MS 40
#define AHT10_MEASURE_MS 80

#define READ_PERIOD_MS 5000

// WiFi: bits del event group usados para esperar el resultado de conexión
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1
#define WIFI_MAX_RETRY 5

// MQTT: parámetros de conexión del Nodo A (ver tabla en Documentation/README.md)
#define MQTT_CLIENT_ID "nodo-a"
#define MQTT_KEEPALIVE_S 15
#define MQTT_TOPIC_TELEMETRIA "iot-challenge/telemetria/nodo-a"
#define MQTT_TELEMETRIA_QOS 0
#define MQTT_TELEMETRIA_RETAIN 1

static i2c_master_dev_handle_t s_aht10;

static EventGroupHandle_t s_wifi_event_group;
static int s_wifi_retry_num = 0;

static esp_mqtt_client_handle_t s_mqtt_client = NULL;
static volatile bool s_mqtt_connected = false;

// Crea el bus I2C en los pines definidos y parametriza el AHT10
static esp_err_t i2c_init(void)
{
    // Configuración del bus: pines SDA/SCL, reloj y pull-ups internos
    i2c_master_bus_config_t bus_cfg = {
        .i2c_port = I2C_PORT,
        .sda_io_num = I2C_SDA_GPIO,
        .scl_io_num = I2C_SCL_GPIO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };

    // Crea el bus físico con la configuración anterior.
    i2c_master_bus_handle_t bus;
    esp_err_t err = i2c_new_master_bus(&bus_cfg, &bus);
    if (err != ESP_OK)
    {
        printf("ERROR creando bus I2C: %s\n", esp_err_to_name(err));
        return err;
    }

    // Configuración del AHT10 como dispositivo dentro del bus: su dirección
    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = AHT10_ADDR,
        .scl_speed_hz = I2C_FREQ_HZ,
    };

    // Registra el AHT10 en el bus y guarda su handle en la variable global
    // s_aht10, usada luego por aht10_init() y aht10_read().
    err = i2c_master_bus_add_device(bus, &dev_cfg, &s_aht10);
    if (err != ESP_OK)
    {
        printf("ERROR agregando AHT10 al bus: %s\n", esp_err_to_name(err));
        return err;
    }

    printf("I2C inicializado, AHT10 en 0x%02X\n", AHT10_ADDR);
    return ESP_OK;
}

// Inicialización del sensor despues de arrancar: espera su tiempo de encendido,
// le envía el comando de inicialización y comprueba si esta calibrado.
static esp_err_t aht10_init(void)
{
    // El AHT10 necesita este tiempo mínimo después de energizarse antes
    // de aceptar cualquier comando por I2C.
    vTaskDelay(pdMS_TO_TICKS(AHT10_POWERON_MS));

    // Comando INIT: 0xE1 = inicializar, 0x08 = usar calibración de fábrica,
    // 0x00 = byte reservado (sin uso, siempre 0).
    const uint8_t cmd[] = {AHT10_CMD_INIT, 0x08, 0x00};
    esp_err_t err = i2c_master_transmit(s_aht10, cmd, sizeof(cmd), I2C_TIMEOUT_MS);
    if (err != ESP_OK)
    {
        printf("ERROR enviando INIT: %s\n", esp_err_to_name(err));
        return err;
    }

    // Tiempo que tarda el sensor en procesar el comando INIT.
    vTaskDelay(pdMS_TO_TICKS(AHT10_MEASURE_MS));

    // Lee 1 byte de estado del sensor para verificar cómo quedó tras el INIT.
    uint8_t status = 0;
    err = i2c_master_receive(s_aht10, &status, 1, I2C_TIMEOUT_MS);
    if (err != ESP_OK)
    {
        printf("ERROR leyendo STATUS: %s\n", esp_err_to_name(err));
        return err;
    }

    // El bit AHT10_STATUS_CAL (0x08) indica si el sensor cargó su
    // calibración de fábrica correctamente.
    printf("AHT10 STATUS = 0x%02X (%s)\n", status,
           (status & AHT10_STATUS_CAL) ? "calibrado" : "sin calibrar");

    return ESP_OK;
}

// Dispara una medición en el AHT10, espera el resultado y lo convierte a
// unidades reales. Escribe el resultado en los punteros recibidos.
static esp_err_t aht10_read(float *temperature, float *humidity)
{
    // Comando MEASURE: 0xAC = iniciar medición, 0x33 y 0x00 = parámetros
    // fijos exigidos por el datasheet del sensor.
    const uint8_t cmd[] = {AHT10_CMD_MEASURE, 0x33, 0x00};
    esp_err_t err = i2c_master_transmit(s_aht10, cmd, sizeof(cmd), I2C_TIMEOUT_MS);
    if (err != ESP_OK)
    {
        return err;
    }

    // Tiempo que tarda el sensor en completar la medición.
    vTaskDelay(pdMS_TO_TICKS(AHT10_MEASURE_MS));

    // Respuesta de 6 bytes del sensor:
    //   data[0]     = status
    //   data[1..2]  = humedad (bits altos)
    //   data[3]     = 4 bits altos de humedad + 4 bits altos de temperatura
    //   data[4..5]  = temperatura (bits bajos)
    uint8_t data[6] = {0};
    err = i2c_master_receive(s_aht10, data, sizeof(data), I2C_TIMEOUT_MS);
    if (err != ESP_OK)
    {
        return err;
    }

    // Si el bit BUSY sigue activo, el sensor no terminó de medir todavía
    // y los datos recibidos no son válidos.
    if (data[0] & AHT10_STATUS_BUSY)
    {
        return ESP_ERR_INVALID_STATE;
    }

    // Reconstruye el valor crudo de humedad (20 bits) juntando los bytes
    // correspondientes con corrimientos de bits (<<) según su posición.
    uint32_t raw_humidity = ((uint32_t)data[1] << 12) |
                            ((uint32_t)data[2] << 4) |
                            ((uint32_t)data[3] >> 4);

    // Reconstruye el valor crudo de temperatura (20 bits) de la misma forma,
    // tomando los 4 bits bajos de data[3] como los bits altos del valor.
    uint32_t raw_temperature = ((uint32_t)(data[3] & 0x0F) << 16) |
                               ((uint32_t)data[4] << 8) |
                               data[5];

    // Fórmulas de conversión del datasheet AHT10 (2^20 = 1048576):
    //   Humedad (%)     = RAW / 2^20 * 100
    //   Temperatura (C) = RAW / 2^20 * 200 - 50
    *humidity = (float)raw_humidity * 100.0f / 1048576.0f;
    *temperature = (float)raw_temperature * 200.0f / 1048576.0f - 50.0f;

    return ESP_OK;
}

// Maneja los eventos de WiFi/IP durante la conexión: reintenta al
// desconectarse y libera el event group cuando obtiene IP o agota
// los reintentos.
static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        if (s_wifi_retry_num < WIFI_MAX_RETRY)
        {
            s_wifi_retry_num++;
            printf("WiFi desconectado, reintentando (%d/%d)...\n", s_wifi_retry_num, WIFI_MAX_RETRY);
            esp_wifi_connect();
        }
        else
        {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
        }
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        printf("WiFi conectado, IP: " IPSTR "\n", IP2STR(&event->ip_info.ip));
        s_wifi_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

// Inicializa NVS, la pila de red y el WiFi en modo estación, y bloquea
// hasta obtener IP (o agotar los reintentos de conexión).
static esp_err_t wifi_init_sta(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    printf("Conectando a WiFi SSID: %s...\n", WIFI_SSID);

    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
                                           pdFALSE, pdFALSE, portMAX_DELAY);

    return (bits & WIFI_CONNECTED_BIT) ? ESP_OK : ESP_FAIL;
}

// Sincroniza la hora por SNTP para que el campo "ts" de la telemetría
// sea un timestamp unix real y no el tiempo desde el arranque. Si no
// logra sincronizar solo lo advierte: no es razón para abortar.
static void time_sync_init(void)
{
    printf("Sincronizando hora por SNTP...\n");

    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    esp_netif_sntp_init(&config);

    if (esp_netif_sntp_sync_wait(pdMS_TO_TICKS(10000)) != ESP_OK)
    {
        printf("ADVERTENCIA: no se pudo sincronizar la hora, 'ts' puede ser incorrecto.\n");
    }
    else
    {
        printf("Hora sincronizada.\n");
    }
}

// Maneja los eventos del cliente MQTT. De momento solo trackea el
// estado de conexión, usado por mqtt_publish_telemetria() para no
// intentar publicar mientras está desconectado.
static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    (void)handler_args;
    (void)base;

    switch ((esp_mqtt_event_id_t)event_id)
    {
    case MQTT_EVENT_CONNECTED:
        s_mqtt_connected = true;
        printf("MQTT conectado a HiveMQ (client_id=%s)\n", MQTT_CLIENT_ID);
        break;
    case MQTT_EVENT_DISCONNECTED:
        s_mqtt_connected = false;
        printf("MQTT desconectado\n");
        break;
    case MQTT_EVENT_ERROR:
        printf("MQTT ERROR\n");
        break;
    default:
        break;
    }
}

// Configura y arranca el cliente MQTT (TLS + usuario/password) contra
// HiveMQ Cloud, con los parámetros de conexión del Nodo A definidos en
// Documentation/README.md (client_id, keepalive, clean_session).
static esp_err_t mqtt_init(void)
{
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URL,
        .broker.verification.crt_bundle_attach = esp_crt_bundle_attach,
        .credentials.client_id = MQTT_CLIENT_ID,
        .credentials.username = MQTT_USERNAME,
        .credentials.authentication.password = MQTT_PASSWORD,
        .session.keepalive = MQTT_KEEPALIVE_S,
        .session.disable_clean_session = false,
    };

    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    if (s_mqtt_client == NULL)
    {
        printf("ERROR creando cliente MQTT\n");
        return ESP_FAIL;
    }

    esp_err_t err = esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    if (err != ESP_OK)
    {
        printf("ERROR registrando eventos MQTT: %s\n", esp_err_to_name(err));
        return err;
    }

    err = esp_mqtt_client_start(s_mqtt_client);
    if (err != ESP_OK)
    {
        printf("ERROR iniciando cliente MQTT: %s\n", esp_err_to_name(err));
        return err;
    }

    printf("Cliente MQTT iniciado, conectando a %s...\n", MQTT_BROKER_URL);
    return ESP_OK;
}

// Arma el payload JSON de telemetría (ver formato de mensajes en
// Documentation/README.md) y lo publica en iot-challenge/telemetria/nodo-a.
// Por ahora solo van los campos de sensor (temp/hum); actuator/mode/setpoint
// se agregarán cuando el nodo controle un actuador.
static esp_err_t mqtt_publish_telemetria(float temperature, float humidity, uint32_t seq)
{
    if (!s_mqtt_connected)
    {
        return ESP_ERR_INVALID_STATE;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "ts", (double)time(NULL));
    cJSON_AddNumberToObject(root, "temp", temperature);
    cJSON_AddNumberToObject(root, "hum", humidity);
    cJSON_AddNumberToObject(root, "sample_ms", READ_PERIOD_MS);
    cJSON_AddNumberToObject(root, "seq", seq);

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == NULL)
    {
        return ESP_ERR_NO_MEM;
    }

    int msg_id = esp_mqtt_client_publish(s_mqtt_client, MQTT_TOPIC_TELEMETRIA, payload, 0,
                                         MQTT_TELEMETRIA_QOS, MQTT_TELEMETRIA_RETAIN);
    printf("Publicado en %s (msg_id=%d): %s\n", MQTT_TOPIC_TELEMETRIA, msg_id, payload);

    free(payload);
    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}

// Codigo principal. Conecta WiFi y MQTT, inicializa el bus I2C y el
// sensor, y luego entra en un bucle infinito leyendo temperatura/humedad
// y publicándola por MQTT cada 5 segundos.
void app_main(void)
{
    printf("\n=== NODO A - AHT10 + MQTT ===\n\n");

    // Sin WiFi no hay forma de llegar al broker: si falla, se aborta.
    if (wifi_init_sta() != ESP_OK)
    {
        printf("No se pudo conectar a la red WiFi.\n");
        return;
    }

    // No es fatal si falla: seguimos, pero el campo "ts" de la telemetría
    // quedará con el tiempo desde el arranque en vez de un timestamp real.
    time_sync_init();

    // Sin cliente MQTT no hay forma de publicar telemetría: si falla, se aborta.
    if (mqtt_init() != ESP_OK)
    {
        printf("No se pudo inicializar el cliente MQTT.\n");
        return;
    }

    // Sin bus I2C no hay forma de hablar con el sensor: si falla, se aborta.
    if (i2c_init() != ESP_OK)
    {
        printf("No se pudo inicializar I2C.\n");
        return;
    }

    // Si la inicialización del sensor falla solo se avisa por consola,
    // ya que el AHT10 puede seguir respondiendo a lecturas de todas formas.
    if (aht10_init() != ESP_OK)
    {
        printf("ERROR inicializando AHT10, se continuara intentando medir.\n");
    }

    printf("\nComenzando lecturas...\n\n");

    uint32_t seq = 0;

    // Bucle principal: lee, imprime el resultado (o el error), publica por
    // MQTT si la lectura fue válida, y espera antes de la siguiente medición.
    while (1)
    {
        float temperature = 0.0f;
        float humidity = 0.0f;

        esp_err_t err = aht10_read(&temperature, &humidity);
        if (err == ESP_OK)
        {
            printf("Temperatura: %.2f C | Humedad: %.2f %%\n", temperature, humidity);

            err = mqtt_publish_telemetria(temperature, humidity, seq++);
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
