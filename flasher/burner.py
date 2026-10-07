"""
Quemador ESP32: GUI de escritorio (Tkinter, sin dependencias externas) que
escribe firmware/ESP32/main/secrets.h a partir de flasher/nodes/nodo_a.txt o
nodo_b.txt, y luego compila/flashea con idf.py dentro del entorno de
ESP-IDF instalado por el "EIM" (ESP-IDF Installation Manager) de Espressif.

Uso: python burner.py  (o doble clic en Quemador.bat)
"""

import json
import os
import queue
import re
import subprocess
import threading
import tkinter as tk
import winreg
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
FIRMWARE_DIR = REPO_ROOT / "firmware" / "ESP32"
SECRETS_PATH = FIRMWARE_DIR / "main" / "secrets.h"
NODES_DIR = SCRIPT_DIR / "nodes"
CONFIG_PATH = SCRIPT_DIR / "flasher_config.json"
EIM_JSON_PATH = Path(r"C:\Espressif\tools\eim_idf.json")

REQUIRED_KEYS = [
    "NODE_ID",
    "AHT10_I2C_ADDR",
    "WIFI_SSID",
    "WIFI_PASSWORD",
    "WIFI_CHANNEL",
    "MQTT_BROKER_URL",
    "MQTT_USERNAME",
    "MQTT_PASSWORD",
    "NODE_A_MAC",
    "NODE_B_MAC",
]

MAC_RE = re.compile(r"^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$")

SECRETS_TEMPLATE = """#pragma once

/*
 * Credenciales e identidad reales de este nodo fisico (WiFi + MQTT + sensor).
 * GENERADO AUTOMATICAMENTE por flasher/burner.py a partir de
 * flasher/nodes/{source_file}. No edites este archivo a mano: se sobreescribe
 * en el siguiente flasheo. Para cambiar valores, edita el .txt del nodo.
 * Plantilla de referencia (con el detalle de cada campo): secrets.example.h
 * Este archivo no se sube al repositorio (ver .gitignore).
 */

#define NODE_ID "{NODE_ID}"
#define AHT10_I2C_ADDR {AHT10_I2C_ADDR}

#define WIFI_SSID "{WIFI_SSID}"
#define WIFI_PASSWORD "{WIFI_PASSWORD}"
#define WIFI_CHANNEL {WIFI_CHANNEL}

#define MQTT_BROKER_URL "{MQTT_BROKER_URL}"
#define MQTT_USERNAME "{MQTT_USERNAME}"
#define MQTT_PASSWORD "{MQTT_PASSWORD}"

#define NODE_A_MAC {NODE_A_MAC}
#define NODE_B_MAC {NODE_B_MAC}
"""


def parse_node_file(path: Path) -> dict:
    if not path.exists():
        raise ValueError(
            f"No existe {path.name} en flasher/nodes/.\n"
            f"Copia {path.stem}.example.txt como {path.name} y completa los valores reales."
        )

    values = {}
    for lineno, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"{path.name}:{lineno}: linea invalida (se esperaba CLAVE=valor): {raw_line!r}")
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()

    missing = [key for key in REQUIRED_KEYS if key not in values or not values[key]]
    if missing:
        raise ValueError(f"{path.name}: faltan valores para: {', '.join(missing)}")

    return values


def mac_to_c_array(mac: str, field_name: str) -> str:
    if not MAC_RE.match(mac):
        raise ValueError(f"{field_name}={mac!r} no tiene formato de MAC valido (ej. 04:B2:47:06:14:8C)")
    bytes_hex = re.split("[:-]", mac)
    return "{" + ", ".join(f"0x{b.upper()}" for b in bytes_hex) + "}"


def validate_channel(channel: str) -> str:
    if not channel.isdigit() or not (1 <= int(channel) <= 13):
        raise ValueError(f"WIFI_CHANNEL={channel!r} debe ser un numero entero entre 1 y 13")
    return channel


def build_secrets_content(values: dict, source_file: str) -> str:
    rendered = dict(values)
    rendered["NODE_A_MAC"] = mac_to_c_array(values["NODE_A_MAC"], "NODE_A_MAC")
    rendered["NODE_B_MAC"] = mac_to_c_array(values["NODE_B_MAC"], "NODE_B_MAC")
    rendered["WIFI_CHANNEL"] = validate_channel(values["WIFI_CHANNEL"])
    rendered["source_file"] = source_file
    return SECRETS_TEMPLATE.format(**rendered)


def write_secrets_for_node(node_key: str) -> str:
    node_file = NODES_DIR / f"nodo_{node_key}.txt"
    values = parse_node_file(node_file)
    content = build_secrets_content(values, node_file.name)
    SECRETS_PATH.write_text(content, encoding="utf-8")
    return values["NODE_ID"]


