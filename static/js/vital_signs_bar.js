/**
 * Barre de signaux vitaux pour la visio-consultation
 * Affiche les signaux vitaux du patient en temps réel pendant la consultation vidéo
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la barre de signaux vitaux
    initVitalSignsBar();
    
    // Initialiser les graphiques
    initVitalSignsCharts();
    
    // Écouter les mises à jour des signaux vitaux
    listenForVitalSignUpdates();
    
    // En mode développement, simuler des données
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        simulateVitalSignData();
    }
});

/**
 * Initialise la barre de signaux vitaux
 */
function initVitalSignsBar() {
    // Récupérer les éléments
    const barToggle = document.getElementById('vital-signs-bar-toggle');
    const vitalSignsBar = document.getElementById('vital-signs-bar');
    const historyButton = document.getElementById('vital-signs-history-button');
    const historyPopup = document.getElementById('vital-signs-history-popup');
    const historyClose = document.getElementById('vital-signs-history-close');
    const historyOverlay = document.getElementById('vital-signs-overlay');
    const historyTabs = document.querySelectorAll('.history-tab');
    
    // Gérer le toggle de la barre
    if (barToggle) {
        barToggle.addEventListener('click', function() {
            vitalSignsBar.classList.toggle('minimized');
            
            // Mettre à jour l'icône
            if (vitalSignsBar.classList.contains('minimized')) {
                barToggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
            } else {
                barToggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            }
        });
    }
    
    // Gérer le bouton d'historique
    if (historyButton) {
        historyButton.addEventListener('click', function() {
            historyPopup.classList.add('active');
            historyOverlay.classList.add('active');
            
            // Mettre à jour les graphiques d'historique
            updateHistoryCharts();
        });
    }
    
    // Gérer la fermeture du popup d'historique
    if (historyClose) {
        historyClose.addEventListener('click', function() {
            historyPopup.classList.remove('active');
            historyOverlay.classList.remove('active');
        });
    }
    
    // Gérer le clic sur l'overlay
    if (historyOverlay) {
        historyOverlay.addEventListener('click', function() {
            historyPopup.classList.remove('active');
            historyOverlay.classList.remove('active');
        });
    }
    
    // Gérer les onglets d'historique
    if (historyTabs) {
        historyTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Retirer la classe active de tous les onglets
                historyTabs.forEach(t => t.classList.remove('active'));
                
                // Ajouter la classe active à l'onglet cliqué
                this.classList.add('active');
                
                // Mettre à jour le graphique d'historique
                updateHistoryCharts(this.getAttribute('data-type'));
            });
        });
    }
}

/**
 * Initialise les mini-graphiques dans la barre de signaux vitaux
 */
function initVitalSignsCharts() {
    // Configuration commune pour tous les graphiques
    const commonConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            },
            elements: {
                point: {
                    radius: 0
                },
                line: {
                    tension: 0.4,
                    borderWidth: 1.5
                }
            },
            animation: false
        }
    };
    
    // Créer les graphiques
    window.vitalSignsCharts = {
        heartrate: createChart('heartrate-chart', '#e74c3c', commonConfig),
        bloodPressure: createBloodPressureChart('blood-pressure-chart', commonConfig),
        temperature: createChart('temperature-chart', '#f39c12', commonConfig),
        oxygen: createChart('oxygen-chart', '#2ecc71', commonConfig)
    };
    
    // Créer les graphiques d'historique
    window.historyCharts = {
        heartrate: createHistoryChart('history-heartrate-chart', '#e74c3c', 'Fréquence cardiaque (bpm)'),
        bloodPressure: createBloodPressureHistoryChart('history-blood-pressure-chart'),
        temperature: createHistoryChart('history-temperature-chart', '#f39c12', 'Température (°C)'),
        oxygen: createHistoryChart('history-oxygen-chart', '#2ecc71', 'Saturation en oxygène (%)')
    };
}

