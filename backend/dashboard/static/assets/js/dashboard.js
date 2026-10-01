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
        const temp = window.HISTORICO_THRESHOLDS || { tempMin: 18, tempMax: 30 };
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
                yaxis: [
                    {
                        y: temp.tempMax,
                        y2: temp.tempMax + 100,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: temp.tempMin - 100,
                        y2: temp.tempMin,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: temp.tempMax,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Max ' + temp.tempMax + '°C',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    },
                    {
                        y: temp.tempMin,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Min ' + temp.tempMin + '°C',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    }
                ]
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
        const hum = window.HISTORICO_THRESHOLDS || { humMin: 30, humMax: 70 };
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
                yaxis: [
                    {
                        y: hum.humMax,
                        y2: hum.humMax + 100,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: hum.humMin - 100,
                        y2: hum.humMin,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: hum.humMax,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Max ' + hum.humMax + '%',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    },
                    {
                        y: hum.humMin,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Min ' + hum.humMin + '%',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    }
                ]
            }
        };

        const historicoSecondaryChart = new ApexCharts(historicoSecondaryEl, historicoSecondaryOptions);
        historicoSecondaryChart.render();
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
        const temp = window.TIEMPOREAL_THRESHOLDS || { tempMin: 18, tempMax: 30 };
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
                yaxis: [
                    {
                        y: temp.tempMax,
                        y2: temp.tempMax + 100,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: temp.tempMin - 100,
                        y2: temp.tempMin,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: temp.tempMax,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Max ' + temp.tempMax + '°C',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    },
                    {
                        y: temp.tempMin,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Min ' + temp.tempMin + '°C',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    }
                ]
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
        const hum = window.TIEMPOREAL_THRESHOLDS || { humMin: 30, humMax: 70 };
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
                yaxis: [
                    {
                        y: hum.humMax,
                        y2: hum.humMax + 100,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: hum.humMin - 100,
                        y2: hum.humMin,
                        fillColor: 'url(#dangerHatch)',
                        opacity: 0.5,
                        borderColor: 'transparent'
                    },
                    {
                        y: hum.humMax,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Max ' + hum.humMax + '%',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    },
                    {
                        y: hum.humMin,
                        borderColor: '#EF4444',
                        strokeDashArray: 4,
                        label: {
                            text: 'Min ' + hum.humMin + '%',
                            position: 'left',
                            offsetX: 40,
                            style: {
                                color: '#FFFFFF',
                                background: '#EF4444',
                                fontSize: '10px'
                            }
                        }
                    }
                ]
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
                    (data.tempSeriesA || []).forEach(function (point, i) {
                        tiemporealProcessPoint('nodo-a', point[0], point[1], data.humSeriesA[i][1]);
                    });
                    (data.tempSeriesB || []).forEach(function (point, i) {
                        tiemporealProcessPoint('nodo-b', point[0], point[1], data.humSeriesB[i][1]);
                    });
                    if (data.lastEpochMs != null) {
                        tiemporealSince = data.lastEpochMs;
                    }
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

});