def list_serial_ports() -> list:
    # Sin pyserial: los puertos COM activos quedan mapeados en este registro.
    ports = []
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DEVICEMAP\SERIALCOMM")
    except OSError:
        return ports
    i = 0
    while True:
        try:
            _, value, _ = winreg.EnumValue(key, i)
        except OSError:
            break
        ports.append(value)
        i += 1
    return sorted(ports)


def find_idf_installs() -> dict:
    # Instalaciones hechas con el EIM (ESP-IDF Installation Manager) de
    # Espressif; cada una trae su propio script de activacion de PowerShell
    # y su propio venv de Python. Si el archivo no existe (otra maquina,
    # instalacion manual, etc.) se devuelve vacio y la GUI deja elegir el
    # script a mano.
    installs = {}
    if not EIM_JSON_PATH.exists():
        return installs
    try:
        data = json.loads(EIM_JSON_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return installs
    for entry in data.get("idfInstalled", []):
        name = entry.get("name")
        script = entry.get("activationScript")
        if name and script and Path(script).exists():
            installs[name] = {"activation_script": script, "python": entry.get("python")}
    return installs


def get_build_cache_python(build_dir: Path) -> str | None:
    # El proyecto (CMake) recuerda con que interprete de Python se configuro
    # la carpeta build/; si se flashea con OTRO entorno de ESP-IDF sin volver
    # a configurar, idf.py avisa y puede mezclar binarios incompatibles.
    cache_file = build_dir / "CMakeCache.txt"
    if not cache_file.exists():
        return None
    try:
        text = cache_file.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    match = re.search(r"^PYTHON:[A-Za-z]+=(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else None


def same_path(a: str, b: str) -> bool:
    try:
        return Path(a).resolve() == Path(b).resolve()
    except OSError:
        return a.strip().lower() == b.strip().lower()


class BurnerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Quemador ESP32 - IoT Challenge")
        self.root.geometry("760x560")
        self.root.minsize(620, 440)

        self.log_queue = queue.Queue()
        self.proc = None
        self.idf_options = find_idf_installs()

        self.config_data = self._load_config()

        self.node_var = tk.StringVar(value=self.config_data.get("node", "a"))
        self.port_var = tk.StringVar(value=self.config_data.get("port", ""))
        self.monitor_var = tk.BooleanVar(value=self.config_data.get("monitor", False))
        self.idf_var = tk.StringVar()

        self._build_ui()
        self._restore_idf_selection()
        self._refresh_ports(initial=True)

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.after(100, self._poll_log_queue)

    # ---------- UI ----------

    def _build_ui(self):
        pad = {"padx": 8, "pady": 6}

        node_frame = ttk.LabelFrame(self.root, text="Nodo")
        node_frame.pack(fill="x", **pad)
        ttk.Radiobutton(node_frame, text="Nodo A", value="a", variable=self.node_var).pack(side="left", padx=10, pady=6)
        ttk.Radiobutton(node_frame, text="Nodo B", value="b", variable=self.node_var).pack(side="left", padx=10, pady=6)

        conn_frame = ttk.LabelFrame(self.root, text="Conexion")
        conn_frame.pack(fill="x", **pad)

        ttk.Label(conn_frame, text="Puerto COM:").grid(row=0, column=0, padx=8, pady=6, sticky="w")
        self.port_combo = ttk.Combobox(conn_frame, textvariable=self.port_var, width=12)
        self.port_combo.grid(row=0, column=1, padx=4, pady=6, sticky="w")
        ttk.Button(conn_frame, text="Detectar puertos", command=lambda: self._refresh_ports()).grid(row=0, column=2, padx=8, pady=6)

        ttk.Label(conn_frame, text="Entorno ESP-IDF:").grid(row=1, column=0, padx=8, pady=6, sticky="w")
        self.idf_combo = ttk.Combobox(conn_frame, textvariable=self.idf_var, state="readonly", width=28)
        self.idf_combo.grid(row=1, column=1, padx=4, pady=6, sticky="w")
        self.idf_combo.bind("<<ComboboxSelected>>", self._on_idf_selected)
        ttk.Button(conn_frame, text="Elegir script .ps1...", command=self._pick_manual_script).grid(row=1, column=2, padx=8, pady=6)

        ttk.Checkbutton(conn_frame, text="Abrir monitor serial despues de flashear", variable=self.monitor_var).grid(
            row=2, column=0, columnspan=3, padx=8, pady=2, sticky="w"
        )

        actions_frame = ttk.Frame(self.root)
        actions_frame.pack(fill="x", **pad)

        self.flash_btn = ttk.Button(actions_frame, text="Quemar ESP32", command=self._on_flash)
        self.flash_btn.pack(side="left", padx=4)
        self.build_btn = ttk.Button(actions_frame, text="Solo compilar", command=self._on_build)
        self.build_btn.pack(side="left", padx=4)
        self.monitor_btn = ttk.Button(actions_frame, text="Solo monitor", command=self._on_monitor)
        self.monitor_btn.pack(side="left", padx=4)
        self.stop_btn = ttk.Button(actions_frame, text="Detener", command=self._on_stop, state="disabled")
        self.stop_btn.pack(side="left", padx=4)

        self.action_buttons = [self.flash_btn, self.build_btn, self.monitor_btn]

        self.status_var = tk.StringVar(value="Listo.")
        ttk.Label(self.root, textvariable=self.status_var, anchor="w").pack(fill="x", padx=10)

        log_frame = ttk.LabelFrame(self.root, text="Salida")
        log_frame.pack(fill="both", expand=True, **pad)
        self.log_text = tk.Text(log_frame, wrap="none", state="disabled", font=("Consolas", 9))
        y_scroll = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=y_scroll.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        y_scroll.pack(side="right", fill="y")

    def _restore_idf_selection(self):
        names = list(self.idf_options.keys())
        manual_path = self.config_data.get("manual_activation_script")
        if manual_path and Path(manual_path).exists():
            label = f"Manual: {Path(manual_path).name}"
            self.idf_options[label] = {"activation_script": manual_path, "python": None}
            names.append(label)

        self.idf_combo["values"] = names
        if not names:
            self.status_var.set("No se encontro ninguna instalacion de ESP-IDF. Elige el script de activacion (.ps1).")
            return

        # Si firmware/ESP32/build ya esta configurado con un entorno de IDF
        # especifico, preferimos ese para no mezclar binarios de dos venvs.
        cached_python = get_build_cache_python(FIRMWARE_DIR / "build")
        matching = None
        if cached_python:
            for name in names:
                python_path = self.idf_options[name].get("python")
                if python_path and same_path(python_path, cached_python):
                    matching = name
                    break

        last = self.config_data.get("idf_option")
        if matching:
            self.idf_var.set(matching)
            if last and last != matching:
                self.status_var.set(
                    f"Usando entorno '{matching}': es con el que ya esta configurado firmware/ESP32/build."
                )
        elif last in names:
            self.idf_var.set(last)
        else:
            self.idf_var.set(names[0])

    # ---------- Puertos / IDF ----------

    def _refresh_ports(self, initial: bool = False):
        ports = list_serial_ports()
        self.port_combo["values"] = ports
        if not self.port_var.get() and ports:
            self.port_var.set(ports[0])
        elif not initial:
            self.status_var.set(f"Puertos detectados: {', '.join(ports) if ports else '(ninguno)'}")

    def _on_idf_selected(self, _event=None):
        pass

    def _pick_manual_script(self):
        path = filedialog.askopenfilename(
            title="Selecciona el script de activacion de ESP-IDF",
            filetypes=[("Script de PowerShell", "*.ps1"), ("Todos los archivos", "*.*")],
        )
        if not path:
            return
        label = f"Manual: {Path(path).name}"
        self.idf_options[label] = {"activation_script": path, "python": None}
        values = list(self.idf_combo["values"])
        if label not in values:
            values.append(label)
            self.idf_combo["values"] = values
        self.idf_var.set(label)

    # ---------- Acciones ----------

    def _on_flash(self):
        self._run_pipeline(write_secrets=True, idf_args=["flash"])

    def _on_build(self):
        self._run_pipeline(write_secrets=True, idf_args=["build"])

    def _on_monitor(self):
        self._run_pipeline(write_secrets=False, idf_args=["monitor"])

    def _run_pipeline(self, write_secrets: bool, idf_args: list):
        if self.proc is not None:
            messagebox.showwarning("En curso", "Ya hay una operacion en curso.")
            return

        option = self.idf_options.get(self.idf_var.get())
        if not option:
            messagebox.showerror("Falta entorno ESP-IDF", "Selecciona o elige un entorno de ESP-IDF antes de continuar.")
            return
        activation_script = option["activation_script"]

        needs_port = "flash" in idf_args or "monitor" in idf_args
        port = self.port_var.get().strip()
        if needs_port and not port:
            messagebox.showerror("Falta puerto", "Indica el puerto COM del ESP32.")
            return

        prepend_fullclean = False
        if "flash" in idf_args or "build" in idf_args:
            cached_python = get_build_cache_python(FIRMWARE_DIR / "build")
            selected_python = option.get("python")
            if cached_python and selected_python and not same_path(cached_python, selected_python):
                choice = messagebox.askyesnocancel(
                    "Entorno distinto al de la build existente",
                    "firmware/ESP32/build ya esta configurado con otro entorno de ESP-IDF:\n"
                    f"{cached_python}\n\n"
                    f"y elegiste '{self.idf_var.get()}'. Mezclar venvs puede romper la compilacion.\n\n"
                    "Si = limpiar (idf.py fullclean) y reconfigurar con el entorno elegido.\n"
                    "No = continuar igual, sin limpiar (riesgoso).\n"
                    "Cancelar = no hacer nada.",
                )
                if choice is None:
                    return
                prepend_fullclean = choice

        node_key = self.node_var.get()
        if write_secrets:
            try:
                node_id = write_secrets_for_node(node_key)
            except ValueError as exc:
                messagebox.showerror("Error en secrets.h", str(exc))
                return
            self._append_log(f"[flasher] secrets.h escrito para {node_id} (nodo_{node_key}.txt)\n")

        if "flash" in idf_args and self.monitor_var.get():
            idf_args = idf_args + ["monitor"]

        idf_cmd = ["idf.py", "-C", str(FIRMWARE_DIR)]
        if needs_port:
            idf_cmd += ["-p", port]
        idf_cmd += idf_args

        quoted = idf_cmd[0] + " " + " ".join(f'"{part}"' for part in idf_cmd[1:])
        command = f'& "{activation_script}";'
        if prepend_fullclean:
            command += f' idf.py -C "{FIRMWARE_DIR}" fullclean;'
            self._append_log("[flasher] idf.py fullclean (cambio de entorno ESP-IDF)\n")
        command += f" {quoted}"

        self._save_config()
        self._set_running(True)
        self.status_var.set(f"Ejecutando: idf.py {' '.join(idf_args)} ...")
        self._append_log(f"[flasher] {' '.join(idf_cmd)}\n")
        self._start_process(command)

    def _on_stop(self):
        if self.proc is None:
            return
        pid = self.proc.pid
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        self._append_log("[flasher] Proceso detenido por el usuario.\n")

    def _start_process(self, command: str):
        def worker():
            env = dict(os.environ)
            env["PYTHONUTF8"] = "1"
            try:
                self.proc = subprocess.Popen(
                    ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                    cwd=str(FIRMWARE_DIR),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    env=env,
                )
                for line in self.proc.stdout:
                    self.log_queue.put(("line", line.rstrip("\n")))
                exit_code = self.proc.wait()
            except OSError as exc:
                self.log_queue.put(("line", f"[ERROR] {exc}"))
                exit_code = -1
            finally:
                self.proc = None
                self.log_queue.put(("done", exit_code))

        threading.Thread(target=worker, daemon=True).start()

    def _set_running(self, running: bool):
        state = "disabled" if running else "normal"
        for btn in self.action_buttons:
            btn.configure(state=state)
        self.stop_btn.configure(state="normal" if running else "disabled")

    # ---------- Log / cola ----------

    def _append_log(self, text: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", text if text.endswith("\n") else text + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _poll_log_queue(self):
        try:
            while True:
                kind, payload = self.log_queue.get_nowait()
                if kind == "line":
                    self._append_log(payload)
                elif kind == "done":
                    self._set_running(False)
                    ok = payload == 0
                    self.status_var.set("Listo." if ok else f"Termino con error (codigo {payload}).")
        except queue.Empty:
            pass
        self.root.after(100, self._poll_log_queue)

    # ---------- Config ----------

    def _load_config(self) -> dict:
        if CONFIG_PATH.exists():
            try:
                return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return {}
        return {}

    def _save_config(self):
        data = {
            "node": self.node_var.get(),
            "port": self.port_var.get(),
            "monitor": self.monitor_var.get(),
            "idf_option": self.idf_var.get(),
        }
        option = self.idf_options.get(self.idf_var.get())
        if self.idf_var.get().startswith("Manual: ") and option:
            data["manual_activation_script"] = option["activation_script"]
        elif "manual_activation_script" in self.config_data:
            data["manual_activation_script"] = self.config_data["manual_activation_script"]
        try:
            CONFIG_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except OSError:
            pass

    def _on_close(self):
        if self.proc is not None:
            if not messagebox.askyesno("Proceso en curso", "Hay una operacion en curso. Detenerla y salir?"):
                return
            self._on_stop()
        self._save_config()
        self.root.destroy()


def main():
    root = tk.Tk()
    BurnerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
