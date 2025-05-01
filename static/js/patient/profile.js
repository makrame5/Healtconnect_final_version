/**
 * Profile Patient - Scripts
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

    // Gestion des onglets du profil
    setupProfileTabs();

    // Initialisation des graphiques si Chart.js est disponible
    if (typeof Chart !== 'undefined') {
        initializeVitalsCharts();
    }

    // Gestion des notifications
    setupNotifications();

    // Gestion du menu profil
    setupProfileMenu();

    // Gestion du thème sombre/clair
    setupThemeToggle();
});

/**
 * Configure les onglets du profil
 */
function setupProfileTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    const sections = document.querySelectorAll('.profile-section');

    if (!tabs.length || !sections.length) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Récupérer l'ID de la section à afficher
            const targetId = this.getAttribute('data-target');

            // Désactiver tous les onglets et sections
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Activer l'onglet cliqué et la section correspondante
            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            // Sauvegarder l'onglet actif dans le localStorage
            localStorage.setItem('activeProfileTab', targetId);
        });
    });

    // Restaurer l'onglet actif depuis le localStorage ou utiliser le premier onglet par défaut
    const activeTabId = localStorage.getItem('activeProfileTab');

    if (activeTabId && document.getElementById(activeTabId)) {
        document.querySelector(`.profile-tab[data-target="${activeTabId}"]`).click();
    } else {
        // Activer le premier onglet par défaut
        tabs[0].click();
    }
}

/**
 * Initialise les graphiques des signaux vitaux
 */
function initializeVitalsCharts() {
    // Graphique de tension artérielle
    const tensionCtx = document.getElementById('tension-chart');

    if (tensionCtx) {
        const tensionChart = new Chart(tensionCtx, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                datasets: [
                    {
                        label: 'Systolique',
                        data: [120, 118, 125, 119, 122, 120, 118],
                        borderColor: '#2471A3',
                        backgroundColor: 'rgba(36, 113, 163, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Diastolique',
                        data: [80, 78, 82, 79, 81, 80, 78],
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
                        position: 'top',
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

    // Graphique de glycémie
    const glycemieCtx = document.getElementById('glycemie-chart');

    if (glycemieCtx) {
        const glycemieChart = new Chart(glycemieCtx, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                datasets: [
                    {
                        label: 'Glycémie',
                        data: [95, 98, 92, 96, 95, 97, 94],
                        borderColor: '#E74C3C',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
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
                        position: 'top',
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

    // Graphique de fréquence cardiaque
    const heartRateCtx = document.getElementById('heart-rate-chart');

    if (heartRateCtx) {
        const heartRateChart = new Chart(heartRateCtx, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                datasets: [
                    {
                        label: 'Fréquence cardiaque',
                        data: [72, 75, 70, 73, 71, 74, 72],
                        borderColor: '#9B59B6',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
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
                        position: 'top',
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
}

// Les fonctions setupNotifications et setupProfileMenu ont été déplacées dans header.js

/**
 * Fonction pour éditer le profil
 */
function editProfile() {
    // Redirection vers la page d'édition du profil
    window.location.href = '/patient/edit-profile';

    // Afficher un message de chargement
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'loading-message';
    loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement de la page d\'édition...';
    document.body.appendChild(loadingMessage);

    // Supprimer le message après la redirection
    setTimeout(() => {
        if (document.body.contains(loadingMessage)) {
            document.body.removeChild(loadingMessage);
        }
    }, 2000);
}

/**
 * Prévisualiser l'avatar avant l'upload
 */
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function(e) {
            // Afficher l'image dans la prévisualisation
            document.getElementById('profile-avatar').src = e.target.result;

            // Afficher les boutons de sauvegarde et d'annulation
            document.getElementById('save-avatar-btn').style.display = 'inline-block';
            document.getElementById('cancel-avatar-btn').style.display = 'inline-block';

            // Cacher le bouton d'édition du profil
            document.querySelector('.btn-edit-profile').style.display = 'none';
        }

        reader.readAsDataURL(input.files[0]);
    }
}

// Ajouter les gestionnaires d'événements pour les boutons de sauvegarde et d'annulation
document.addEventListener('DOMContentLoaded', function() {
    const saveAvatarBtn = document.getElementById('save-avatar-btn');
    const cancelAvatarBtn = document.getElementById('cancel-avatar-btn');
    const avatarForm = document.getElementById('avatar-form');
    const profileAvatar = document.getElementById('profile-avatar');

    if (saveAvatarBtn && cancelAvatarBtn && avatarForm) {
        // Sauvegarder l'avatar
        saveAvatarBtn.addEventListener('click', function() {
            // Soumettre le formulaire
            avatarForm.submit();
        });

        // Annuler l'upload
        cancelAvatarBtn.addEventListener('click', function() {
            // Réinitialiser le formulaire
            avatarForm.reset();

            // Restaurer l'image d'origine
            const originalSrc = profileAvatar.getAttribute('data-original-src') ||
                                profileAvatar.src;
            profileAvatar.src = originalSrc;

            // Cacher les boutons de sauvegarde et d'annulation
            saveAvatarBtn.style.display = 'none';
            cancelAvatarBtn.style.display = 'none';

            // Afficher le bouton d'édition du profil
            document.querySelector('.btn-edit-profile').style.display = 'inline-block';
        });

        // Sauvegarder l'URL d'origine de l'avatar
        if (profileAvatar) {
            profileAvatar.setAttribute('data-original-src', profileAvatar.src);
        }
    }
});

/**
 * Fonction pour voir les détails d'une consultation
 * @param {string} consultationId - ID de la consultation
 */
function viewConsultationDetails(consultationId) {
    // Redirection vers la page de détails de la consultation
    window.location.href = `/patient/consultations/${consultationId}`;
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
 * Fonction pour annuler un rendez-vous
 * @param {string} appointmentId - ID du rendez-vous
 */
function cancelAppointment(appointmentId) {
    if (confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous ?')) {
        // Appel API pour annuler le rendez-vous
        fetch(`/api/patient/appointments/${appointmentId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Rendez-vous annulé avec succès.');
                // Recharger la page pour mettre à jour la liste des rendez-vous
                window.location.reload();
            } else {
                alert(`Erreur: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Une erreur est survenue lors de l\'annulation du rendez-vous.');
        });
    }
}

/**
 * Fonction pour prendre un nouveau rendez-vous avec un médecin
 * @param {string} doctorId - ID du médecin
 */
function newAppointment(doctorId) {
    // Redirection vers la page de prise de rendez-vous
    window.location.href = `/patient/request-appointment/${doctorId}`;
}

// La fonction setupThemeToggle a été déplacée dans header.js
