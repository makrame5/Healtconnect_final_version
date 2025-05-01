document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            mainContent.classList.toggle('main-content-expanded');
        });
    }

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-open');
        });
    }

    // Vérifier si nous avons des paramètres d'URL pour la consultation vidéo
    const urlParams = new URLSearchParams(window.location.search);
    const appointmentId = urlParams.get('appointment_id');
    const roomId = urlParams.get('room_id');

    // Si nous avons un ID de rendez-vous et un ID de salle dans l'URL, afficher la section de consultation vidéo
    if (appointmentId && roomId) {
        console.log('Paramètres de consultation vidéo détectés dans l\'URL:', { appointmentId, roomId });

        // Vérifier si la section de consultation vidéo existe
        const videoConsultationSection = document.getElementById('video-consultation-section');
        if (videoConsultationSection) {
            console.log('Affichage de la section de consultation vidéo');
            videoConsultationSection.style.display = 'block';

            // Faire défiler jusqu'à la section de consultation
            videoConsultationSection.scrollIntoView({ behavior: 'smooth' });

            // Mettre à jour l'élément caché pour l'ID de salle
            const roomIdElement = document.getElementById('room-id');
            if (roomIdElement) {
                roomIdElement.value = roomId;
            }

            // Définir les attributs de données sur le body pour le JavaScript de vidéo
            document.body.setAttribute('data-room-id', roomId);
            document.body.setAttribute('data-appointment-id', appointmentId);

            console.log('Attributs de données définis sur le body:', {
                'data-room-id': document.body.getAttribute('data-room-id'),
                'data-appointment-id': document.body.getAttribute('data-appointment-id')
            });
        }
    }

    // Gérer les clics sur les boutons "Rejoindre la consultation"
    const joinConsultationBtns = document.querySelectorAll('.join-consultation-btn');
    joinConsultationBtns.forEach(button => {
        button.addEventListener('click', function(e) {
            // Empêcher le comportement par défaut du bouton
            e.preventDefault();

            // Récupérer les données du bouton
            const roomId = this.getAttribute('data-room-id');
            const appointmentId = this.getAttribute('data-appointment-id');

            if (roomId && appointmentId) {
                console.log('Redirection vers la consultation vidéo avec les paramètres:', { appointmentId, roomId });

                // Rediriger vers la même page avec les paramètres d'URL
                window.location.href = `${window.location.pathname}?appointment_id=${appointmentId}&room_id=${roomId}`;
            } else {
                console.error('ID de salle ou ID de rendez-vous manquant');
                alert('Erreur: Impossible de rejoindre la consultation. Veuillez réessayer.');
            }
        });
    });

    // Countdown timer for upcoming appointments
    const countdownElements = document.querySelectorAll('.appointment-countdown');

    if (countdownElements.length > 0) {
        // Update countdown every second
        setInterval(updateCountdowns, 1000);

        // Initial update
        updateCountdowns();
    }

    function updateCountdowns() {
        countdownElements.forEach(element => {
            const appointmentTime = new Date(element.getAttribute('data-time')).getTime();
            const now = new Date().getTime();
            const timeLeft = appointmentTime - now;

            if (timeLeft > 0) {
                // Calculate days, hours, minutes, seconds
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                // Display countdown
                if (days > 0) {
                    element.textContent = `${days}j ${hours}h ${minutes}m ${seconds}s`;
                } else if (hours > 0) {
                    element.textContent = `${hours}h ${minutes}m ${seconds}s`;
                } else {
                    element.textContent = `${minutes}m ${seconds}s`;
                }

                // Change color when less than 1 hour
                if (timeLeft < 1000 * 60 * 60) {
                    element.style.color = '#e74c3c';
                }
            } else {
                element.textContent = 'Maintenant !';
                element.style.color = '#2ecc71';

                // Enable join button
                const joinButton = element.closest('.appointment-card').querySelector('.join-consultation-btn');
                if (joinButton) {
                    joinButton.classList.remove('disabled');
                }
            }
        });
    }
});
