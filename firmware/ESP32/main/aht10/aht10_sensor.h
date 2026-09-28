#pragma once

#include "esp_err.h"

// Inicializa el bus I2C y el sensor AHT10. Si el bus I2C no pudo crearse
// se considera fatal y se propaga el error; si solo falla la calibración
// del sensor, se avisa por consola pero no se aborta (puede seguir
// respondiendo a lecturas de todas formas).
esp_err_t aht10_sensor_init(void);

// Dispara una medición en el AHT10, espera el resultado y lo convierte a
// unidades reales. Escribe el resultado en los punteros recibidos.
esp_err_t aht10_sensor_read(float *temperature, float *humidity);
