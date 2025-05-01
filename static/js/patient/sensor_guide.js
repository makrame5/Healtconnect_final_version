document.addEventListener('DOMContentLoaded', function() {
    // Initialiser Socket.IO
    const socket = io();
    
    // Initialiser les graphiques
    initCharts();
    
    // Gérer les accordéons
    initAccordion();
    
    // Gérer les boutons de connexion des capteurs
    initSensorConnections();
    
    // Écouter les mises à jour des signaux vitaux
    listenForVitalSignUpdates(socket);
});

// Initialiser les graphiques Chart.js
function initCharts() {
    // Configuration commune pour tous les graphiques
    const commonConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
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
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.4
                },
                point: {
                    radius: 0
                }
            }
        }
    };
    
    // Données initiales (vides)
    const emptyData = {
        labels: [],
        datasets: [{
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            fill: true
        }]
    };
    
    // Créer les graphiques
    window.charts = {
        heartrate: new Chart(
            document.getElementById('heartrate-chart').getContext('2d'),
            {
                ...commonConfig,
                data: JSON.parse(JSON.stringify(emptyData)),
                options: {
                    ...commonConfig.options,
                    scales: {
                        ...commonConfig.options.scales,
                        y: {
                            ...commonConfig.options.scales.y,
                            min: 40,
                            max: 180
                        }
                    }
                }
            }
        ),
        bloodPressure: new Chart(
            document.getElementById('blood-pressure-chart').getContext('2d'),
            {
                ...commonConfig,
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Systolique',
                            data: [],
                            borderColor: '#e74c3c',
                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                            fill: false
                        },
                        {
                            label: 'Diastolique',
                            data: [],
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            fill: false
                        }
                    ]
                },
                options: {
                    ...commonConfig.options,
                    scales: {
                        ...commonConfig.options.scales,
                        y: {
                            ...commonConfig.options.scales.y,
                            min: 40,
                            max: 180
                        }
                    }
                }
            }
        ),
        temperature: new Chart(
            document.getElementById('temperature-chart').getContext('2d'),
            {
                ...commonConfig,
                data: JSON.parse(JSON.stringify(emptyData)),
                options: {
                    ...commonConfig.options,
                    scales: {
                        ...commonConfig.options.scales,
                        y: {
                            ...commonConfig.options.scales.y,
                            min: 35,
                            max: 42
                        }
                    }
                }
            }
        ),
        oxygen: new Chart(
            document.getElementById('oxygen-chart').getContext('2d'),
            {
                ...commonConfig,
                data: JSON.parse(JSON.stringify(emptyData)),
                options: {
                    ...commonConfig.options,
                    scales: {
                        ...commonConfig.options.scales,
                        y: {
                            ...commonConfig.options.scales.y,
                            min: 80,
                            max: 100
                        }
                    }
                }
            }
        )
    };
    
    // Définir les couleurs des graphiques
    window.charts.heartrate.data.datasets[0].borderColor = '#e74c3c';
    window.charts.heartrate.data.datasets[0].backgroundColor = 'rgba(231, 76, 60, 0.1)';
    
    window.charts.temperature.data.datasets[0].borderColor = '#f39c12';
    window.charts.temperature.data.datasets[0].backgroundColor = 'rgba(243, 156, 18, 0.1)';
    
    window.charts.oxygen.data.datasets[0].borderColor = '#2ecc71';
    window.charts.oxygen.data.datasets[0].backgroundColor = 'rgba(46, 204, 113, 0.1)';
}

// Initialiser les accordéons
function initAccordion() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        
        header.addEventListener('click', () => {
            // Fermer tous les autres accordéons
            accordionItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Basculer l'état de l'accordéon actuel
            item.classList.toggle('active');
        });
    });
}

// Initialiser les connexions des capteurs
function initSensorConnections() {
    const connectButtons = document.querySelectorAll('.btn-connect-sensor');
    
    connectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sensorType = this.getAttribute('data-sensor-type');
            const statusCard = document.getElementById(`${sensorType}-sensor-status`);
            const statusIndicator = statusCard.querySelector('.status-indicator');
            const statusText = statusCard.querySelector('.status-text');
            
            // Simuler une connexion en cours
            statusIndicator.classList.remove('connected', 'disconnected');
            statusIndicator.classList.add('connecting');
            statusText.textContent = 'Connexion en cours...';
            this.disabled = true;
            
            // Simuler une connexion réussie après un délai
            setTimeout(() => {
                // Simuler une connexion réussie (ou échec aléatoire pour démonstration)
                const success = Math.random() > 0.2; // 80% de chance de succès
                
                if (success) {
                    statusIndicator.classList.remove('connecting', 'disconnected');
                    statusIndicator.classList.add('connected');
                    statusText.textContent = 'Connecté';
                    this.textContent = 'Déconnecter';
                    this.innerHTML = '<i class="fas fa-times"></i> Déconnecter';
                    
                    // Émettre un événement de connexion de capteur
                    socket.emit('sensor_connected', {
                        type: sensorType,
                        patient_id: document.body.getAttribute('data-user-id')
                    });
                    
                    // Commencer à simuler des données pour ce capteur
                    startSimulatingData(sensorType);
                } else {
                    statusIndicator.classList.remove('connecting', 'connected');
                    statusIndicator.classList.add('disconnected');
                    statusText.textContent = 'Échec de connexion';
                    
                    // Afficher un message d'erreur
                    alert(`Échec de la connexion au capteur ${getSensorName(sensorType)}. Veuillez vérifier que le capteur est allumé et à proximité.`);
                }
                
                this.disabled = false;
            }, 2000);
        });
    });
}

