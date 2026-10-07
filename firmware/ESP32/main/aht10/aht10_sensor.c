/*
 * I2C:   SDA = GPIO21, SCL = GPIO22
 * AHT10: dirección definida por nodo en secrets.h (AHT10_I2C_ADDR)
 */

#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "esp_err.h"

#include "secrets.h"
#include "aht10_sensor.h"

#define I2C_PORT I2C_NUM_0
#define I2C_SDA_GPIO 21
#define I2C_SCL_GPIO 22
#define I2C_FREQ_HZ 100000
#define I2C_TIMEOUT_MS 100

#define AHT10_ADDR AHT10_I2C_ADDR
#define AHT10_CMD_INIT 0xE1
#define AHT10_CMD_MEASURE 0xAC
#define AHT10_STATUS_BUSY 0x80
#define AHT10_STATUS_CAL 0x08
#define AHT10_POWERON_MS 40
#define AHT10_MEASURE_MS 80

static i2c_master_dev_handle_t s_aht10;

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
    // s_aht10, usada luego por i2c_init()/aht10_send_init()/aht10_sensor_read().
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
static esp_err_t aht10_send_init(void)
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

esp_err_t aht10_sensor_init(void)
{
    esp_err_t err = i2c_init();
    if (err != ESP_OK)
    {
        return err;
    }

    // Si la inicialización del sensor falla solo se avisa por consola,
    // ya que el AHT10 puede seguir respondiendo a lecturas de todas formas.
    if (aht10_send_init() != ESP_OK)
    {
        printf("ERROR inicializando AHT10, se continuara intentando medir.\n");
    }

    return ESP_OK;
}

esp_err_t aht10_sensor_read(float *temperature, float *humidity)
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
