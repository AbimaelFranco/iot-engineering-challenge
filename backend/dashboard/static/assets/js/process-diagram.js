/* ========================================================================
   PROCESS DIAGRAM - Secado y enfriamiento de azucar
   Simulacion client-side pura (sin librerias externas). Controla:
   - Motor de simulacion (ruido suavizado por variable, 1 muestra/seg sim)
   - Secuencia de arranque/parada escalonada
   - Animaciones mecanicas (CSS) + particulas/cangilones (SMIL)
   - Interactividad: hover/tooltip, click/teclado -> panel lateral o modal
   - Controles: start/stop, velocidad, filtro de zona, falla aleatoria
   - KPIs y bitacora de alarmas
   ======================================================================== */

(function () {
    'use strict';

    var root = document.getElementById('pd-root');
    if (!root) {
        return;
    }

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.getElementById('pd-svg');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // -----------------------------------------------------------------
    // 1. Equipment registry: nombre, funcion, zona y variables simuladas
    // -----------------------------------------------------------------
    var EQUIPMENT = {
        'dryer': {
            name: 'Secador rotatorio', tag: '1', zone: 'secado',
            fn: 'Tambor rotatorio que seca el azucar humedo en contracorriente con aire caliente.',
            vars: [
                { key: 'temp_aire', label: 'Aire entrada', unit: '°C', min: 90, max: 110, dec: 1 },
                { key: 'rpm', label: 'Velocidad tambor', unit: 'rpm', min: 4, max: 8, dec: 1 },
                { key: 'hum_out', label: 'Humedad salida', unit: '%', min: 0.03, max: 0.06, dec: 3 },
                { key: 'hum_in', label: 'Humedad entrada', unit: '%', min: 0.5, max: 1.5, dec: 2 }
            ]
        },
        'screw-in': {
            name: 'Tornillo sinfin - entrada', tag: '2', zone: 'secado',
            fn: 'Transporta el azucar humedo desde la tolva de recepcion hacia el secador.',
            vars: [
                { key: 'caudal', label: 'Caudal', unit: 't/h', min: 18, max: 24, dec: 1 },
                { key: 'rpm', label: 'Velocidad', unit: 'rpm', min: 20, max: 35, dec: 0 }
            ]
        },
        'screw-out': {
            name: 'Tornillo sinfin - salida', tag: '2', zone: 'transporte',
            fn: 'Retira el azucar seco del secador y lo entrega a la valvula rotativa.',
            vars: [
                { key: 'caudal', label: 'Caudal', unit: 't/h', min: 18, max: 24, dec: 1 },
                { key: 'temp', label: 'Temperatura', unit: '°C', min: 55, max: 70, dec: 1 }
            ]
        },
        'valve-elevator': {
            name: 'Valvula rotativa - entrada elevador', tag: '3', zone: 'transporte',
            fn: 'Sella el paso de azucar entre el tornillo de salida y el elevador de cangilones.',
            vars: [
                { key: 'rpm', label: 'Velocidad rotor', unit: 'rpm', min: 18, max: 26, dec: 0 },
                { key: 'dp', label: 'Presion diferencial', unit: 'mbar', min: 2, max: 8, dec: 1 }
            ]
        },
        'valve-cooler': {
            name: 'Valvula rotativa - entrada enfriador', tag: '3', zone: 'transporte',
            fn: 'Dosifica el ingreso de azucar clasificado hacia el enfriador vertical.',
            vars: [
                { key: 'rpm', label: 'Velocidad rotor', unit: 'rpm', min: 18, max: 26, dec: 0 },
                { key: 'dp', label: 'Presion diferencial', unit: 'mbar', min: 2, max: 8, dec: 1 }
            ]
        },
        'valve-discharge': {
            name: 'Valvula rotativa - descarga enfriador', tag: '3', zone: 'enfriamiento',
            fn: 'Descarga el azucar ya enfriado hacia el transporte final del producto.',
            vars: [
                { key: 'rpm', label: 'Velocidad rotor', unit: 'rpm', min: 18, max: 26, dec: 0 },
                { key: 'caudal', label: 'Caudal producto', unit: 't/h', min: 18, max: 24, dec: 1 }
            ]
        },
        'heater': {
            name: 'Calentador de aire', tag: '4', zone: 'secado',
            fn: 'Eleva la temperatura del aire de secado mediante vapor antes de ingresar al secador.',
            vars: [
                { key: 'temp_out', label: 'Temp. salida aire', unit: '°C', min: 95, max: 115, dec: 1 },
                { key: 'p_vapor', label: 'Presion vapor', unit: 'bar', min: 3, max: 5, dec: 2 },
                { key: 'caudal_vapor', label: 'Caudal vapor', unit: 't/h', min: 1.8, max: 2.6, dec: 2 }
            ]
        },
        'preheater': {
            name: 'Precalentador de aire', tag: '5', zone: 'secado',
            fn: 'Precalienta el aire de secado con condensado antes del calentador principal.',
            vars: [
                { key: 'temp_out', label: 'Temp. salida aire', unit: '°C', min: 45, max: 60, dec: 1 },
                { key: 'caudal_cond', label: 'Caudal condensado', unit: 't/h', min: 1.5, max: 2.3, dec: 2 }
            ]
        },
        'prefilter': {
            name: 'Prefiltro de aire', tag: '8', zone: 'secado',
            fn: 'Retiene particulas gruesas del aire ambiente antes del filtro principal.',
            vars: [{ key: 'dp', label: 'Perdida de carga', unit: 'Pa', min: 40, max: 120, dec: 0 }]
        },
        'filter-dryer': {
            name: 'Filtro de aire - secador', tag: '9', zone: 'secado',
            fn: 'Filtracion fina del aire que alimenta al calentador y al secador.',
            vars: [{ key: 'dp', label: 'Perdida de carga', unit: 'Pa', min: 60, max: 180, dec: 0 }]
        },
        'filter-cooler': {
            name: 'Filtro de aire - deshumidificador', tag: '9', zone: 'deshumidificador',
            fn: 'Filtracion del aire ambiente antes de la bateria de enfriamiento.',
            vars: [{ key: 'dp', label: 'Perdida de carga', unit: 'Pa', min: 60, max: 180, dec: 0 }]
        },
        'scrubber': {
            name: 'Depurador humedo', tag: '10', zone: 'secado',
            fn: 'Lava y separa el polvo del aire de salida del secador antes de extraerlo a la atmosfera.',
            vars: [
                { key: 'eficiencia', label: 'Eficiencia separacion', unit: '%', min: 92, max: 99, dec: 1 },
                { key: 'caudal_agua', label: 'Agua recirculada', unit: 'm3/h', min: 8, max: 14, dec: 1 }
            ]
        },
        'pump-scrubber': {
            name: 'Bomba recirculacion depurador', tag: '11', zone: 'secado',
            fn: 'Recircula el agua de lavado del depurador humedo.',
            vars: [
                { key: 'caudal', label: 'Caudal', unit: 'm3/h', min: 8, max: 14, dec: 1 },
                { key: 'presion', label: 'Presion', unit: 'bar', min: 2, max: 4, dec: 2 }
            ]
        },
        'fan-extract': {
            name: 'Ventilador de extraccion', tag: '12', zone: 'secado',
            fn: 'Extrae el aire humedo del secador hacia la atmosfera a traves del depurador.',
            vars: [
                { key: 'caudal', label: 'Caudal aire', unit: 'm3/h', min: 18000, max: 24000, dec: 0 },
                { key: 'rpm', label: 'Velocidad', unit: 'rpm', min: 980, max: 1450, dec: 0 }
            ]
        },
        'elevator': {
            name: 'Elevador de cangilones', tag: '16', zone: 'transporte',
            fn: 'Eleva el azucar seco desde la salida del secador hasta la criba clasificadora.',
            vars: [
                { key: 'caudal', label: 'Caudal producto', unit: 't/h', min: 18, max: 24, dec: 1 },
                { key: 'velocidad', label: 'Velocidad cadena', unit: 'm/s', min: 0.8, max: 1.3, dec: 2 }
            ]
        },
        'screen': {
            name: 'Criba / tamiz', tag: '17', zone: 'transporte',
            fn: 'Clasifica el azucar por tamano antes de ingresar al enfriador.',
            vars: [
                { key: 'amplitud', label: 'Amplitud vibracion', unit: 'mm', min: 2, max: 4, dec: 1 },
                { key: 'rechazo', label: 'Rechazo', unit: '%', min: 0.5, max: 2.5, dec: 2 }
            ]
        },
        'cooler-vertical': {
            name: 'Enfriador vertical de azucar', tag: '20', zone: 'enfriamiento',
            fn: 'Enfria el azucar con placas y aire acondicionado antes del almacenaje.',
            vars: [
                { key: 'temp_azucar', label: 'Temp. azucar salida', unit: '°C', min: 30, max: 38, dec: 1 },
                { key: 'temp_aire', label: 'Aire acondicionado', unit: '°C', min: 15, max: 20, dec: 1 },
                { key: 'hr', label: 'Humedad relativa aire', unit: '%', min: 25, max: 40, dec: 1 }
            ]
        },
        'plateHX-enfriador': {
            name: 'Intercambiador de placas - enfriador', tag: '19', zone: 'enfriamiento',
            fn: 'Enfria el agua de las placas del enfriador contra agua de enfriamiento externa.',
            vars: [
                { key: 'temp_in', label: 'Temp. entrada', unit: '°C', min: 28, max: 34, dec: 1 },
                { key: 'temp_out', label: 'Temp. salida', unit: '°C', min: 18, max: 22, dec: 1 }
            ]
        },
        'pump-cooler-water': {
            name: 'Bomba agua del enfriador', tag: '11', zone: 'enfriamiento',
            fn: 'Circula el agua de placas entre el enfriador vertical y su intercambiador.',
            vars: [
                { key: 'caudal', label: 'Caudal', unit: 'm3/h', min: 10, max: 16, dec: 1 },
                { key: 'presion', label: 'Presion', unit: 'bar', min: 2, max: 3.5, dec: 2 }
            ]
        },
        'chiller': {
            name: 'Chiller', tag: '14', zone: 'frio',
            fn: 'Produce agua helada para la bateria de enfriamiento del deshumidificador.',
            vars: [
                { key: 'temp_out', label: 'Temp. salida agua', unit: '°C', min: 6, max: 12, dec: 1 },
                { key: 'potencia', label: 'Potencia', unit: 'kW', min: 35, max: 55, dec: 1 },
                { key: 'cop', label: 'COP', unit: '', min: 3.2, max: 4.5, dec: 2 }
            ]
        },
        'tank': {
            name: 'Tanque de agua helada', tag: '15', zone: 'frio',
            fn: 'Acumula agua helada para amortiguar la demanda de la bateria del deshumidificador.',
            vars: [
                { key: 'nivel', label: 'Nivel', unit: '%', min: 60, max: 95, dec: 0 },
                { key: 'temp', label: 'Temperatura', unit: '°C', min: 6, max: 12, dec: 1 }
            ]
        },
        'pump-chilled': {
            name: 'Bomba circuito agua helada', tag: '11', zone: 'frio',
            fn: 'Circula el agua helada entre el chiller, el tanque y la bateria del deshumidificador.',
            vars: [
                { key: 'caudal', label: 'Caudal', unit: 'm3/h', min: 12, max: 18, dec: 1 },
                { key: 'presion', label: 'Presion', unit: 'bar', min: 2, max: 3.5, dec: 2 }
            ]
        },
        'plateHX-frio': {
            name: 'Intercambiador de placas - chiller', tag: '19', zone: 'frio',
            fn: 'Rechaza el calor del condensador del chiller hacia el agua de enfriamiento externa.',
            vars: [
                { key: 'temp_in', label: 'Temp. entrada', unit: '°C', min: 32, max: 38, dec: 1 },
                { key: 'temp_out', label: 'Temp. salida', unit: '°C', min: 24, max: 29, dec: 1 }
            ]
        },
        'battery': {
            name: 'Bateria de enfriamiento', tag: '6', zone: 'deshumidificador',
            fn: 'Enfria y deshumidifica el aire acondicionado que se envia al enfriador vertical.',
            vars: [
                { key: 'temp_out', label: 'Temp. salida aire', unit: '°C', min: 14, max: 19, dec: 1 },
                { key: 'caudal_agua', label: 'Caudal agua helada', unit: 'm3/h', min: 10, max: 15, dec: 1 }
            ]
        },
        'separator': {
            name: 'Separador de gotas', tag: '13', zone: 'deshumidificador',
            fn: 'Elimina el arrastre de condensado del aire antes del soplador.',
            vars: [{ key: 'condensado', label: 'Condensado drenado', unit: 'L/h', min: 20, max: 60, dec: 0 }]
        },
        'blower': {
            name: 'Soplador de aire acondicionado', tag: '21', zone: 'deshumidificador',
            fn: 'Impulsa el aire acondicionado hacia la base del enfriador vertical.',
            vars: [
                { key: 'caudal', label: 'Caudal aire', unit: 'm3/h', min: 9000, max: 13000, dec: 0 },
                { key: 'rpm', label: 'Velocidad', unit: 'rpm', min: 1100, max: 1600, dec: 0 }
            ]
        }
    };

    var ZONE_LABELS = {
        secado: 'Secado',
        transporte: 'Transporte y clasificacion',
        enfriamiento: 'Enfriamiento',
        frio: 'Unidad de frio',
        deshumidificador: 'Deshumidificador'
    };

    // Secuencia de arranque escalonada: primero ventiladores/aire, luego
    // el proceso principal, y por ultimo transporte/producto.
    var START_SEQUENCE = [
        { delay: 0, ids: ['fan-extract', 'blower', 'pump-scrubber', 'pump-chilled', 'pump-cooler-water',
            'chiller', 'tank', 'battery', 'prefilter', 'filter-dryer', 'filter-cooler',
            'preheater', 'heater', 'scrubber', 'separator', 'plateHX-frio', 'plateHX-enfriador'] },
        { delay: 1400, ids: ['dryer', 'cooler-vertical'] },
        { delay: 2600, ids: ['screw-in', 'screw-out', 'valve-elevator', 'valve-cooler', 'valve-discharge', 'elevator', 'screen'] }
    ];
    var STARTING_DURATION = 900;

    var equipIds = Object.keys(EQUIPMENT);

    // -----------------------------------------------------------------
    // 2. Estado de simulacion
    // -----------------------------------------------------------------
    var state = {
        running: false,
        speed: 1,
        zoneFilter: 'all',
        visible: true,
        selectedId: null,
        alarmSeq: 0,
        alarms: []
    };

    var varState = {}; // { equipId: { varKey: { value, target, history:[] } } }
    var equipStatus = {}; // { equipId: 'stopped'|'starting'|'running'|'fault' }
    var startTimers = [];

    function randRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    function initVarState() {
        equipIds.forEach(function (id) {
            varState[id] = {};
            equipStatus[id] = 'stopped';
            EQUIPMENT[id].vars.forEach(function (v) {
                var mid = randRange(v.min, v.max);
                varState[id][v.key] = { value: mid, target: mid, history: [] };
            });
        });
    }

    // Avanza un valor con un paseo aleatorio suavizado (ruido realista,
    // sin saltos bruscos) dentro de [min, max].
    function stepVar(vs, def, dtSeconds) {
        var range = def.max - def.min;
        if (Math.random() < 0.06) {
            vs.target = clamp(def.min + Math.random() * range, def.min, def.max);
        }
        var pull = 1 - Math.pow(0.0025, dtSeconds);
        vs.value += (vs.target - vs.value) * pull;
        vs.value += (Math.random() - 0.5) * range * 0.01;
        vs.value = clamp(vs.value, def.min, def.max);
        return vs.value;
    }

    // -----------------------------------------------------------------
    // 3. DOM refs
    // -----------------------------------------------------------------
    var equipEls = {};
    equipIds.forEach(function (id) {
        equipEls[id] = svg.querySelector('.pd-equip[data-id="' + id + '"]');
    });

    var btnStart = document.getElementById('pd-btn-start');
    var btnStop = document.getElementById('pd-btn-stop');
    var btnFault = document.getElementById('pd-btn-fault');
    var speedChips = Array.prototype.slice.call(document.querySelectorAll('.pd-chip[data-speed]'));
    var zoneChips = Array.prototype.slice.call(document.querySelectorAll('.pd-chip[data-zone]'));
    var headerStatus = document.getElementById('pd-header-status');
    var headerStatusText = document.getElementById('pd-header-status-text');
    var headerClock = document.getElementById('pd-header-clock');
    var tooltip = document.getElementById('pd-tooltip');
    var panelEmpty = document.getElementById('pd-panel-empty');
    var panelContent = document.getElementById('pd-panel-content');
    var panelMobile = document.getElementById('pd-panel-mobile');
    var modalEl = document.getElementById('pd-equip-modal');
    var modalTitle = document.getElementById('pd-equip-modal-title');
    var modalInstance = (modalEl && window.bootstrap) ? new bootstrap.Modal(modalEl) : null;
    var alarmList = document.getElementById('pd-alarm-list');
    var alarmEmpty = document.getElementById('pd-alarm-empty');
    var kpiProduction = document.getElementById('pd-kpi-production');
    var kpiMoisture = document.getElementById('pd-kpi-moisture');
    var kpiTemp = document.getElementById('pd-kpi-temp');
    var kpiSteam = document.getElementById('pd-kpi-steam');

    // -----------------------------------------------------------------
    // 4. Estado visual (clases/atributos) de cada equipo
    // -----------------------------------------------------------------
    function setEquipStatus(id, status) {
        equipStatus[id] = status;
        var el = equipEls[id];
        if (el) {
            el.setAttribute('data-status', status);
        }
        if (state.selectedId === id) {
            renderPanel(id);
        }
    }

    function applyZoneFilter() {
        root.setAttribute('data-zone-filter', state.zoneFilter);
        equipIds.forEach(function (id) {
            var el = equipEls[id];
            if (!el) { return; }
            var active = state.zoneFilter === 'all' || EQUIPMENT[id].zone === state.zoneFilter;
            el.classList.toggle('pd-zone-active', active);
        });
        var flowZoneMap = {
            'pd-flow-sugar': ['secado', 'transporte', 'enfriamiento'],
            'pd-flow-air-dry': ['secado'],
            'pd-flow-air-cool': ['deshumidificador', 'enfriamiento'],
            'pd-flow-steam': ['secado'],
            'pd-flow-condensate': ['secado'],
            'pd-flow-water-plates': ['enfriamiento', 'frio'],
            'pd-flow-chilled': ['frio', 'deshumidificador'],
            'pd-flow-recirc': ['secado']
        };
        Object.keys(flowZoneMap).forEach(function (cls) {
            var zones = flowZoneMap[cls];
            var active = state.zoneFilter === 'all' || zones.indexOf(state.zoneFilter) !== -1;
            svg.querySelectorAll('.' + cls).forEach(function (p) {
                p.classList.toggle('pd-zone-active', active);
            });
        });
    }

    // -----------------------------------------------------------------
    // 5. Arranque / parada escalonada
    // -----------------------------------------------------------------
    function clearStartTimers() {
        startTimers.forEach(function (t) { clearTimeout(t); });
        startTimers = [];
    }

    function startPlant() {
        if (state.running) { return; }
        state.running = true;
        clearStartTimers();
        root.setAttribute('data-running', 'true');
        btnStart.setAttribute('aria-pressed', 'true');
        btnStop.setAttribute('aria-pressed', 'false');
        headerStatus.setAttribute('data-state', 'starting');
        headerStatusText.textContent = 'Arrancando planta...';

        START_SEQUENCE.forEach(function (group) {
            var t = setTimeout(function () {
                group.ids.forEach(function (id) {
                    if (equipStatus[id] === 'fault') { return; }
                    setEquipStatus(id, 'starting');
                    var t2 = setTimeout(function () {
                        if (state.running && equipStatus[id] !== 'fault') {
                            setEquipStatus(id, 'running');
                        }
                    }, STARTING_DURATION);
                    startTimers.push(t2);
                });
                if (group === START_SEQUENCE[START_SEQUENCE.length - 1]) {
                    var t3 = setTimeout(function () {
                        headerStatus.setAttribute('data-state', 'running');
                        headerStatusText.textContent = 'Planta en operacion';
                    }, STARTING_DURATION + 50);
                    startTimers.push(t3);
                }
            }, group.delay);
            startTimers.push(t);
        });

        updateSmilPlayback();
    }

    function stopPlant() {
        if (!state.running) { return; }
        state.running = false;
        clearStartTimers();
        root.setAttribute('data-running', 'false');
        btnStart.setAttribute('aria-pressed', 'false');
        btnStop.setAttribute('aria-pressed', 'true');
        headerStatus.setAttribute('data-state', 'stopped');
        headerStatusText.textContent = 'Planta detenida';
        equipIds.forEach(function (id) {
            if (equipStatus[id] !== 'fault') {
                setEquipStatus(id, 'stopped');
            }
        });
        updateSmilPlayback();
    }

    // -----------------------------------------------------------------
    // 6. Falla aleatoria + bitacora de alarmas
    // -----------------------------------------------------------------
    function triggerRandomFault() {
        var running = equipIds.filter(function (id) { return equipStatus[id] === 'running'; });
        if (!running.length) { return; }
        var id = running[Math.floor(Math.random() * running.length)];
        setEquipStatus(id, 'fault');
        var alarm = {
            id: ++state.alarmSeq,
            equipId: id,
            text: EQUIPMENT[id].name + ' (equipo ' + EQUIPMENT[id].tag + ') reportó una falla',
            time: new Date(),
            ack: false
        };
        state.alarms.unshift(alarm);
        renderAlarms();
    }

    function ackAlarm(alarmId) {
        var alarm = state.alarms.filter(function (a) { return a.id === alarmId; })[0];
        if (!alarm) { return; }
        alarm.ack = true;
        if (equipStatus[alarm.equipId] === 'fault') {
            setEquipStatus(alarm.equipId, state.running ? 'running' : 'stopped');
        }
        renderAlarms();
    }

    function formatTime(d) {
        var p = function (n) { return String(n).padStart(2, '0'); };
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function renderAlarms() {
        alarmList.querySelectorAll('.pd-alarm-item').forEach(function (n) { n.remove(); });
        if (!state.alarms.length) {
            alarmEmpty.classList.remove('d-none');
            return;
        }
        alarmEmpty.classList.add('d-none');
        state.alarms.forEach(function (alarm) {
            var item = document.createElement('div');
            item.className = 'pd-alarm-item' + (alarm.ack ? ' pd-ack' : '');
            item.innerHTML =
                '<i class="bi bi-exclamation-triangle-fill pd-alarm-icon"></i>' +
                '<div class="pd-alarm-text"><span class="pd-alarm-title">' + alarm.text + '</span>' +
                '<span class="pd-alarm-time">' + formatTime(alarm.time) + '</span></div>';
            if (!alarm.ack) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pd-alarm-ack-btn';
                btn.textContent = 'Reconocer';
                btn.addEventListener('click', function () { ackAlarm(alarm.id); });
                item.appendChild(btn);
            }
            alarmList.appendChild(item);
        });
    }

    // -----------------------------------------------------------------
    // 7. Tooltip (hover + foco por teclado)
    // -----------------------------------------------------------------
    function showTooltip(el, clientX, clientY) {
        var id = el.getAttribute('data-id');
        tooltip.textContent = EQUIPMENT[id].name + ' (equipo ' + EQUIPMENT[id].tag + ')';
        tooltip.style.left = clientX + 'px';
        tooltip.style.top = clientY + 'px';
        tooltip.classList.add('pd-show');
    }

    function hideTooltip() {
        tooltip.classList.remove('pd-show');
    }

    // -----------------------------------------------------------------
    // 8. Panel lateral / modal con variables en vivo + mini tendencia
    // -----------------------------------------------------------------
    var activeCanvases = [];

    function statusLabel(status) {
        return { stopped: 'Detenido', starting: 'Arrancando', running: 'Operando', fault: 'Alarma' }[status] || status;
    }

    function buildPanelHtml(id) {
        var eq = EQUIPMENT[id];
        var status = equipStatus[id];
        var html = '' +
            '<div class="pd-panel-tag">Equipo ' + eq.tag + ' &middot; ' + ZONE_LABELS[eq.zone] + '</div>' +
            '<div class="pd-panel-title">' + eq.name + '</div>' +
            '<span class="pd-status-pill" data-state="' + status + '"><span class="pd-dot"></span>' +
            '<span class="pd-status-text">' + statusLabel(status) + '</span></span>' +
            '<p class="pd-panel-desc mt-3">' + eq.fn + '</p>' +
            '<div class="pd-panel-vars">';
        eq.vars.forEach(function (v) {
            html += '' +
                '<div class="pd-var-card">' +
                '<div class="pd-var-head"><span class="pd-var-name">' + v.label + '</span>' +
                '<span class="pd-var-value" id="pd-val-' + id + '-' + v.key + '">--</span></div>' +
                '<canvas class="pd-var-canvas" id="pd-canvas-' + id + '-' + v.key + '" width="280" height="40"></canvas>' +
                '</div>';
        });
        html += '</div>';
        return html;
    }

    function drawTrend(canvas, history, min, max) {
        if (!canvas || !canvas.getContext) { return; }
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (history.length < 2) { return; }
        var range = (max - min) || 1;
        ctx.beginPath();
        ctx.strokeStyle = '#4E8F1C';
        ctx.lineWidth = 2;
        history.forEach(function (v, i) {
            var x = (i / (history.length - 1)) * w;
            var y = h - ((v - min) / range) * h;
            y = clamp(y, 2, h - 2);
            if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();
    }

    function renderPanel(id) {
        var eq = EQUIPMENT[id];
        if (!eq) { return; }
        var html = buildPanelHtml(id);
        panelContent.innerHTML = html;
        panelContent.classList.remove('d-none');
        panelEmpty.classList.add('d-none');

        var isMobile = window.matchMedia('(max-width: 1200px)').matches;
        if (isMobile) {
            panelMobile.innerHTML = html;
            modalTitle.textContent = eq.name;
            if (modalInstance) { modalInstance.show(); }
        }

        activeCanvases = eq.vars.map(function (v) {
            return {
                key: v.key,
                def: v,
                canvasIds: ['pd-canvas-' + id + '-' + v.key]
            };
        });
        refreshPanelValues(id);
    }

    function refreshPanelValues(id) {
        if (state.selectedId !== id) { return; }
        var eq = EQUIPMENT[id];
        eq.vars.forEach(function (v) {
            var vs = varState[id][v.key];
            var valueEl = document.getElementById('pd-val-' + id + '-' + v.key);
            if (valueEl) {
                valueEl.textContent = vs.value.toFixed(v.dec) + (v.unit ? ' ' + v.unit : '');
            }
            var canvasEl = document.getElementById('pd-canvas-' + id + '-' + v.key);
            drawTrend(canvasEl, vs.history, v.min, v.max);
            var canvasMobile = panelMobile.querySelector('#pd-canvas-' + id + '-' + v.key);
            if (canvasMobile && canvasMobile !== canvasEl) {
                drawTrend(canvasMobile, vs.history, v.min, v.max);
            }
        });
        var pillDesktop = panelContent.querySelector('.pd-status-pill');
        if (pillDesktop) {
            pillDesktop.setAttribute('data-state', equipStatus[id]);
            var pillText = pillDesktop.querySelector('.pd-status-text');
            if (pillText) { pillText.textContent = statusLabel(equipStatus[id]); }
        }
    }

    function selectEquip(id) {
        if (state.selectedId && equipEls[state.selectedId]) {
            equipEls[state.selectedId].classList.remove('pd-selected');
        }
        state.selectedId = id;
        if (equipEls[id]) {
            equipEls[id].classList.add('pd-selected');
        }
        renderPanel(id);
    }

    // -----------------------------------------------------------------
    // 9. Listeners sobre cada equipo (hover, click, teclado)
    // -----------------------------------------------------------------
    equipIds.forEach(function (id) {
        var el = equipEls[id];
        if (!el) { return; }
        el.addEventListener('pointerenter', function (e) { showTooltip(el, e.clientX + 14, e.clientY + 14); });
        el.addEventListener('pointermove', function (e) { showTooltip(el, e.clientX + 14, e.clientY + 14); });
        el.addEventListener('pointerleave', hideTooltip);
        el.addEventListener('focus', function () {
            var r = el.getBoundingClientRect();
            showTooltip(el, r.left + r.width / 2, r.top);
        });
        el.addEventListener('blur', hideTooltip);
        el.addEventListener('click', function () { selectEquip(id); });
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectEquip(id);
            }
        });
    });

    // -----------------------------------------------------------------
    // 10. Controles de la barra de herramientas
    // -----------------------------------------------------------------
    btnStart.addEventListener('click', startPlant);
    btnStop.addEventListener('click', stopPlant);
    btnFault.addEventListener('click', triggerRandomFault);

    speedChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            state.speed = parseFloat(chip.getAttribute('data-speed'));
            speedChips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        });
    });

    zoneChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            state.zoneFilter = chip.getAttribute('data-zone');
            zoneChips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
            applyZoneFilter();
        });
    });

    // -----------------------------------------------------------------
    // 11. KPIs de cabecera
    // -----------------------------------------------------------------
    function updateKpis() {
        if (!state.running) {
            kpiProduction.textContent = '--';
            kpiMoisture.textContent = '--';
            kpiTemp.textContent = '--';
            kpiSteam.textContent = '--';
            return;
        }
        var production = varState['screw-out'].caudal.value;
        var moisture = varState['dryer'].hum_out.value;
        var temp = varState['cooler-vertical'].temp_azucar.value;
        var steam = varState['heater'].caudal_vapor.value;
        kpiProduction.textContent = production.toFixed(1);
        kpiMoisture.textContent = moisture.toFixed(3);
        kpiTemp.textContent = temp.toFixed(1);
        kpiSteam.textContent = steam.toFixed(2);
    }

    // -----------------------------------------------------------------
    // 12. Reloj de cabecera
    // -----------------------------------------------------------------
    function tickClock() {
        headerClock.textContent = formatTime(new Date());
    }
    tickClock();
    setInterval(tickClock, 1000);

    // -----------------------------------------------------------------
    // 13. Cangilones del elevador + particulas de azucar (SMIL)
    //     Se crean una sola vez; el movimiento se pausa/retoma con
    //     svg.pauseAnimations()/unpauseAnimations() (ver updateSmilPlayback).
    // -----------------------------------------------------------------
    function buildMotionElement(tag, attrs, motionAttrs, pathId) {
        var el = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
        var anim = document.createElementNS(SVG_NS, 'animateMotion');
        Object.keys(motionAttrs).forEach(function (k) { anim.setAttribute(k, motionAttrs[k]); });
        var mpath = document.createElementNS(SVG_NS, 'mpath');
        mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + pathId);
        mpath.setAttribute('href', '#' + pathId);
        anim.appendChild(mpath);
        el.appendChild(anim);
        return el;
    }

    var bucketsGroup = document.getElementById('pd-buckets');
    var BUCKET_COUNT = 10;
    for (var bi = 0; bi < BUCKET_COUNT; bi++) {
        var bucket = buildMotionElement('rect',
            { x: -9, y: -6, width: 18, height: 12, rx: 2, fill: '#C7D1CB', stroke: '#4E5F56', 'stroke-width': 1 },
            { dur: '5s', begin: (-(bi * 5 / BUCKET_COUNT)) + 's', repeatCount: 'indefinite' },
            'pd-path-elevator-loop');
        bucketsGroup.appendChild(bucket);
    }

    var particlesGroup = document.getElementById('pd-particles');
    var PARTICLE_COUNT = 7;
    for (var pi = 0; pi < PARTICLE_COUNT; pi++) {
        var particle = buildMotionElement('circle',
            { cx: 0, cy: 0, r: 5, fill: '#F97316', opacity: 0.92 },
            { dur: '9s', begin: (-(pi * 9 / PARTICLE_COUNT)) + 's', repeatCount: 'indefinite' },
            'pd-path-sugar-main');
        particlesGroup.appendChild(particle);
    }

    var smilUnpaused = false;
    function updateSmilPlayback() {
        var shouldRun = state.running && state.visible && !reduceMotion;
        if (shouldRun && !smilUnpaused) {
            try { svg.unpauseAnimations(); } catch (e) { /* no-op: SMIL no soportado */ }
            smilUnpaused = true;
        } else if (!shouldRun && smilUnpaused) {
            try { svg.pauseAnimations(); } catch (e) { /* no-op */ }
            smilUnpaused = false;
        }
    }
    try { svg.pauseAnimations(); } catch (e) { /* no-op */ }

    // -----------------------------------------------------------------
    // 14. IntersectionObserver: pausa cuando el diagrama no es visible
    // -----------------------------------------------------------------
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            state.visible = entries[0].isIntersecting;
            updateSmilPlayback();
        }, { threshold: 0.1 });
        io.observe(svg);
    }

    // -----------------------------------------------------------------
    // 15. Bucle de simulacion
    // -----------------------------------------------------------------
    var lastTs = null;
    var sampleAcc = 0;
    var HISTORY_LEN = 60;

    function tick(ts) {
        requestAnimationFrame(tick);
        if (lastTs === null) { lastTs = ts; return; }
        var dtReal = (ts - lastTs) / 1000;
        lastTs = ts;
        if (!state.visible) { return; }

        var dtSim = dtReal * state.speed;
        equipIds.forEach(function (id) {
            var running = equipStatus[id] === 'running' || equipStatus[id] === 'starting';
            if (!running) { return; }
            EQUIPMENT[id].vars.forEach(function (v) {
                stepVar(varState[id][v.key], v, dtSim);
            });
        });

        sampleAcc += dtSim;
        if (sampleAcc >= 1) {
            sampleAcc = 0;
            equipIds.forEach(function (id) {
                EQUIPMENT[id].vars.forEach(function (v) {
                    var vs = varState[id][v.key];
                    vs.history.push(vs.value);
                    if (vs.history.length > HISTORY_LEN) { vs.history.shift(); }
                });
            });
            if (state.selectedId) { refreshPanelValues(state.selectedId); }
            updateKpis();
        }
    }
    requestAnimationFrame(tick);

    // -----------------------------------------------------------------
    // 16. Inicializacion
    // -----------------------------------------------------------------
    initVarState();
    applyZoneFilter();
    renderAlarms();
    updateKpis();
})();
