/*
 * Conexión WiFi + cliente MQTT (TLS) de este nodo hacia HiveMQ Cloud, y
 * publicación de telemetría del AHT10 siguiendo la estructura de topics
 * definida en Documentation/README.md.
 *
 * Credenciales de WiFi/broker e identidad del nodo (NODE_ID) en
 * "secrets.h" (no versionado, ver .gitignore). Plantilla de referencia:
 * "secrets.example.h".
 */

#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <time.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
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
#include "mqtt_telemetry.h"

// WiFi: bits del event group usados para esperar el resultado de conexión
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1
#define WIFI_MAX_RETRY 5

// MQTT: parámetros de conexión del nodo (ver tabla en Documentation/README.md).
// MQTT_CLIENT_ID y los topics se arman a partir de NODE_ID (secrets.h) por
// concatenación de strings adyacentes: cambiar de Nodo A a Nodo B es
// cuestión de cambiar un solo #define, no de tocar este archivo.
#define MQTT_CLIENT_ID NODE_ID
#define MQTT_KEEPALIVE_S 15
#define MQTT_TOPIC_TELEMETRIA "iot-challenge/telemetria/" NODE_ID
#define MQTT_TELEMETRIA_QOS 0
#define MQTT_TELEMETRIA_RETAIN 1
#define MQTT_TOPIC_ESTATUS "iot-challenge/status/" NODE_ID
#define MQTT_ESTATUS_RETAIN 1
#define MQTT_ESTATUS_QOS 1

static EventGroupHandle_t s_wifi_event_group;
static int s_wifi_retry_num = 0;

static esp_mqtt_client_handle_t s_mqtt_client = NULL;
static volatile bool s_mqtt_connected = false;

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
// estado de conexión, usado por mqtt_telemetry_publish() para no
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
        mqtt_estatus_publish();
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
// HiveMQ Cloud, con los parámetros de conexión del nodo (NODE_ID en
// secrets.h) según Documentation/README.md (client_id, keepalive,
// clean_session).
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
        .session.last_will.topic = MQTT_TOPIC_ESTATUS,
        .session.last_will.msg = "{\"state\":\"offline\"}",
        .session.last_will.retain = MQTT_ESTATUS_RETAIN,
        .session.last_will.qos = MQTT_ESTATUS_QOS,
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

esp_err_t mqtt_telemetry_init(void)
{
    // Sin WiFi no hay forma de llegar al broker: si falla, se propaga el error.
    esp_err_t err = wifi_init_sta();
    if (err != ESP_OK)
    {
        return err;
    }

    // No es fatal si falla: seguimos, pero el campo "ts" de la telemetría
    // quedará con el tiempo desde el arranque en vez de un timestamp real.
    time_sync_init();

    return mqtt_init();
}

esp_err_t mqtt_telemetry_publish(float temperature, float humidity, uint32_t sample_ms, uint32_t seq)
{
    if (!s_mqtt_connected)
    {
        return ESP_ERR_INVALID_STATE;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "ts", (double)time(NULL));
    cJSON_AddNumberToObject(root, "temp", temperature);
    cJSON_AddNumberToObject(root, "hum", humidity);
    cJSON_AddNumberToObject(root, "sample_ms", sample_ms);
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

esp_err_t mqtt_estatus_publish(void)
{
    if (!s_mqtt_connected)
    {
        return ESP_ERR_INVALID_STATE;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "ts", (double)time(NULL));
    cJSON_AddStringToObject(root, "state", "online");

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == NULL)
    {
        return ESP_ERR_NO_MEM;
    }

    int msg_id = esp_mqtt_client_publish(s_mqtt_client, MQTT_TOPIC_ESTATUS, payload, 0,
                                         MQTT_ESTATUS_QOS, MQTT_ESTATUS_RETAIN);
    printf("Publicado en %s (msg_id=%d): %s\n", MQTT_TOPIC_ESTATUS, msg_id, payload);

    free(payload);
    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}