/**
 * Crée un mini-graphique pour un signal vital
 */
function createChart(canvasId, color, commonConfig) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    const config = {
        ...commonConfig,
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                data: Array(20).fill(null),
                borderColor: color,
                backgroundColor: color + '20',
                fill: true
            }]
        }
    };
    
    return new Chart(ctx, config);
}

/**
 * Crée un mini-graphique spécifique pour la tension artérielle
 */
function createBloodPressureChart(canvasId, commonConfig) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    const config = {
        ...commonConfig,
        data: {
            labels: Array(20).fill(''),
            datasets: [
                {
                    data: Array(20).fill(null),
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    fill: false
                },
                {
                    data: Array(20).fill(null),
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    fill: false
                }
            ]
        }
    };
    
    return new Chart(ctx, config);
}

/**
 * Crée un graphique d'historique pour un signal vital
 */
function createHistoryChart(canvasId, color, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    const config = {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color + '20',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Heure'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: label
                    }
                }
            }
        }
    };
    
    return new Chart(ctx, config);
}

/**
 * Crée un graphique d'historique spécifique pour la tension artérielle
 */
function createBloodPressureHistoryChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    const config = {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Systolique (mmHg)',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    fill: false
                },
                {
                    label: 'Diastolique (mmHg)',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Heure'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Tension artérielle (mmHg)'
                    }
                }
            }
        }
    };
    
    return new Chart(ctx, config);
}

/**
 * Écoute les mises à jour des signaux vitaux via Socket.IO
 */
function listenForVitalSignUpdates() {
    // Vérifier si Socket.IO est disponible
    if (typeof io === 'undefined') {
        console.error('Socket.IO n\'est pas disponible');
        return;
    }
    
    // Initialiser Socket.IO
    const socket = io();
    
    // Écouter les mises à jour des signaux vitaux
    socket.on('vital_sign_update', function(data) {
        updateVitalSign(data);
    });
    
    // Écouter les mises à jour des signaux vitaux pendant la consultation
    socket.on('vital_sign_to_doctor', function(data) {
        updateVitalSign(data);
    });
    
    // Écouter les mises à jour des signaux vitaux du patient
    socket.on('vital_sign_from_patient', function(data) {
        updateVitalSign(data);
    });
}

/**
 * Met à jour l'affichage d'un signal vital
 */
function updateVitalSign(data) {
    const { type, value, unit, is_abnormal } = data;
    
    // Récupérer les éléments
    const section = document.getElementById(`${type}-section`);
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);
    
    if (!section || !valueElement) return;
    
    // Mettre à jour la valeur
    valueElement.textContent = value;
    valueElement.classList.add('value-updated');
    setTimeout(() => {
        valueElement.classList.remove('value-updated');
    }, 500);
    
    // Mettre à jour le statut
    section.classList.remove('normal', 'warning', 'danger');
    
    if (is_abnormal === true) {
        section.classList.add('danger');
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
        }
    } else if (is_abnormal === 'warning') {
        section.classList.add('warning');
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        }
    } else {
        section.classList.add('normal');
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i>';
        }
    }
    
    // Mettre à jour le graphique
    updateVitalSignChart(type, value, data.timestamp);
    
    // Stocker les données pour l'historique
    storeVitalSignData(type, value, data.timestamp);
}

/**
 * Met à jour le mini-graphique d'un signal vital
 */
function updateVitalSignChart(type, value, timestamp) {
    const chart = window.vitalSignsCharts[getChartKey(type)];
    if (!chart) return;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    
    if (type === 'blood_pressure') {
        // Pour la tension artérielle, la valeur est au format "120/80"
        const [systolic, diastolic] = value.split('/').map(v => parseInt(v));
        
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(systolic);
        chart.data.datasets[1].data.push(diastolic);
        
        // Limiter le nombre de points
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
    } else {
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(parseFloat(value));
        
        // Limiter le nombre de points
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
    }
    
    chart.update();
}

