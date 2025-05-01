/**
 * Dashboard Patient - Scripts
 */

document.addEventListener('DOMContentLoaded', function() {
    // Gestion du toggle de la sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    if (sidebarToggle && sidebar && mainContent) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            mainContent.classList.toggle('main-content-expanded');
        });
    }
    
    // Gestion du menu mobile
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-open');
        });
        
        // Fermer le menu quand on clique en dehors
        document.addEventListener('click', function(event) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggle = mobileMenuToggle.contains(event.target);
            
            if (!isClickInsideSidebar && !isClickOnToggle && sidebar.classList.contains('sidebar-open')) {
                sidebar.classList.remove('sidebar-open');
            }
        });
    }
    
    // Initialisation des graphiques si Chart.js est disponible
    if (typeof Chart !== 'undefined') {
        initializeHealthChart();
    }
    
    // Gestion des notifications
    setupNotifications();
    
    // Gestion du profil utilisateur
    setupUserProfile();
});

/**
 * Initialise le graphique d'évolution de la santé
 */
function initializeHealthChart() {
    const ctx = document.getElementById('health-chart');
    
    if (!ctx) return;
    
    const healthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [
                {
                    label: 'Tension',
                    data: [120, 118, 125, 119, 122, 120, 118],
                    borderColor: '#2471A3',
                    backgroundColor: 'rgba(36, 113, 163, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Glycémie',
                    data: [95, 98, 92, 96, 95, 97, 94],
                    borderColor: '#58D68D',
                    backgroundColor: 'rgba(88, 214, 141, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Configure les notifications
 */
function setupNotifications() {
    const notificationIcon = document.querySelector('.topbar-notification');
    
    if (!notificationIcon) return;
    
    notificationIcon.addEventListener('click', function() {
        // Ici, on pourrait afficher un dropdown avec les notifications
        console.log('Notifications clicked');
    });
}

/**
 * Configure le menu du profil utilisateur
 */
function setupUserProfile() {
    const profileElement = document.querySelector('.topbar-profile');
    
    if (!profileElement) return;
    
    profileElement.addEventListener('click', function() {
        // Redirection vers la page de profil
        window.location.href = '/patient/profile';
    });
}

/**
 * Fonction pour rejoindre une consultation vidéo
 * @param {string} appointmentId - ID du rendez-vous
 */
function joinVideoConsultation(appointmentId) {
    // Redirection vers la page de consultation vidéo
    window.location.href = `/patient/consultation/${appointmentId}`;
}

/**
 * Fonction pour reprogrammer un rendez-vous
 * @param {string} appointmentId - ID du rendez-vous
 */
function rescheduleAppointment(appointmentId) {
    // Redirection vers la page de reprogrammation
    window.location.href = `/patient/reschedule-appointment/${appointmentId}`;
}

/**
 * Fonction pour voir les détails d'un message
 * @param {string} messageId - ID du message
 */
function viewMessageDetails(messageId) {
    // Redirection vers la page de détails du message
    window.location.href = `/patient/messages/${messageId}`;
}

/**
 * Fonction pour voir les détails d'un résultat d'analyse
 * @param {string} resultId - ID du résultat
 */
function viewResultDetails(resultId) {
    // Redirection vers la page de détails du résultat
    window.location.href = `/patient/results/${resultId}`;
}

/**
 * Fonction pour voir les détails d'une prescription
 * @param {string} prescriptionId - ID de la prescription
 */
function viewPrescriptionDetails(prescriptionId) {
    // Redirection vers la page de détails de la prescription
    window.location.href = `/patient/prescriptions/${prescriptionId}`;
}
