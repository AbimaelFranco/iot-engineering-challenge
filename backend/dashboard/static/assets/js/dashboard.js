/* 
========================================================================
   BOOTSTRAP 5 ADMIN TEMPLATE - SPARK ADMIN
   DASHBOARD CORE JAVASCRIPT MODULE
   Developed with premium UI/UX standards

   Template Name: Spark Admin
   Version: 1.0 
   Author: Spark Admin Team 
   Email: hello.sparkadmin@gmail.com
   URL: https://sparkadmin.web.id
========================================================================
*/

document.addEventListener('DOMContentLoaded', function () {
    // -----------------------------------------------------------------
    // 1. Mobile Sidebar Toggle & Backdrop Overlay
    // -----------------------------------------------------------------
    const sidebar = document.querySelector('.sidebar-wrapper');
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    
    // Create and append backdrop overlay for mobile sidebar
    let overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show', sidebar.classList.contains('show'));
        });

        // Close sidebar when clicking on backdrop overlay
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }


    // -----------------------------------------------------------------
    // 2. Revenue Chart (Vertical Bar Chart - Income vs Expenses)
    // -----------------------------------------------------------------
    const revenueChartEl = document.querySelector('#revenue-chart');
    if (revenueChartEl) {
        const revenueChartOptions = {
            series: [
                {
                    name: 'Income',
                    data: [44, 55, 41, 67, 52, 70, 61, 85]
                },
                {
                    name: 'Expenses',
                    data: [23, 33, 30, 48, 34, 45, 40, 45]
                }
            ],
            chart: {
                type: 'bar',
                height: 220,
                stacked: false,
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            colors: ['#072F1F', '#B4F105'], // Dark Green (Income), Lime Green (Expenses)
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '48%',
                    borderRadius: 0
                },
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                show: true,
                width: 2,
                colors: ['transparent']
            },
            legend: {
                show: false // Custom legends are drawn statically in HTML to match reference layout
            },
            grid: {
                borderColor: '#E9EFEF',
                strokeDashArray: 4,
                yaxis: {
                    lines: {
                        show: true
                    }
                },
                xaxis: {
                    lines: {
                        show: false
                    }
                },
                padding: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                }
            },
            xaxis: {
                categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                labels: {
                    style: {
                        colors: '#6C7E75',
                        fontSize: '11px',
                        fontWeight: 500
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false // Hides absolute numbers to match simplified reference chart style
                }
            },
            fill: {
                opacity: 1
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return "$ " + val + ".000";
                    }
                },
                theme: 'dark'
            }
        };

        const revenueChart = new ApexCharts(revenueChartEl, revenueChartOptions);
        revenueChart.render();
    }

    // -----------------------------------------------------------------
    // 2b. Historico Page: Primary Trend Chart (real node_readings data)
    // -----------------------------------------------------------------
    const historicoPrimaryEl = document.querySelector('#historico-primary-chart');
    if (historicoPrimaryEl) {
        const temp = window.HISTORICO_THRESHOLDS || { tempMinA: 18, tempMaxA: 30, tempMinB: 18, tempMaxB: 30 };
        const dataEl = document.querySelector('#historico-chart-data');
        const chartData = dataEl ? JSON.parse(dataEl.textContent) : {};

        const historicoPrimaryOptions = {
            series: [
                {
                    name: 'Nodo A',
                    data: chartData.tempSeriesA || []
                },
                {
                    name: 'Nodo B',
                    data: chartData.tempSeriesB || []
                },
                {
                    name: 'Promedio',
                    data: chartData.tempSeriesAvg || []
                }
            ],
            chart: {
                type: 'line',
                height: '100%',
                parentHeightOffset: 0,
                animations: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            colors: ['#072F1F', '#F97316', '#7C3AED'],
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            markers: {
                size: [4, 4, 0],
                strokeWidth: 2,
                strokeColors: '#FFFFFF',
                hover: {
                    size: 6
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: [3, 3, 2],
                dashArray: [0, 0, 6]
            },
            legend: {
                show: false // Custom legends are drawn statically in HTML to match reference layout
            },
            grid: {
                borderColor: '#E9EFEF',
                strokeDashArray: 4,
                yaxis: {
                    lines: {
                        show: true
                    }
                },
                xaxis: {
                    lines: {
                        show: false
                    }
                },
                padding: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                }
            },
            xaxis: {
                type: 'datetime',
                // El servidor ya recorta min/max a los datos reales del dia
                // seleccionado (no fuerza un rango fijo de 24h).
                min: chartData.xMin != null ? chartData.xMin : undefined,
                max: chartData.xMax != null ? chartData.xMax : undefined,
                labels: {
                    datetimeUTC: true, // ver comentario de _to_epoch_ms en historico/views.py
                    style: {
                        colors: '#6C7E75',
                        fontSize: '11px',
                        fontWeight: 500
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false
                }
            },
            fill: {
                opacity: 1
            },
            noData: {
                text: 'Sin lecturas para este dia'
            },
            tooltip: {
                x: {
                    format: 'HH:mm:ss'
                },
                y: {
                    formatter: function (val) {
                        return val.toFixed(2) + " °C";
                    }
                },
                theme: 'dark'
            },
            annotations: {
                yaxis: buildThresholdAnnotations(temp.tempMinA, temp.tempMaxA, temp.tempMinB, temp.tempMaxB, '°C')
            }
        };

        const historicoPrimaryChart = new ApexCharts(historicoPrimaryEl, historicoPrimaryOptions);
        historicoPrimaryChart.render();
    }

    // -----------------------------------------------------------------
    // 2c. Historico Page: Secondary Trend Chart (real node_readings data)
    // -----------------------------------------------------------------
    const historicoSecondaryEl = document.querySelector('#historico-secondary-chart');
    if (historicoSecondaryEl) {
        const hum = window.HISTORICO_THRESHOLDS || { humMinA: 30, humMaxA: 70, humMinB: 30, humMaxB: 70 };
        const dataEl = document.querySelector('#historico-chart-data');
        const chartData = dataEl ? JSON.parse(dataEl.textContent) : {};

        const historicoSecondaryOptions = {
            series: [
                {
                    name: 'Nodo A',
                    data: chartData.humSeriesA || []
                },
                {
                    name: 'Nodo B',
                    data: chartData.humSeriesB || []
                },
                {
                    name: 'Promedio',
                    data: chartData.humSeriesAvg || []
                }
            ],
            chart: {
                type: 'line',
                height: '100%',
                parentHeightOffset: 0,
                animations: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            colors: ['#072F1F', '#F97316', '#7C3AED'],
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            markers: {
                size: [4, 4, 0],
                strokeWidth: 2,
                strokeColors: '#FFFFFF',
                hover: {
                    size: 6
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: [3, 3, 2],
                dashArray: [0, 0, 6]
            },
            legend: {
                show: false // Custom legends are drawn statically in HTML to match reference layout
            },
            grid: {
                borderColor: '#E9EFEF',
                strokeDashArray: 4,
                yaxis: {
                    lines: {
                        show: true
                    }
                },
                xaxis: {
                    lines: {
                        show: false
                    }
                }
            },
            xaxis: {
                type: 'datetime',
                min: chartData.xMin != null ? chartData.xMin : undefined,
                max: chartData.xMax != null ? chartData.xMax : undefined,
                labels: {
                    datetimeUTC: true, // ver comentario de _to_epoch_ms en historico/views.py
                    style: {
                        colors: '#6C7E75',
                        fontSize: '11px',
                        fontWeight: 500
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false
                }
            },
            noData: {
                text: 'Sin lecturas para este dia'
            },
            tooltip: {
                x: {
                    format: 'HH:mm:ss'
                },
                y: {
                    formatter: function (val) {
                        return val.toFixed(2) + " %";
                    }
                },
                theme: 'dark'
            },
            annotations: {
                yaxis: buildThresholdAnnotations(hum.humMinA, hum.humMaxA, hum.humMinB, hum.humMaxB, '%')
            }
        };

        const historicoSecondaryChart = new ApexCharts(historicoSecondaryEl, historicoSecondaryOptions);
        historicoSecondaryChart.render();
    }

    // Construye las anotaciones yaxis de umbral (zona rayada + linea) para
    // un chart de Historico o Tiempo Real, a partir de los limites de
    // nodo-a y nodo-b. Si ambos nodos comparten el mismo limite de un lado
    // (max o min), ese lado se dibuja como antes: una sola zona rayada +
    // una sola linea punteada. Si difieren, el lado se resuelve asi:
    //   - Se raya el limite que ocupa mas area VISIBLE dentro del grafico:
    //     para el maximo, el valor mas chico (su zona rayada arranca mas
    //     abajo y cubre mas); para el minimo, el valor mas grande (su zona
    //     rayada llega mas arriba). El rayado del limite mas restrictivo ya
    //     cubre visualmente la zona del otro nodo.
    //   - El otro limite (el menos restrictivo, "contenido" dentro de la
    //     zona ya rayada) se marca solo con una linea solida continua
    //     (strokeDashArray: 0, sin zona rayada propia) para no duplicar el
    //     rayado, etiquetada con su nodo para no confundirla con la rayada.
    // unit es el sufijo del label ("°C" o "%").
    function buildThresholdAnnotations(minA, maxA, minB, maxB, unit) {
        const labelStyle = { color: '#FFFFFF', background: '#EF4444', fontSize: '10px' };
        const annotations = [];

        const sameMax = maxA === maxB;
        const shadedMax = sameMax ? maxA : Math.min(maxA, maxB);
        const soloMaxIsA = maxA > maxB;
        const soloMaxValue = soloMaxIsA ? maxA : maxB;

        annotations.push({
            y: shadedMax,
            y2: shadedMax + 100,
            fillColor: 'url(#dangerHatch)',
            opacity: 0.5,
            borderColor: 'transparent'
        });
        annotations.push({
            y: shadedMax,
            borderColor: '#EF4444',
            strokeDashArray: 4,
            label: {
                text: 'Max ' + (sameMax ? '' : (maxA <= maxB ? 'A ' : 'B ')) + shadedMax + unit,
                position: 'left',
                offsetX: 40,
                style: labelStyle
            }
        });
        if (!sameMax) {
            annotations.push({
                y: soloMaxValue,
                borderColor: '#EF4444',
                strokeDashArray: 0,
                label: {
                    text: 'Max ' + (soloMaxIsA ? 'A ' : 'B ') + soloMaxValue + unit,
                    position: 'left',
                    offsetX: 40,
                    style: labelStyle
                }
            });
        }

        const sameMin = minA === minB;
        const shadedMin = sameMin ? minA : Math.max(minA, minB);
        const soloMinIsA = minA < minB;
        const soloMinValue = soloMinIsA ? minA : minB;

        annotations.push({
            y: shadedMin - 100,
            y2: shadedMin,
            fillColor: 'url(#dangerHatch)',
            opacity: 0.5,
            borderColor: 'transparent'
        });
        annotations.push({
            y: shadedMin,
            borderColor: '#EF4444',
            strokeDashArray: 4,
            label: {
                text: 'Min ' + (sameMin ? '' : (minA >= minB ? 'A ' : 'B ')) + shadedMin + unit,
                position: 'left',
                offsetX: 40,
                style: labelStyle
            }
        });
        if (!sameMin) {
            annotations.push({
                y: soloMinValue,
                borderColor: '#EF4444',
                strokeDashArray: 0,
                label: {
                    text: 'Min ' + (soloMinIsA ? 'A ' : 'B ') + soloMinValue + unit,
                    position: 'left',
                    offsetX: 40,
                    style: labelStyle
                }
            });
        }

        return annotations;
    }

    // -----------------------------------------------------------------
    // 2d. Tiempo Real Page: Primary Trend Chart (real node_readings data)
    // -----------------------------------------------------------------
    // Parseado una sola vez y compartido con el chart secundario (2e) y el
    // stream MQTT en vivo (2f), que necesita conocer/actualizar xMax para
    // extender el eje de tiempo conforme llegan lecturas nuevas.
    const tiemporealDataEl = document.querySelector('#tiemporeal-chart-data');
    const tiemporealChartData = tiemporealDataEl ? JSON.parse(tiemporealDataEl.textContent) : {};
    let tiemporealPrimaryChart = null;
    let tiemporealSecondaryChart = null;

    const tiemporealPrimaryEl = document.querySelector('#tiemporeal-primary-chart');
    if (tiemporealPrimaryEl) {
        const temp = window.TIEMPOREAL_THRESHOLDS || { tempMinA: 18, tempMaxA: 30, tempMinB: 18, tempMaxB: 30 };
        const chartData = tiemporealChartData;

        const tiemporealPrimaryOptions = {
            series: [
                {
                    name: 'Nodo A',
                    data: chartData.tempSeriesA || []
                },
                {
                    name: 'Nodo B',
                    data: chartData.tempSeriesB || []
                },
                {
                    name: 'Promedio',
                    data: chartData.tempSeriesAvg || []
                }
            ],
            chart: {
                type: 'line',
                height: '100%',
                parentHeightOffset: 0,
                animations: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            colors: ['#072F1F', '#F97316', '#7C3AED'],
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            markers: {
                size: [4, 4, 0],
                strokeWidth: 2,
                strokeColors: '#FFFFFF',
                hover: {
                    size: 6
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: [3, 3, 2],
                dashArray: [0, 0, 6]
            },
            legend: {
                show: false // Custom legends are drawn statically in HTML to match reference layout
            },
            grid: {
                borderColor: '#E9EFEF',
                strokeDashArray: 4,
                yaxis: {
                    lines: {
                        show: true
                    }
                },
                xaxis: {
                    lines: {
                        show: false
                    }
                },
                padding: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                }
            },
            xaxis: {
                type: 'datetime',
                // El servidor ya recorta min/max a los datos reales del dia
                // seleccionado (no fuerza un rango fijo de 24h).
                min: chartData.xMin != null ? chartData.xMin : undefined,
                max: chartData.xMax != null ? chartData.xMax : undefined,
                labels: {
                    datetimeUTC: true, // ver comentario de _to_epoch_ms en tiemporeal/views.py
                    style: {
                        colors: '#6C7E75',
                        fontSize: '11px',
                        fontWeight: 500
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false
                }
            },
            fill: {
                opacity: 1
            },
            noData: {
                text: 'Sin lecturas para este dia'
            },
            tooltip: {
                x: {
                    format: 'HH:mm:ss'
                },
                y: {
                    formatter: function (val) {
                        return val.toFixed(2) + " °C";
                    }
                },
                theme: 'dark'
            },
            annotations: {
                yaxis: buildThresholdAnnotations(temp.tempMinA, temp.tempMaxA, temp.tempMinB, temp.tempMaxB, '°C')
            }
        };

        tiemporealPrimaryChart = new ApexCharts(tiemporealPrimaryEl, tiemporealPrimaryOptions);
        tiemporealPrimaryChart.render();
    }

    // -----------------------------------------------------------------
    // 2e. Tiempo Real Page: Secondary Trend Chart (real node_readings data)
    // -----------------------------------------------------------------
    const tiemporealSecondaryEl = document.querySelector('#tiemporeal-secondary-chart');
    if (tiemporealSecondaryEl) {
        const hum = window.TIEMPOREAL_THRESHOLDS || { humMinA: 30, humMaxA: 70, humMinB: 30, humMaxB: 70 };
        const chartData = tiemporealChartData;

        const tiemporealSecondaryOptions = {
            series: [
                {
                    name: 'Nodo A',
                    data: chartData.humSeriesA || []
                },
                {
                    name: 'Nodo B',
                    data: chartData.humSeriesB || []
                },
                {
                    name: 'Promedio',
                    data: chartData.humSeriesAvg || []
                }
            ],
            chart: {
                type: 'line',
                height: '100%',
                parentHeightOffset: 0,
                animations: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            colors: ['#072F1F', '#F97316', '#7C3AED'],
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            markers: {
                size: [4, 4, 0],
                strokeWidth: 2,
                strokeColors: '#FFFFFF',
                hover: {
                    size: 6
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: [3, 3, 2],
                dashArray: [0, 0, 6]
            },
            legend: {
                show: false // Custom legends are drawn statically in HTML to match reference layout
            },
            grid: {
                borderColor: '#E9EFEF',
                strokeDashArray: 4,
                yaxis: {
                    lines: {
                        show: true
                    }
                },
                xaxis: {
                    lines: {
                        show: false
                    }
                }
            },
            xaxis: {
                type: 'datetime',
                min: chartData.xMin != null ? chartData.xMin : undefined,
                max: chartData.xMax != null ? chartData.xMax : undefined,
                labels: {
                    datetimeUTC: true, // ver comentario de _to_epoch_ms en tiemporeal/views.py
                    style: {
                        colors: '#6C7E75',
                        fontSize: '11px',
                        fontWeight: 500
                    }
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false
                }
            },
            noData: {
                text: 'Sin lecturas para este dia'
            },
            tooltip: {
                x: {
                    format: 'HH:mm:ss'
                },
                y: {
                    formatter: function (val) {
                        return val.toFixed(2) + " %";
                    }
                },
                theme: 'dark'
            },
            annotations: {
                yaxis: buildThresholdAnnotations(hum.humMinA, hum.humMaxA, hum.humMinB, hum.humMaxB, '%')
            }
        };

        tiemporealSecondaryChart = new ApexCharts(tiemporealSecondaryEl, tiemporealSecondaryOptions);
        tiemporealSecondaryChart.render();
    }

    // -----------------------------------------------------------------
    // 2f. Tiempo Real Page: Live Stream via Polling (sin credenciales en el navegador)
    // -----------------------------------------------------------------
    // En vez de que el navegador se conecte directo al broker MQTT (lo que
    // expondria las credenciales en las devtools de cualquiera), se consulta
    // periodicamente un endpoint propio (tiemporeal_latest) que lee de la
    // misma base Postgres que ya llena backend/telemetry-worker.py.
    const tiemporealLatestUrl = window.TIEMPOREAL_LATEST_URL;

    if (tiemporealLatestUrl && (tiemporealPrimaryChart || tiemporealSecondaryChart)) {
        function tiemporealAppendPoint(chart, seriesIndex, epochMs, value) {
            if (!chart) {
                return;
            }
            chart.appendData([0, 1, 2].map(function (i) {
                return { data: i === seriesIndex ? [[epochMs, value]] : [] };
            }));
        }

        function tiemporealExtendAxis(epochMs) {
            if (tiemporealChartData.xMax != null && epochMs <= tiemporealChartData.xMax) {
                return;
            }
            tiemporealChartData.xMax = epochMs;
            const newMax = { xaxis: { max: epochMs } };
            if (tiemporealPrimaryChart) {
                tiemporealPrimaryChart.updateOptions(newMax, false, false);
            }
            if (tiemporealSecondaryChart) {
                tiemporealSecondaryChart.updateOptions(newMax, false, false);
            }
        }

        // Rastrea la ultima lectura de cada nodo dentro del minuto "en curso"
        // para poder calcular el punto de Promedio en vivo igual que
        // _series_promedio en el servidor: solo cuando ambos nodos
        // reportaron dentro del mismo minuto.
        let tiemporealPendingMinute = null;
        let tiemporealPendingReadings = {};

        function tiemporealProcessPoint(nodeId, epochMs, temp, hum) {
            const seriesIndex = nodeId === 'nodo-a' ? 0 : 1;
            const tempKey = nodeId === 'nodo-a' ? 'tempSeriesA' : 'tempSeriesB';
            const humKey = nodeId === 'nodo-a' ? 'humSeriesA' : 'humSeriesB';
            tiemporealChartData[tempKey].push([epochMs, temp]);
            tiemporealChartData[humKey].push([epochMs, hum]);

            tiemporealExtendAxis(epochMs);
            tiemporealAppendPoint(tiemporealPrimaryChart, seriesIndex, epochMs, temp);
            tiemporealAppendPoint(tiemporealSecondaryChart, seriesIndex, epochMs, hum);

            const minuteKey = Math.floor(epochMs / 60000);
            if (tiemporealPendingMinute !== minuteKey) {
                tiemporealPendingMinute = minuteKey;
                tiemporealPendingReadings = {};
            }
            tiemporealPendingReadings[nodeId] = { temp: temp, hum: hum };

            if (tiemporealPendingReadings['nodo-a'] && tiemporealPendingReadings['nodo-b']) {
                const avgTemp = Math.round(((tiemporealPendingReadings['nodo-a'].temp + tiemporealPendingReadings['nodo-b'].temp) / 2) * 10) / 10;
                const avgHum = Math.round(((tiemporealPendingReadings['nodo-a'].hum + tiemporealPendingReadings['nodo-b'].hum) / 2) * 10) / 10;
                tiemporealAppendPoint(tiemporealPrimaryChart, 2, epochMs, avgTemp);
                tiemporealAppendPoint(tiemporealSecondaryChart, 2, epochMs, avgHum);
            }
        }

        let tiemporealSince = tiemporealChartData.xMax || 0;
        let tiemporealPolling = false;

        function tiemporealPoll() {
            if (tiemporealPolling) {
                return;
            }
            tiemporealPolling = true;
            fetch(tiemporealLatestUrl + '?since=' + tiemporealSince)
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    const hasNewPoints = (data.tempSeriesA && data.tempSeriesA.length) || (data.tempSeriesB && data.tempSeriesB.length);
                    (data.tempSeriesA || []).forEach(function (point, i) {
                        tiemporealProcessPoint('nodo-a', point[0], point[1], data.humSeriesA[i][1]);
                    });
                    (data.tempSeriesB || []).forEach(function (point, i) {
                        tiemporealProcessPoint('nodo-b', point[0], point[1], data.humSeriesB[i][1]);
                    });
                    if (data.lastEpochMs != null) {
                        tiemporealSince = data.lastEpochMs;
                    }
                    if (hasNewPoints) {
                        tiemporealUpdateStatsDisplay();
                    }
                    // El estado online/offline se revisa en cada poll (no solo
                    // cuando hay lecturas nuevas): un nodo puede desconectarse
                    // sin que eso dispare ninguna lectura de temperatura/humedad.
                    tiemporealUpdateNodeStatusDisplay(data.nodeStatus);
                })
                .catch(function (err) {
                    console.error('Error consultando lecturas nuevas:', err);
                })
                .finally(function () {
                    tiemporealPolling = false;
                });
        }

        tiemporealPoll();
        setInterval(tiemporealPoll, 5000);
    }

    // -----------------------------------------------------------------
    // 2g. Tiempo Real Page: Live Summary Stats (Promedio/Maximo/Minimo/Mediana)
    // -----------------------------------------------------------------
    // Antes estos numeros los calculaba el servidor una sola vez al cargar
    // la pagina (ver historico/views.py _stats/_stat_rows, de donde se
    // copio esta misma logica). En Tiempo Real eso los dejaba desactualizados
    // apenas entraba una lectura nueva por polling, asi que el calculo se
    // mueve aqui: se recalcula sobre tiemporealChartData completo cada vez
    // que llegan puntos nuevos.
    function tiemporealSetText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    function tiemporealRound1(n) {
        return Math.round(n * 10) / 10;
    }

    function tiemporealMedian(values) {
        const sorted = values.slice().sort(function (a, b) { return a - b; });
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    function tiemporealComputeStats(values) {
        if (!values.length) {
            return { promedio: null, maximo: null, minimo: null, mediana: null, muestras: 0 };
        }
        const sum = values.reduce(function (acc, v) { return acc + v; }, 0);
        return {
            promedio: tiemporealRound1(sum / values.length),
            maximo: tiemporealRound1(Math.max.apply(null, values)),
            minimo: tiemporealRound1(Math.min.apply(null, values)),
            mediana: tiemporealRound1(tiemporealMedian(values)),
            muestras: values.length
        };
    }

    function tiemporealFormatValue(value, unit) {
        return value == null ? '--' : (value + unit);
    }

    function tiemporealUpdateStatsDisplay() {
        const tempsA = tiemporealChartData.tempSeriesA.map(function (p) { return p[1]; });
        const tempsB = tiemporealChartData.tempSeriesB.map(function (p) { return p[1]; });
        const humsA = tiemporealChartData.humSeriesA.map(function (p) { return p[1]; });
        const humsB = tiemporealChartData.humSeriesB.map(function (p) { return p[1]; });

        const tempStatsAll = tiemporealComputeStats(tempsA.concat(tempsB));
        const tempStatsA = tiemporealComputeStats(tempsA);
        const tempStatsB = tiemporealComputeStats(tempsB);
        const humStatsAll = tiemporealComputeStats(humsA.concat(humsB));
        const humStatsA = tiemporealComputeStats(humsA);
        const humStatsB = tiemporealComputeStats(humsB);

        tiemporealSetText('tiemporeal-temp-avg', tiemporealFormatValue(tempStatsAll.promedio, '°C'));
        tiemporealSetText('tiemporeal-temp-avg-a', 'Nodo A: ' + tiemporealFormatValue(tempStatsA.promedio, '°C'));
        tiemporealSetText('tiemporeal-temp-avg-b', 'Nodo B: ' + tiemporealFormatValue(tempStatsB.promedio, '°C'));

        tiemporealSetText('tiemporeal-hum-avg', tiemporealFormatValue(humStatsAll.promedio, '%'));
        tiemporealSetText('tiemporeal-hum-avg-a', 'Nodo A: ' + tiemporealFormatValue(humStatsA.promedio, '%'));
        tiemporealSetText('tiemporeal-hum-avg-b', 'Nodo B: ' + tiemporealFormatValue(humStatsB.promedio, '%'));

        ['promedio', 'maximo', 'minimo', 'mediana'].forEach(function (stat) {
            tiemporealSetText('tiemporeal-stat-temp-' + stat + '-a', tiemporealFormatValue(tempStatsA[stat], '°C'));
            tiemporealSetText('tiemporeal-stat-temp-' + stat + '-b', tiemporealFormatValue(tempStatsB[stat], '°C'));
            tiemporealSetText('tiemporeal-stat-hum-' + stat + '-a', tiemporealFormatValue(humStatsA[stat], '%'));
            tiemporealSetText('tiemporeal-stat-hum-' + stat + '-b', tiemporealFormatValue(humStatsB[stat], '%'));
        });
    }

    // -----------------------------------------------------------------
    // 2h. Tiempo Real Page: Estatus online/offline por nodo
    // -----------------------------------------------------------------
    // Refleja node_status_log (ver tiemporeal/models.py NodeStatus), que
    // backend/telemetry-worker.py llena al llegar un mensaje de
    // status/<node_id> (retained + LWT - ver Documentation/README.md). No
    // hay logica de "stale" aqui a proposito: el LWT ya hace que el broker
    // publique "offline" si un nodo se cae sin desconexion limpia, asi que
    // el ultimo estado guardado en DB es confiable tal cual.
    function tiemporealNodeLabel(nodeId) {
        return nodeId === 'nodo-a' ? 'Nodo A' : 'Nodo B';
    }

    function tiemporealRenderNodeStatus(nodeId, status) {
        const suffix = nodeId === 'nodo-a' ? 'a' : 'b';
        const label = tiemporealNodeLabel(nodeId);
        const state = status && status.state;
        const dotClass = state === 'online' ? 'status-dot-online'
            : state === 'offline' ? 'status-dot-offline'
            : 'status-dot-unknown';
        const text = state === 'online' ? label + ' online'
            : state === 'offline' ? label + ' offline'
            : label + ' --';

        ['temp', 'hum'].forEach(function (kind) {
            const dot = document.getElementById('tiemporeal-stat-' + kind + '-dot-' + suffix);
            if (dot) {
                dot.className = dotClass;
            }
            tiemporealSetText('tiemporeal-stat-' + kind + '-estatus-' + suffix, text);
        });
    }

    function tiemporealUpdateNodeStatusDisplay(nodeStatus) {
        if (!nodeStatus) {
            return;
        }
        tiemporealRenderNodeStatus('nodo-a', nodeStatus['nodo-a']);
        tiemporealRenderNodeStatus('nodo-b', nodeStatus['nodo-b']);
    }

    if (tiemporealDataEl) {
        tiemporealUpdateStatsDisplay();
        tiemporealUpdateNodeStatusDisplay(tiemporealChartData.nodeStatus);
    }

    // -----------------------------------------------------------------
    // 3. Total View Performance Chart (Donut Chart)
    // -----------------------------------------------------------------
    const viewsChartEl = document.querySelector('#views-chart');
    if (viewsChartEl) {
        const viewsChartOptions = {
            series: [68, 23, 16], // View Count (68%), Percentage (23%), Sales (16%)
            chart: {
                type: 'donut',
                height: 250,
                fontFamily: 'Plus Jakarta Sans, sans-serif'
            },
            labels: ['View Count', 'Percentage', 'Sales'],
            colors: ['#B4F105', '#051C12', '#F97316'], // Lime, Forest Dark, Orange
            states: {
                hover: {
                    filter: {
                        type: 'none'
                    }
                }
            },
            legend: {
                show: false // Custom HTML legend used below the chart
            },
            dataLabels: {
                enabled: false
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '72%',
                        background: 'transparent',
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#6C7E75',
                                offsetY: -8
                            },
                            value: {
                                show: true,
                                fontSize: '26px',
                                fontWeight: 800,
                                color: '#0B130F',
                                offsetY: 8,
                                formatter: function (val) {
                                    return val + "%";
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total Count',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6C7E75',
                                formatter: function (w) {
                                    return '565K';
                                }
                            }
                        }
                    }
                }
            },
            tooltip: {
                theme: 'dark'
            }
        };

        const viewsChart = new ApexCharts(viewsChartEl, viewsChartOptions);
        viewsChart.render();
    }

    // -----------------------------------------------------------------
    // 4. Sparkline Charts (Net Income & Total Return)
    // -----------------------------------------------------------------
    const incomeSparkOptions = {
        series: [{
            name: 'Net Income',
            data: [45, 51, 46, 58, 50, 62, 55, 72, 65, 79, 70, 85]
        }],
        chart: {
            type: 'area',
            height: 45,
            sparkline: {
                enabled: true
            },
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            opacity: 0.1,
            type: 'solid'
        },
        colors: ['#22C55E'], // Green color matching trend-up
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function (seriesName) {
                        return '';
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };

    const returnSparkOptions = {
        series: [{
            name: 'Total Return',
            data: [50, 48, 55, 45, 40, 38, 42, 35, 30, 28, 32, 24]
        }],
        chart: {
            type: 'area',
            height: 45,
            sparkline: {
                enabled: true
            },
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            opacity: 0.1,
            type: 'solid'
        },
        colors: ['#EF4444'], // Red color matching trend-down
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function (seriesName) {
                        return '';
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };

    const incomeSparkEl = document.querySelector('#income-sparkline');
    if (incomeSparkEl) {
        const incomeSpark = new ApexCharts(incomeSparkEl, incomeSparkOptions);
        incomeSpark.render();
    }

    const returnSparkEl = document.querySelector('#return-sparkline');
    if (returnSparkEl) {
        const returnSpark = new ApexCharts(returnSparkEl, returnSparkOptions);
        returnSpark.render();
    }

    // -----------------------------------------------------------------
    // 5. Flatpickr Date Range Picker Initialization
    // -----------------------------------------------------------------
    const datePickerTrigger = document.querySelector('#date-picker-trigger');
    const selectedRangeText = document.querySelector('#selected-date-range');
    
    if (datePickerTrigger && selectedRangeText) {
        flatpickr(datePickerTrigger, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            locale: 'es',
            defaultDate: ['2026-01-12', '2026-01-23'],
            onValueUpdate: function (selectedDates, dateStr, instance) {
                if (selectedDates.length === 2) {
                    const startStr = instance.formatDate(selectedDates[0], 'F j, Y');
                    const endStr = instance.formatDate(selectedDates[1], 'F j, Y');
                    selectedRangeText.textContent = `${startStr} - ${endStr}`;
                } else if (selectedDates.length === 1) {
                    const startStr = instance.formatDate(selectedDates[0], 'F j, Y');
                    selectedRangeText.textContent = startStr;
                }
            }
        });
    }

    // -----------------------------------------------------------------
    // 5b. Shared helper: reload the current page with updated query params
    // (used by both the Historico and Tiempo Real date/hour pickers)
    // -----------------------------------------------------------------
    function reloadWithQueryParams(updates) {
        const params = new URLSearchParams(window.location.search);
        Object.keys(updates).forEach(function (key) {
            if (updates[key]) {
                params.set(key, updates[key]);
            } else {
                params.delete(key);
            }
        });
        window.location.href = '?' + params.toString();
    }

    // -----------------------------------------------------------------
    // 5c. Historico Page: Single-Day Picker (reloads with ?fecha=)
    // -----------------------------------------------------------------
    const historicoDatePickerTrigger = document.querySelector('#historico-date-picker-trigger');

    if (historicoDatePickerTrigger) {
        flatpickr(historicoDatePickerTrigger, {
            mode: 'single',
            dateFormat: 'Y-m-d',
            locale: 'es',
            defaultDate: window.HISTORICO_SELECTED_DATE || undefined,
            onChange: function (selectedDates, dateStr) {
                if (dateStr) {
                    reloadWithQueryParams({ fecha: dateStr });
                }
            }
        });
    }

    // -----------------------------------------------------------------
    // 5d. Historico Page: Hour-Range Dropdown (reloads with ?hora_inicio=&hora_fin=)
    // -----------------------------------------------------------------
    const historicoHoraInicioInput = document.querySelector('#historico-hora-inicio-input');
    const historicoHoraFinInput = document.querySelector('#historico-hora-fin-input');
    const historicoHoraAplicarBtn = document.querySelector('#historico-hora-aplicar');

    if (historicoHoraAplicarBtn && historicoHoraInicioInput && historicoHoraFinInput) {
        historicoHoraAplicarBtn.addEventListener('click', function () {
            reloadWithQueryParams({
                hora_inicio: historicoHoraInicioInput.value || '00:00',
                hora_fin: historicoHoraFinInput.value || '23:59'
            });
        });
    }

    // -----------------------------------------------------------------
    // 5e. Tiempo Real Page: Live Clock (hora local del navegador, actualiza cada segundo)
    // -----------------------------------------------------------------
    const tiemporealLiveClockText = document.querySelector('#tiemporeal-live-clock-text');

    if (tiemporealLiveClockText) {
        const MESES_ES = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const pad2 = function (n) {
            return String(n).padStart(2, '0');
        };

        function updateTiemporealLiveClock() {
            const now = new Date();
            const fecha = now.getDate() + ' de ' + MESES_ES[now.getMonth()] + ' de ' + now.getFullYear();
            const hora = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
            tiemporealLiveClockText.textContent = fecha + ' - ' + hora;
        }

        updateTiemporealLiveClock();
        setInterval(updateTiemporealLiveClock, 1000);
    }

    // -----------------------------------------------------------------
    // 5f. Tiempo Real Page: Start-Hour Dropdown (reloads with ?hora_inicio=)
    // Vista de stream: solo la hora inicial es seleccionable, hora_fin
    // siempre es "ahora" y la calcula el servidor.
    // -----------------------------------------------------------------
    const tiemporealHoraInicioInput = document.querySelector('#tiemporeal-hora-inicio-input');
    const tiemporealHoraAplicarBtn = document.querySelector('#tiemporeal-hora-aplicar');

    if (tiemporealHoraAplicarBtn && tiemporealHoraInicioInput) {
        tiemporealHoraAplicarBtn.addEventListener('click', function () {
            reloadWithQueryParams({
                hora_inicio: tiemporealHoraInicioInput.value || '00:00'
            });
        });
    }

    // -----------------------------------------------------------------
    // 5g. Tiempo Real Page: Refresh Button (recarga la pagina)
    // -----------------------------------------------------------------
    const tiemporealRefreshBtn = document.querySelector('#tiemporeal-refresh-btn');
    if (tiemporealRefreshBtn) {
        tiemporealRefreshBtn.addEventListener('click', function () {
            window.location.reload();
        });
    }

    // -----------------------------------------------------------------
    // 6. Desktop Sidebar Minimize Interaction
    // -----------------------------------------------------------------
    const desktopToggleBtn = document.querySelector('#desktop-sidebar-toggle');
    if (desktopToggleBtn) {
        desktopToggleBtn.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-minimized');
            
            // Toggle icon direction
            const icon = desktopToggleBtn.querySelector('i');
            if (icon) {
                if (document.body.classList.contains('sidebar-minimized')) {
                    icon.className = 'bi bi-chevron-bar-right';
                } else {
                    icon.className = 'bi bi-chevron-bar-left';
                }
            }
            
            // Trigger a window resize event so that charts (ApexCharts) redraw correctly
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        });
    }

    // -----------------------------------------------------------------
    // 7. Configuracion Page: Parametros de alerta + alarmas (MQTT retained)
    // -----------------------------------------------------------------
    const configNodeDataEl = document.getElementById('config-node-data');
    if (configNodeDataEl) {
        const configNodeData = JSON.parse(configNodeDataEl.textContent);

        const configNodeTarget = document.getElementById('config-node-target');
        const configTempMin = document.getElementById('config-temp-min');
        const configTempMax = document.getElementById('config-temp-max');
        const configHumMin = document.getElementById('config-hum-min');
        const configHumMax = document.getElementById('config-hum-max');
        const configBuzzer = document.getElementById('config-buzzer-enabled');
        const configVisualAlarm = document.getElementById('config-visual-alarm-enabled');
        const configFan = document.getElementById('config-fan-enabled');
        const configFanManual = document.getElementById('config-fan-manual-enabled');
        const configRangoError = document.getElementById('config-rango-error');
        const configAlertArea = document.getElementById('config-alert-area');
        const configBtnActualizar = document.getElementById('config-btn-actualizar');
        const configBtnConfirmar = document.getElementById('config-btn-confirmar');
        const configConfirmTarget = document.getElementById('config-confirm-target');
        const configConfirmSummary = document.getElementById('config-confirm-summary');
        const configConfirmError = document.getElementById('config-confirm-error');
        const configModalEl = document.getElementById('config-confirm-modal');
        const configModal = (configModalEl && window.bootstrap) ? new bootstrap.Modal(configModalEl) : null;

        const configNodeLabels = {
            'nodo-a': 'Nodo A',
            'nodo-b': 'Nodo B',
            'ambos': 'Ambos nodos (Nodo A + Nodo B)'
        };

        // "Ambos" no tiene un estado propio: al elegirlo se parte de los
        // valores actuales del Nodo A como punto de partida para editar.
        function configFillForm(nodeId) {
            const baseline = configNodeData[nodeId] || configNodeData['nodo-a'];
            if (!baseline) {
                return;
            }
            configTempMin.value = baseline.temp_min;
            configTempMax.value = baseline.temp_max;
            configHumMin.value = baseline.hum_min;
            configHumMax.value = baseline.hum_max;
            configBuzzer.checked = !!baseline.buzzer_enabled;
            configVisualAlarm.checked = !!baseline.visual_alarm_enabled;
            configFan.checked = !!baseline.fan_enabled;
            configFanManual.checked = !!baseline.fan_manual_enabled;
        }

        if (configNodeTarget) {
            configFillForm(configNodeTarget.value);
            configNodeTarget.addEventListener('change', function () {
                configFillForm(configNodeTarget.value);
            });
        }

        // Inserta arriba de lo que ya hubiera (no reemplaza): el polling de
        // acks (ver mas abajo) puede mostrar varios avisos seguidos (uno
        // por nodo) y no deben taparse entre si. Cada uno se puede cerrar
        // por separado con su propia "x".
        function configShowAlert(type, message) {
            if (!configAlertArea) {
                return;
            }
            const div = document.createElement('div');
            div.className = 'alert-custom alert-custom-' + type;
            div.innerHTML =
                '<i class="bi ' + (type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill') + ' alert-custom-icon"></i>' +
                '<div class="alert-custom-content">' + message + '</div>' +
                '<button class="alert-custom-close" type="button" aria-label="Close" onclick="this.parentElement.remove();"><i class="bi bi-x-lg"></i></button>';
            configAlertArea.insertBefore(div, configAlertArea.firstChild);
        }

        function configReadForm() {
            return {
                node_target: configNodeTarget.value,
                temp_min: parseFloat(configTempMin.value),
                temp_max: parseFloat(configTempMax.value),
                hum_min: parseFloat(configHumMin.value),
                hum_max: parseFloat(configHumMax.value),
                buzzer_enabled: configBuzzer.checked,
                visual_alarm_enabled: configVisualAlarm.checked,
                fan_enabled: configFan.checked,
                fan_manual_enabled: configFanManual.checked
            };
        }

        function configValidate(payload) {
            if ([payload.temp_min, payload.temp_max, payload.hum_min, payload.hum_max].some(isNaN)) {
                return 'Todos los limites deben ser numericos.';
            }
            if (payload.temp_min >= payload.temp_max) {
                return 'La temperatura minima debe ser menor que la maxima.';
            }
            if (payload.hum_min >= payload.hum_max) {
                return 'La humedad minima debe ser menor que la maxima.';
            }
            return null;
        }

        // Grupos que el modal de "Confirmar y enviar" ofrece incluir o no
        // (ver configRenderConfirmRow()/configBtnConfirmar mas abajo). La
        // "key" de cada grupo debe coincidir con el sufijo que espera el
        // backend en "include_<key>" (ver CONFIG_FIELD_GROUPS en
        // configuracion/views.py).
        const configConfirmGroups = [
            {
                key: 'temp', label: 'Temperatura',
                valueText: function (p) { return p.temp_min + '&deg;C - ' + p.temp_max + '&deg;C'; }
            },
            {
                key: 'hum', label: 'Humedad',
                valueText: function (p) { return p.hum_min + '% - ' + p.hum_max + '%'; }
            },
            {
                key: 'buzzer', label: 'Alarma sonora',
                valueText: function (p) { return p.buzzer_enabled ? 'Activada' : 'Desactivada'; }
            },
            {
                key: 'visual_alarm', label: 'Alarma visual',
                valueText: function (p) { return p.visual_alarm_enabled ? 'Activada' : 'Desactivada'; }
            },
            {
                key: 'fan', label: 'Ventilador por umbral',
                valueText: function (p) { return p.fan_enabled ? 'Activado' : 'Desactivado'; }
            },
            {
                key: 'fan_manual', label: 'Ventilador manual',
                valueText: function (p) { return p.fan_manual_enabled ? 'Encendido (forzado)' : 'Apagado'; }
            }
        ];

        const CONFIG_CONFIRM_SIN_CAMBIOS = 'sin cambios (cada nodo conserva su valor actual)';

        // Cada fila trae su propio switch "Enviar": arranca encendido (se
        // manda todo por defecto, igual que antes de que existiera esta
        // opcion) y el operador apaga el/los parametros que no quiere
        // tocar en este envio especifico.
        function configRenderConfirmRow(group, payload) {
            return '<li class="config-confirm-row" data-group="' + group.key + '">' +
                '<div class="config-confirm-toggle">' +
                '<input class="form-switch-input-custom config-confirm-include" type="checkbox" ' +
                'id="config-confirm-include-' + group.key + '" checked>' +
                '<label class="visually-hidden" for="config-confirm-include-' + group.key + '">Enviar ' + group.label + '</label>' +
                '</div>' +
                '<div class="config-confirm-row-text"><strong>' + group.label + ':</strong> ' +
                '<span class="config-confirm-value">' + group.valueText(payload) + '</span></div>' +
                '</li>';
        }

        function configUpdateConfirmRowText(li, group, payload) {
            const checkbox = li.querySelector('.config-confirm-include');
            const valueSpan = li.querySelector('.config-confirm-value');
            if (!checkbox || !valueSpan) {
                return;
            }
            valueSpan.innerHTML = checkbox.checked ? group.valueText(payload) : CONFIG_CONFIRM_SIN_CAMBIOS;
        }

        let configPendingPayload = null;

        if (configBtnActualizar) {
            configBtnActualizar.addEventListener('click', function () {
                const payload = configReadForm();
                const errorMsg = configValidate(payload);
                if (configRangoError) {
                    configRangoError.classList.toggle('d-none', !errorMsg);
                    if (errorMsg) {
                        configRangoError.querySelector('span').textContent = errorMsg;
                    }
                }
                if (errorMsg) {
                    return;
                }

                configPendingPayload = payload;
                if (configConfirmTarget) {
                    configConfirmTarget.textContent = configNodeLabels[payload.node_target] || payload.node_target;
                }
                if (configConfirmError) {
                    configConfirmError.classList.add('d-none');
                }
                if (configConfirmSummary) {
                    // Arma una fila por parametro, cada una con su propio
                    // switch "Enviar" (ver configRenderConfirmRow()): la
                    // decision de que se manda vive aqui, en el modal, no
                    // en la pagina principal. Todas arrancan encendidas.
                    configConfirmSummary.innerHTML = configConfirmGroups
                        .map(function (group) { return configRenderConfirmRow(group, payload); })
                        .join('');

                    configConfirmGroups.forEach(function (group) {
                        const li = configConfirmSummary.querySelector('li[data-group="' + group.key + '"]');
                        const checkbox = li ? li.querySelector('.config-confirm-include') : null;
                        if (checkbox) {
                            checkbox.addEventListener('change', function () {
                                configUpdateConfirmRowText(li, group, payload);
                                if (configConfirmError) {
                                    configConfirmError.classList.add('d-none');
                                }
                            });
                        }
                    });
                }

                if (configModal) {
                    configModal.show();
                }
            });
        }

        function configGetCsrfToken() {
            const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        }

        // Feedback visual de "en vuelo": la publicacion MQTT puede tardar
        // varios segundos (hasta el timeout de PUBLISH_ACK_TIMEOUT_S en
        // mqtt_publish.py si el broker no confirma), asi que sin esto el
        // usuario no tenia forma de saber si el click si se registro.
        // Cancelar/cerrar se deshabilitan mientras tanto (y el modal usa
        // backdrop estatico) para que no se pueda abandonar el dialogo a
        // mitad de un envio que ya esta en curso del lado del servidor.
        const configBtnConfirmarContent = configBtnConfirmar ? configBtnConfirmar.querySelector('.config-btn-confirmar-content') : null;
        const configBtnConfirmarLoading = configBtnConfirmar ? configBtnConfirmar.querySelector('.config-btn-confirmar-loading') : null;
        const configBtnCancelar = document.getElementById('config-btn-cancelar');
        const configModalCloseBtn = document.getElementById('config-modal-close-btn');

        function configSetSending(isSending) {
            if (configBtnConfirmar) {
                configBtnConfirmar.disabled = isSending;
            }
            if (configBtnConfirmarContent) {
                configBtnConfirmarContent.classList.toggle('d-none', isSending);
            }
            if (configBtnConfirmarLoading) {
                configBtnConfirmarLoading.classList.toggle('d-none', !isSending);
            }
            if (configBtnCancelar) {
                configBtnCancelar.disabled = isSending;
            }
            if (configModalCloseBtn) {
                configModalCloseBtn.disabled = isSending;
            }
        }

        if (configBtnConfirmar) {
            configBtnConfirmar.addEventListener('click', function () {
                if (!configPendingPayload) {
                    return;
                }

                // Lee el switch "Enviar" de cada fila tal como quedo en el
                // modal (el operador pudo apagar alguno despues de abrirlo)
                // y lo traduce a los "include_<grupo>" que espera el
                // backend (ver CONFIG_FIELD_GROUPS en configuracion/views.py).
                const includeValues = {};
                let anyIncluded = false;
                configConfirmGroups.forEach(function (group) {
                    const checkbox = document.getElementById('config-confirm-include-' + group.key);
                    const checked = !!(checkbox && checkbox.checked);
                    includeValues['include_' + group.key] = checked;
                    anyIncluded = anyIncluded || checked;
                });

                if (!anyIncluded) {
                    if (configConfirmError) {
                        configConfirmError.classList.remove('d-none');
                        configConfirmError.querySelector('span').textContent =
                            'Activa el switch "Enviar" de al menos un parametro.';
                    }
                    return;
                }
                if (configConfirmError) {
                    configConfirmError.classList.add('d-none');
                }

                const payloadToSend = Object.assign({}, configPendingPayload, includeValues);

                configSetSending(true);
                fetch(window.CONFIG_ACTUALIZAR_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': configGetCsrfToken()
                    },
                    body: JSON.stringify(payloadToSend)
                })
                    .then(function (res) {
                        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
                    })
                    .then(function (result) {
                        if (configModal) {
                            configModal.hide();
                        }
                        if (result.ok && result.data.ok) {
                            // Sin mensaje inline aqui ni recarga de pagina:
                            // la confirmacion real (que el nodo de verdad
                            // la recibio y aplico) llega por separado como
                            // toast via el polling de acks de abajo, que
                            // necesita seguir corriendo en esta misma
                            // pagina para no perderla.
                        } else {
                            configShowAlert('danger', result.data.error || 'No se pudo publicar la configuracion.');
                        }
                    })
                    .catch(function (err) {
                        if (configModal) {
                            configModal.hide();
                        }
                        configShowAlert('danger', 'Error de red al publicar la configuracion.');
                        console.error('Error publicando configuracion:', err);
                    })
                    .finally(function () {
                        configSetSending(false);
                        configPendingPayload = null;
                    });
            });
        }

        // -------------------------------------------------------------
        // Configuracion Page: Polling de acks de confirmacion (config/.../ack)
        // -------------------------------------------------------------
        // Mismo patron de polling que Tiempo Real (tiemporealPoll() mas
        // arriba, ver tiemporeal/views.py -> tiemporeal_latest): el
        // navegador pregunta cada pocos segundos en vez de abrir una
        // conexion MQTT propia. Aqui se reciclo para leer los acks que el
        // nodo publica en config/<node_id>/ack al procesar cada mensaje
        // de configuracion (ver configuracion_ack_latest en
        // configuracion/views.py).
        const configAckToastArea = document.getElementById('config-ack-toast-area');

        // Toast fijo arriba de la pantalla (no el inline de configShowAlert):
        // el ack puede llegar en cualquier momento, sin importar donde este
        // viendo el usuario, asi que no conviene que dependa de scroll.
        // Se queda 10s y luego se difumina (config-ack-toast-fade en
        // main.css) antes de quitarse del DOM.
        function configShowAckToast(type, message) {
            if (!configAckToastArea) {
                return;
            }
            const div = document.createElement('div');
            div.className = 'alert-custom alert-custom-' + type + ' config-ack-toast';
            div.innerHTML =
                '<i class="bi ' + (type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill') + ' alert-custom-icon"></i>' +
                '<div class="alert-custom-content">' + message + '</div>' +
                '<button class="alert-custom-close" type="button" aria-label="Close"><i class="bi bi-x-lg"></i></button>';

            let dismissTimer = null;
            function dismiss() {
                if (dismissTimer) {
                    clearTimeout(dismissTimer);
                }
                div.classList.add('config-ack-toast-fade');
                div.addEventListener('transitionend', function () {
                    div.remove();
                }, { once: true });
            }

            div.querySelector('.alert-custom-close').addEventListener('click', dismiss);
            configAckToastArea.appendChild(div);
            dismissTimer = setTimeout(dismiss, 10000);
        }

        if (window.CONFIG_ACK_LATEST_URL) {
            const configAckReasonLabels = {
                invalid_json: 'JSON invalido',
                invalid_fields: 'campos invalidos o faltantes',
                fragmented: 'mensaje fragmentado'
            };
            const configAckNodeLabels = { 'nodo-a': 'Nodo A', 'nodo-b': 'Nodo B' };

            let configAckSince = window.CONFIG_ACK_SINCE_INIT || 0;
            let configAckPolling = false;

            function configAckMessage(ack) {
                const label = configAckNodeLabels[ack.node_id] || ack.node_id;
                if (ack.status === 'ok') {
                    if (ack.applied) {
                        return label + ' confirmo la nueva configuracion: ' +
                            ack.applied.temp_min + '&deg;C - ' + ack.applied.temp_max + '&deg;C, ' +
                            ack.applied.hum_min + '% - ' + ack.applied.hum_max + '%.';
                    }
                    return label + ' confirmo la nueva configuracion.';
                }
                const reason = configAckReasonLabels[ack.reason] || ack.reason || 'motivo desconocido';
                return label + ' no pudo aplicar la configuracion (' + reason + ').';
            }

            function configAckPoll() {
                if (configAckPolling) {
                    return;
                }
                configAckPolling = true;
                fetch(window.CONFIG_ACK_LATEST_URL + '?since=' + configAckSince)
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        (data.acks || []).forEach(function (ack) {
                            configShowAckToast(ack.status === 'ok' ? 'success' : 'danger', configAckMessage(ack));
                        });
                        if (data.lastEpochMs != null) {
                            configAckSince = data.lastEpochMs;
                        }
                    })
                    .catch(function (err) {
                        console.error('Error consultando acks de configuracion:', err);
                    })
                    .finally(function () {
                        configAckPolling = false;
                    });
            }

            configAckPoll();
            setInterval(configAckPoll, 5000);
        }
    }

});