/**
 * Stocke les données d'un signal vital pour l'historique
 */
function storeVitalSignData(type, value, timestamp) {
    // Initialiser le stockage si nécessaire
    if (!window.vitalSignsHistory) {
        window.vitalSignsHistory = {
            heartrate: [],
            blood_pressure: {
                systolic: [],
                diastolic: []
            },
            temperature: [],
            oxygen: []
        };
    }
    
    const time = timestamp ? new Date(timestamp) : new Date();
    
    if (type === 'blood_pressure') {
        // Pour la tension artérielle, la valeur est au format "120/80"
        const [systolic, diastolic] = value.split('/').map(v => parseInt(v));
        
        window.vitalSignsHistory.blood_pressure.systolic.push({
            x: time,
            y: systolic
        });
        
        window.vitalSignsHistory.blood_pressure.diastolic.push({
            x: time,
            y: diastolic
        });
        
        // Limiter le nombre de points
        if (window.vitalSignsHistory.blood_pressure.systolic.length > 100) {
            window.vitalSignsHistory.blood_pressure.systolic.shift();
            window.vitalSignsHistory.blood_pressure.diastolic.shift();
        }
    } else {
        window.vitalSignsHistory[type].push({
            x: time,
            y: parseFloat(value)
        });
        
        // Limiter le nombre de points
        if (window.vitalSignsHistory[type].length > 100) {
            window.vitalSignsHistory[type].shift();
        }
    }
}

/**
 * Met à jour les graphiques d'historique
 */
function updateHistoryCharts(activeType) {
    if (!window.vitalSignsHistory || !window.historyCharts) return;
    
    // Si aucun type n'est spécifié, utiliser le type actif
    if (!activeType) {
        const activeTab = document.querySelector('.history-tab.active');
        if (activeTab) {
            activeType = activeTab.getAttribute('data-type');
        } else {
            activeType = 'heartrate';
        }
    }
    
    // Mettre à jour le graphique correspondant au type actif
    const chartKey = getChartKey(activeType);
    const chart = window.historyCharts[chartKey];
    
    if (!chart) return;
    
    if (activeType === 'blood_pressure') {
        chart.data.labels = window.vitalSignsHistory.blood_pressure.systolic.map(d => d.x);
        chart.data.datasets[0].data = window.vitalSignsHistory.blood_pressure.systolic.map(d => d.y);
        chart.data.datasets[1].data = window.vitalSignsHistory.blood_pressure.diastolic.map(d => d.y);
    } else {
        chart.data.labels = window.vitalSignsHistory[activeType].map(d => d.x);
        chart.data.datasets[0].data = window.vitalSignsHistory[activeType].map(d => d.y);
    }
    
    chart.update();
}

/**
 * Obtient la clé du graphique correspondant au type de signal vital
 */
function getChartKey(type) {
    const chartKeyMap = {
        'heartrate': 'heartrate',
        'blood_pressure': 'bloodPressure',
        'temperature': 'temperature',
        'oxygen': 'oxygen'
    };
    
    return chartKeyMap[type] || type;
}

/**
 * Simule des données de signaux vitaux pour le développement
 */
