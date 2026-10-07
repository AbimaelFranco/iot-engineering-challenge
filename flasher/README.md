# Quemador ESP32

GUI de escritorio (Tkinter, sin dependencias externas) para grabar
`firmware/ESP32/main/secrets.h` segun el nodo elegido y flashear el
firmware a un ESP32 conectado por USB, sin tocar la terminal.

## Uso

1. Doble clic en `Quemador.bat` (o `python burner.py` desde esta carpeta).
2. Elige **Nodo A** o **Nodo B**.
3. Elige el puerto COM (boton "Detectar puertos" lo autocompleta) y, si
   hace falta, el entorno de ESP-IDF a usar (se detectan automaticamente
   las instalaciones hechas con el instalador oficial de Espressif; si no
   se encuentra ninguna, se puede elegir manualmente el script
   `Microsoft.<version>.PowerShell_profile.ps1`).
4. Clic en **Quemar ESP32**: escribe `secrets.h` con los valores de
   `nodes/nodo_a.txt` o `nodes/nodo_b.txt` y corre
   `idf.py -C firmware/ESP32 -p COMx flash` dentro del venv de ESP-IDF.

Botones adicionales: **Solo compilar** (build sin flashear, no requiere el
ESP32 conectado), **Solo monitor** (abre el monitor serial sin tocar
`secrets.h`) y **Detener** (mata el proceso en curso).

## Configurar los nodos

Los valores reales de cada nodo viven en `nodes/nodo_a.txt` y
`nodes/nodo_b.txt`, que **no se suben al repositorio** (igual que
`secrets.h`). Si no existen, copia las plantillas:

```
nodes/nodo_a.example.txt -> nodes/nodo_a.txt
nodes/nodo_b.example.txt -> nodes/nodo_b.txt
```

y completa los valores reales (ver los comentarios de cada plantilla y
`firmware/ESP32/main/secrets.example.h` para el detalle de cada campo).

`flasher_config.json` (tambien ignorado por git) guarda el ultimo puerto,
nodo y entorno de ESP-IDF usados, solo para comodidad local.