// Obtenir le nom convivial d'un type de capteur
function getSensorName(sensorType) {
    const names = {
        'heartrate': 'cardiaque',
        'blood_pressure': 'de tension artérielle',
        'temperature': 'de température',
        'oxygen': 'd\'oxygène'
    };
    
    return names[sensorType] || sensorType;
}

// Écouter les mises à jour des signaux vitaux
function listenForVitalSignUpdates(socket) {
    socket.on('vital_sign_update', function(data) {
        updateVitalSign(data);
    });
    
    // Pour la démonstration, simuler des données
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Mode de démonstration activé: simulation de données de capteurs');
    }
}

// Mettre à jour l'affichage d'un signal vital
function updateVitalSign(data) {
    const { type, value, unit, timestamp, is_abnormal } = data;
    
    // Mettre à jour la valeur affichée
    const valueElement = document.getElementById(`${type}-value`);
    if (valueElement) {
        valueElement.textContent = value;
        valueElement.classList.add('value-updated');
        setTimeout(() => {
            valueElement.classList.remove('value-updated');
        }, 500);
    }
    
    // Mettre à jour le statut
    const statusElement = document.getElementById(`${type}-status`);
    if (statusElement) {
        statusElement.classList.remove('normal', 'warning', 'danger');
        
        if (is_abnormal) {
            statusElement.classList.add('danger');
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Valeur anormale';
        } else {
            statusElement.classList.add('normal');
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Normal';
        }
    }
    
    // Mettre à jour le graphique
    updateChart(type, value, timestamp);
}

// Mettre à jour un graphique avec une nouvelle valeur
function updateChart(type, value, timestamp) {
    const chart = getChartByType(type);
    if (!chart) return;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    
    if (type === 'blood_pressure') {
        // Pour la tension artérielle, la valeur est au format "120/80"
        const [systolic, diastolic] = value.split('/').map(v => parseInt(v));
        
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(systolic);
        chart.data.datasets[1].data.push(diastolic);
    } else {
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(value);
    }
    
    // Limiter le nombre de points à afficher
    const maxPoints = 20;
    if (chart.data.labels.length > maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }
    
    chart.update();
}

// Obtenir le graphique correspondant à un type de signal vital
function getChartByType(type) {
    const chartMap = {
        'heartrate': window.charts.heartrate,
        'blood_pressure': window.charts.bloodPressure,
        'temperature': window.charts.temperature,
        'oxygen': window.charts.oxygen
    };
    
    return chartMap[type];
}

// Simuler des données pour un type de capteur
function startSimulatingData(sensorType) {
    // Valeurs initiales
    const initialValues = {
        'heartrate': 72,
        'blood_pressure': { systolic: 120, diastolic: 80 },
        'temperature': 36.8,
        'oxygen': 98
    };
    
    // Plages normales
    const normalRanges = {
        'heartrate': { min: 60, max: 100 },
        'blood_pressure': { systolic: { min: 90, max: 140 }, diastolic: { min: 60, max: 90 } },
        'temperature': { min: 36.1, max: 37.2 },
        'oxygen': { min: 95, max: 100 }
    };
    
    // Fonction pour générer une valeur aléatoire dans une plage
    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    // Fonction pour vérifier si une valeur est anormale
    function isAbnormal(type, value) {
        if (type === 'blood_pressure') {
            const { systolic, diastolic } = value;
            return systolic < normalRanges.blood_pressure.systolic.min || 
                   systolic > normalRanges.blood_pressure.systolic.max ||
                   diastolic < normalRanges.blood_pressure.diastolic.min ||
                   diastolic > normalRanges.blood_pressure.diastolic.max;
        } else {
            return value < normalRanges[type].min || value > normalRanges[type].max;
        }
    }
    
    // Générer des données simulées
    let currentValue = initialValues[sensorType];
    
    const interval = setInterval(() => {
        // Vérifier si le capteur est toujours connecté
        const statusCard = document.getElementById(`${sensorType}-sensor-status`);
        const statusIndicator = statusCard?.querySelector('.status-indicator');
        
        if (!statusIndicator || !statusIndicator.classList.contains('connected')) {
            clearInterval(interval);
            return;
        }
        
        // Générer une nouvelle valeur
        if (sensorType === 'blood_pressure') {
            // Pour la tension artérielle, nous avons deux valeurs
            const systolicChange = randomInRange(-3, 3);
            const diastolicChange = randomInRange(-2, 2);
            
            currentValue = {
                systolic: Math.round(currentValue.systolic + systolicChange),
                diastolic: Math.round(currentValue.diastolic + diastolicChange)
            };
            
            // Formater la valeur pour l'affichage
            const displayValue = `${currentValue.systolic}/${currentValue.diastolic}`;
            
            // Mettre à jour l'interface
            updateVitalSign({
                type: sensorType,
                value: displayValue,
                unit: 'mmHg',
                timestamp: new Date(),
                is_abnormal: isAbnormal(sensorType, currentValue)
            });
        } else {
            // Pour les autres types, nous avons une seule valeur
            let change;
            let unit;
            
            switch (sensorType) {
                case 'heartrate':
                    change = randomInRange(-2, 2);
                    unit = 'bpm';
                    break;
                case 'temperature':
                    change = randomInRange(-0.1, 0.1);
                    unit = '°C';
                    break;
                case 'oxygen':
                    change = randomInRange(-0.5, 0.5);
                    unit = '%';
                    break;
            }
            
            currentValue = parseFloat((currentValue + change).toFixed(1));
            
            // Mettre à jour l'interface
            updateVitalSign({
                type: sensorType,
                value: currentValue,
                unit: unit,
                timestamp: new Date(),
                is_abnormal: isAbnormal(sensorType, currentValue)
            });
        }
    }, 2000); // Mettre à jour toutes les 2 secondes
}