function simulateVitalSignData() {
    console.log('Mode de développement : simulation de données de signaux vitaux');
    
    // Valeurs initiales
    const initialValues = {
        heartrate: 72,
        blood_pressure: { systolic: 120, diastolic: 80 },
        temperature: 36.8,
        oxygen: 98
    };
    
    // Plages normales
    const normalRanges = {
        heartrate: { min: 60, max: 100 },
        blood_pressure: { 
            systolic: { min: 90, max: 140 },
            diastolic: { min: 60, max: 90 }
        },
        temperature: { min: 36.1, max: 37.2 },
        oxygen: { min: 95, max: 100 }
    };
    
    // Valeurs courantes
    const currentValues = { ...initialValues };
    
    // Initialiser les valeurs
    updateVitalSign({
        type: 'heartrate',
        value: currentValues.heartrate.toString(),
        unit: 'bpm',
        is_abnormal: false,
        timestamp: new Date()
    });
    
    updateVitalSign({
        type: 'blood_pressure',
        value: `${currentValues.blood_pressure.systolic}/${currentValues.blood_pressure.diastolic}`,
        unit: 'mmHg',
        is_abnormal: false,
        timestamp: new Date()
    });
    
    updateVitalSign({
        type: 'temperature',
        value: currentValues.temperature.toString(),
        unit: '°C',
        is_abnormal: false,
        timestamp: new Date()
    });
    
    updateVitalSign({
        type: 'oxygen',
        value: currentValues.oxygen.toString(),
        unit: '%',
        is_abnormal: false,
        timestamp: new Date()
    });
    
    // Mettre à jour les valeurs périodiquement
    setInterval(() => {
        // Fréquence cardiaque
        currentValues.heartrate += (Math.random() - 0.5) * 4;
        currentValues.heartrate = Math.round(Math.max(40, Math.min(180, currentValues.heartrate)));
        
        const isHeartrateAbnormal = 
            currentValues.heartrate < normalRanges.heartrate.min || 
            currentValues.heartrate > normalRanges.heartrate.max;
        
        updateVitalSign({
            type: 'heartrate',
            value: currentValues.heartrate.toString(),
            unit: 'bpm',
            is_abnormal: isHeartrateAbnormal,
            timestamp: new Date()
        });
        
        // Tension artérielle
        currentValues.blood_pressure.systolic += (Math.random() - 0.5) * 3;
        currentValues.blood_pressure.diastolic += (Math.random() - 0.5) * 2;
        
        currentValues.blood_pressure.systolic = Math.round(Math.max(80, Math.min(200, currentValues.blood_pressure.systolic)));
        currentValues.blood_pressure.diastolic = Math.round(Math.max(40, Math.min(120, currentValues.blood_pressure.diastolic)));
        
        const isBloodPressureAbnormal = 
            currentValues.blood_pressure.systolic < normalRanges.blood_pressure.systolic.min || 
            currentValues.blood_pressure.systolic > normalRanges.blood_pressure.systolic.max ||
            currentValues.blood_pressure.diastolic < normalRanges.blood_pressure.diastolic.min || 
            currentValues.blood_pressure.diastolic > normalRanges.blood_pressure.diastolic.max;
        
        updateVitalSign({
            type: 'blood_pressure',
            value: `${currentValues.blood_pressure.systolic}/${currentValues.blood_pressure.diastolic}`,
            unit: 'mmHg',
            is_abnormal: isBloodPressureAbnormal,
            timestamp: new Date()
        });
        
        // Température
        currentValues.temperature += (Math.random() - 0.5) * 0.1;
        currentValues.temperature = Math.max(35, Math.min(40, currentValues.temperature));
        currentValues.temperature = parseFloat(currentValues.temperature.toFixed(1));
        
        const isTemperatureAbnormal = 
            currentValues.temperature < normalRanges.temperature.min || 
            currentValues.temperature > normalRanges.temperature.max;
        
        updateVitalSign({
            type: 'temperature',
            value: currentValues.temperature.toString(),
            unit: '°C',
            is_abnormal: isTemperatureAbnormal,
            timestamp: new Date()
        });
        
        // Saturation en oxygène
        currentValues.oxygen += (Math.random() - 0.5) * 1;
        currentValues.oxygen = Math.round(Math.max(85, Math.min(100, currentValues.oxygen)));
        
        const isOxygenAbnormal = 
            currentValues.oxygen < normalRanges.oxygen.min;
        
        updateVitalSign({
            type: 'oxygen',
            value: currentValues.oxygen.toString(),
            unit: '%',
            is_abnormal: isOxygenAbnormal,
            timestamp: new Date()
        });
    }, 2000);
}
