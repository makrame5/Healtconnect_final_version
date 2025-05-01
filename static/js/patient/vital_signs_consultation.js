document.addEventListener('DOMContentLoaded', function() {
    // Initialiser Socket.IO
    const socket = io();
    
    // Initialiser les graphiques
    initCharts();
    
    // Gérer les onglets
    initTabs();
    
    // Écouter les mises à jour des signaux vitaux
    listenForVitalSignUpdates(socket);
    
    // Simuler des données pour la démonstration
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Mode de démonstration activé: simulation de données de capteurs pendant la consultation');
        simulateVitalSignUpdates();
    }
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

// Initialiser les onglets
function initTabs() {
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Désactiver tous les onglets et contenus
            tabItems.forEach(tab => tab.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activer l'onglet et le contenu sélectionnés
            this.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Écouter les mises à jour des signaux vitaux
function listenForVitalSignUpdates(socket) {
    socket.on('vital_sign_update', function(data) {
        updateVitalSign(data);
    });
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
    
    // Envoyer les données au médecin
    sendVitalSignToDoctor(data);
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

// Envoyer les données de signaux vitaux au médecin
function sendVitalSignToDoctor(data) {
    // Récupérer l'ID du rendez-vous depuis les attributs de données du body
    const appointmentId = document.body.getAttribute('data-appointment-id');
    
    if (appointmentId) {
        // Ajouter l'ID du rendez-vous aux données
        data.appointment_id = appointmentId;
        
        // Émettre un événement Socket.IO pour envoyer les données au médecin
        const socket = io();
        socket.emit('vital_sign_to_doctor', data);
        
        console.log('Données de signaux vitaux envoyées au médecin:', data);
    }
}

// Simuler des mises à jour de signaux vitaux
function simulateVitalSignUpdates() {
    const vitalTypes = ['heartrate', 'blood_pressure', 'temperature', 'oxygen'];
    
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
    
    // Générer des données simulées pour chaque type
    const currentValues = { ...initialValues };
    
    // Mettre à jour les valeurs initiales
    vitalTypes.forEach(type => {
        if (type === 'blood_pressure') {
            const displayValue = `${currentValues[type].systolic}/${currentValues[type].diastolic}`;
            
            updateVitalSign({
                type: type,
                value: displayValue,
                unit: 'mmHg',
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type])
            });
        } else {
            let unit;
            
            switch (type) {
                case 'heartrate':
                    unit = 'bpm';
                    break;
                case 'temperature':
                    unit = '°C';
                    break;
                case 'oxygen':
                    unit = '%';
                    break;
            }
            
            updateVitalSign({
                type: type,
                value: currentValues[type],
                unit: unit,
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type])
            });
        }
    });
    
    // Mettre à jour les valeurs périodiquement
    setInterval(() => {
        // Choisir un type aléatoire
        const type = vitalTypes[Math.floor(Math.random() * vitalTypes.length)];
        
        // Générer une nouvelle valeur
        if (type === 'blood_pressure') {
            // Pour la tension artérielle, nous avons deux valeurs
            const systolicChange = randomInRange(-3, 3);
            const diastolicChange = randomInRange(-2, 2);
            
            currentValues[type] = {
                systolic: Math.round(currentValues[type].systolic + systolicChange),
                diastolic: Math.round(currentValues[type].diastolic + diastolicChange)
            };
            
            // Formater la valeur pour l'affichage
            const displayValue = `${currentValues[type].systolic}/${currentValues[type].diastolic}`;
            
            // Mettre à jour l'interface
            updateVitalSign({
                type: type,
                value: displayValue,
                unit: 'mmHg',
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type])
            });
        } else {
            // Pour les autres types, nous avons une seule valeur
            let change;
            let unit;
            
            switch (type) {
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
            
            currentValues[type] = parseFloat((currentValues[type] + change).toFixed(1));
            
            // Mettre à jour l'interface
            updateVitalSign({
                type: type,
                value: currentValues[type],
                unit: unit,
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type])
            });
        }
    }, 2000); // Mettre à jour toutes les 2 secondes
}
