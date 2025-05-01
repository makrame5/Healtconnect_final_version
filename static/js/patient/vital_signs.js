document.addEventListener('DOMContentLoaded', function() {
    // Initialiser Socket.IO
    const socket = io();
    
    // Initialiser les graphiques
    initVitalHistoryChart();
    
    // Écouter les mises à jour des signaux vitaux
    listenForVitalSignUpdates(socket);
    
    // Gérer les filtres d'historique
    initHistoryFilters();
    
    // Gérer les seuils personnalisés
    initThresholdControls();
    
    // Charger les données initiales
    loadInitialData();
});

// Initialiser le graphique d'historique
function initVitalHistoryChart() {
    const ctx = document.getElementById('vital-history-chart').getContext('2d');
    
    window.vitalHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Valeur',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'DD/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Valeur'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Écouter les mises à jour des signaux vitaux
function listenForVitalSignUpdates(socket) {
    socket.on('vital_sign_update', function(data) {
        updateVitalSign(data);
        addVitalSignToHistory(data);
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
}

// Ajouter un signal vital à l'historique
function addVitalSignToHistory(data) {
    // Mettre à jour le graphique si le type sélectionné correspond
    const selectedType = document.getElementById('vital-type-filter').value;
    if (data.type === selectedType) {
        updateHistoryChart([data]);
    }
    
    // Mettre à jour le tableau d'historique
    updateHistoryTable([data], true);
}

// Initialiser les filtres d'historique
function initHistoryFilters() {
    const typeFilter = document.getElementById('vital-type-filter');
    const periodFilter = document.getElementById('vital-period-filter');
    
    if (typeFilter && periodFilter) {
        typeFilter.addEventListener('change', function() {
            loadHistoryData(this.value, periodFilter.value);
        });
        
        periodFilter.addEventListener('change', function() {
            loadHistoryData(typeFilter.value, this.value);
        });
    }
}

// Charger les données d'historique
function loadHistoryData(type, period) {
    // Simuler un chargement de données pour la démonstration
    // Dans une implémentation réelle, cela ferait une requête AJAX au serveur
    
    const now = new Date();
    const data = [];
    
    // Déterminer la date de début en fonction de la période
    let startDate;
    switch (period) {
        case 'day':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'year':
            startDate = new Date(now);
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
    }
    
    // Générer des données aléatoires pour la période
    const dataPoints = period === 'day' ? 24 : period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const interval = period === 'day' ? 60 * 60 * 1000 : period === 'week' ? 24 * 60 * 60 * 1000 : period === 'month' ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    
    // Valeurs de base et variations pour chaque type
    const baseValues = {
        'heartrate': 72,
        'blood_pressure': { systolic: 120, diastolic: 80 },
        'temperature': 36.8,
        'oxygen': 98
    };
    
    const variations = {
        'heartrate': 10,
        'blood_pressure': { systolic: 15, diastolic: 10 },
        'temperature': 0.5,
        'oxygen': 2
    };
    
    for (let i = 0; i < dataPoints; i++) {
        const timestamp = new Date(startDate.getTime() + i * interval);
        
        let value;
        let is_abnormal = false;
        
        if (type === 'blood_pressure') {
            const systolic = baseValues.blood_pressure.systolic + (Math.random() * 2 - 1) * variations.blood_pressure.systolic;
            const diastolic = baseValues.blood_pressure.diastolic + (Math.random() * 2 - 1) * variations.blood_pressure.diastolic;
            
            value = `${Math.round(systolic)}/${Math.round(diastolic)}`;
            is_abnormal = systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
        } else {
            const baseValue = baseValues[type];
            const variation = variations[type];
            
            value = parseFloat((baseValue + (Math.random() * 2 - 1) * variation).toFixed(1));
            
            // Déterminer si la valeur est anormale
            switch (type) {
                case 'heartrate':
                    is_abnormal = value < 60 || value > 100;
                    break;
                case 'temperature':
                    is_abnormal = value < 36.1 || value > 37.8;
                    break;
                case 'oxygen':
                    is_abnormal = value < 95;
                    break;
            }
        }
        
        data.push({
            type: type,
            value: value,
            timestamp: timestamp,
            is_abnormal: is_abnormal
        });
    }
    
    // Mettre à jour le graphique et le tableau
    updateHistoryChart(data);
    updateHistoryTable(data);
}

// Mettre à jour le graphique d'historique
function updateHistoryChart(data) {
    if (!window.vitalHistoryChart) return;
    
    const chart = window.vitalHistoryChart;
    const type = document.getElementById('vital-type-filter').value;
    
    // Réinitialiser les données du graphique
    if (!data[0]?.append) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        
        // Configurer le graphique en fonction du type
        switch (type) {
            case 'heartrate':
                chart.options.scales.y.title.text = 'Battements par minute (bpm)';
                chart.data.datasets[0].borderColor = '#e74c3c';
                chart.data.datasets[0].backgroundColor = 'rgba(231, 76, 60, 0.1)';
                break;
            case 'blood_pressure':
                chart.options.scales.y.title.text = 'mmHg';
                chart.data.datasets[0].borderColor = '#3498db';
                chart.data.datasets[0].backgroundColor = 'rgba(52, 152, 219, 0.1)';
                
                // Pour la tension artérielle, nous avons besoin de deux jeux de données
                chart.data.datasets = [
                    {
                        label: 'Systolique',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Diastolique',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: false,
                        tension: 0.4
                    }
                ];
                break;
            case 'temperature':
                chart.options.scales.y.title.text = 'Température (°C)';
                chart.data.datasets[0].borderColor = '#f39c12';
                chart.data.datasets[0].backgroundColor = 'rgba(243, 156, 18, 0.1)';
                break;
            case 'oxygen':
                chart.options.scales.y.title.text = 'Saturation (%)';
                chart.data.datasets[0].borderColor = '#2ecc71';
                chart.data.datasets[0].backgroundColor = 'rgba(46, 204, 113, 0.1)';
                break;
        }
    }
    
    // Ajouter les nouvelles données
    for (const item of data) {
        const time = new Date(item.timestamp);
        
        if (type === 'blood_pressure') {
            // Pour la tension artérielle, la valeur est au format "120/80"
            const [systolic, diastolic] = item.value.split('/').map(v => parseInt(v));
            
            if (!data[0]?.append || chart.data.labels.indexOf(time) === -1) {
                chart.data.labels.push(time);
                chart.data.datasets[0].data.push(systolic);
                chart.data.datasets[1].data.push(diastolic);
            }
        } else {
            if (!data[0]?.append || chart.data.labels.indexOf(time) === -1) {
                chart.data.labels.push(time);
                chart.data.datasets[0].data.push(item.value);
            }
        }
    }
    
    // Trier les données par date
    const sortedIndices = chart.data.labels.map((_, i) => i).sort((a, b) => chart.data.labels[a] - chart.data.labels[b]);
    
    chart.data.labels = sortedIndices.map(i => chart.data.labels[i]);
    chart.data.datasets.forEach(dataset => {
        dataset.data = sortedIndices.map(i => dataset.data[i]);
    });
    
    // Mettre à jour le graphique
    chart.update();
}

// Mettre à jour le tableau d'historique
function updateHistoryTable(data, prepend = false) {
    const tableBody = document.getElementById('vital-history-table-body');
    if (!tableBody) return;
    
    // Vider le tableau si nous ne prépendons pas
    if (!prepend) {
        tableBody.innerHTML = '';
    }
    
    // Ajouter les nouvelles données
    for (const item of data) {
        const time = new Date(item.timestamp);
        const dateStr = time.toLocaleDateString();
        const timeStr = time.toLocaleTimeString();
        
        const row = document.createElement('tr');
        
        // Ajouter la classe pour les valeurs anormales
        if (item.is_abnormal) {
            row.classList.add('abnormal-value');
        }
        
        // Formater le type pour l'affichage
        let typeDisplay;
        let unitDisplay;
        
        switch (item.type) {
            case 'heartrate':
                typeDisplay = 'Fréquence cardiaque';
                unitDisplay = 'bpm';
                break;
            case 'blood_pressure':
                typeDisplay = 'Tension artérielle';
                unitDisplay = 'mmHg';
                break;
            case 'temperature':
                typeDisplay = 'Température';
                unitDisplay = '°C';
                break;
            case 'oxygen':
                typeDisplay = 'Saturation en oxygène';
                unitDisplay = '%';
                break;
            default:
                typeDisplay = item.type;
                unitDisplay = '';
        }
        
        // Construire la ligne du tableau
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${typeDisplay}</td>
            <td>${item.value} ${unitDisplay}</td>
            <td class="${item.is_abnormal ? 'status-abnormal' : 'status-normal'}">
                ${item.is_abnormal ? '<i class="fas fa-exclamation-triangle"></i> Anormal' : '<i class="fas fa-check-circle"></i> Normal'}
            </td>
        `;
        
        // Ajouter la ligne au tableau (au début ou à la fin)
        if (prepend) {
            tableBody.insertBefore(row, tableBody.firstChild);
        } else {
            tableBody.appendChild(row);
        }
    }
    
    // Si le tableau est vide, afficher un message
    if (tableBody.children.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">Aucune donnée disponible</td>';
        tableBody.appendChild(row);
    }
}

// Initialiser les contrôles de seuils
function initThresholdControls() {
    const saveButtons = document.querySelectorAll('.btn-save-threshold');
    
    saveButtons.forEach(button => {
        button.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            saveThresholds(type);
        });
    });
}

// Sauvegarder les seuils
function saveThresholds(type) {
    let minValue, maxValue;
    
    switch (type) {
        case 'heartrate':
            minValue = document.getElementById('heartrate-min').value;
            maxValue = document.getElementById('heartrate-max').value;
            break;
        case 'blood_pressure':
            // Pour la tension artérielle, nous avons deux paires de valeurs
            const systolicMin = document.getElementById('systolic-min').value;
            const systolicMax = document.getElementById('systolic-max').value;
            const diastolicMin = document.getElementById('diastolic-min').value;
            const diastolicMax = document.getElementById('diastolic-max').value;
            
            minValue = { systolic: systolicMin, diastolic: diastolicMin };
            maxValue = { systolic: systolicMax, diastolic: diastolicMax };
            break;
        case 'temperature':
            minValue = document.getElementById('temperature-min').value;
            maxValue = document.getElementById('temperature-max').value;
            break;
        case 'oxygen':
            minValue = document.getElementById('oxygen-min').value;
            maxValue = document.getElementById('oxygen-max').value;
            break;
    }
    
    // Simuler une sauvegarde pour la démonstration
    // Dans une implémentation réelle, cela ferait une requête AJAX au serveur
    console.log(`Seuils sauvegardés pour ${type}:`, { min: minValue, max: maxValue });
    
    // Afficher un message de confirmation
    alert(`Les seuils pour ${getTypeDisplayName(type)} ont été sauvegardés avec succès.`);
}

// Obtenir le nom d'affichage d'un type
function getTypeDisplayName(type) {
    switch (type) {
        case 'heartrate':
            return 'la fréquence cardiaque';
        case 'blood_pressure':
            return 'la tension artérielle';
        case 'temperature':
            return 'la température';
        case 'oxygen':
            return 'la saturation en oxygène';
        default:
            return type;
    }
}

// Charger les données initiales
function loadInitialData() {
    // Charger les données d'historique pour le type et la période sélectionnés
    const typeFilter = document.getElementById('vital-type-filter');
    const periodFilter = document.getElementById('vital-period-filter');
    
    if (typeFilter && periodFilter) {
        loadHistoryData(typeFilter.value, periodFilter.value);
    }
    
    // Simuler des mises à jour en temps réel pour la démonstration
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Mode de démonstration activé: simulation de données de capteurs');
        simulateVitalSignUpdates();
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
                is_abnormal: isAbnormal(type, currentValues[type]),
                append: true
            });
            
            // Ajouter à l'historique
            addVitalSignToHistory({
                type: type,
                value: displayValue,
                unit: 'mmHg',
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type]),
                append: true
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
                is_abnormal: isAbnormal(type, currentValues[type]),
                append: true
            });
            
            // Ajouter à l'historique
            addVitalSignToHistory({
                type: type,
                value: currentValues[type],
                unit: unit,
                timestamp: new Date(),
                is_abnormal: isAbnormal(type, currentValues[type]),
                append: true
            });
        }
    }, 5000); // Mettre à jour toutes les 5 secondes
}
