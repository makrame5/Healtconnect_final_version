/**
 * Gestion des notifications de rappel de rendez-vous
 */

document.addEventListener('DOMContentLoaded', function() {
    // Créer le conteneur de notifications de rappel s'il n'existe pas déjà
    if (!document.querySelector('.appointment-reminder-container')) {
        const reminderContainer = document.createElement('div');
        reminderContainer.className = 'appointment-reminder-container';
        document.body.appendChild(reminderContainer);
    }
    
    // Écouter les événements de rappel de rendez-vous via Socket.IO
    if (socket) {
        socket.on('appointment_reminder', function(notification) {
            console.log('Rappel de rendez-vous reçu:', notification);
            showAppointmentReminder(notification);
        });
    }
});

/**
 * Affiche une notification de rappel de rendez-vous
 * @param {Object} notification - Objet notification
 */
function showAppointmentReminder(notification) {
    const container = document.querySelector('.appointment-reminder-container');
    if (!container) return;
    
    // Créer l'élément de notification
    const reminderElement = document.createElement('div');
    reminderElement.className = 'appointment-reminder';
    reminderElement.setAttribute('data-notification-id', notification.id);
    
    // Déterminer l'URL de redirection en fonction du rôle de l'utilisateur
    let redirectUrl = '#';
    let userRole = document.body.getAttribute('data-user-role') || '';
    
    if (userRole === 'doctor') {
        redirectUrl = `/doctor/virtual_office/${notification.related_id}`;
    } else if (userRole === 'patient') {
        redirectUrl = `/patient/consultation/${notification.related_id}`;
    }
    
    // Créer le contenu HTML
    reminderElement.innerHTML = `
        <div class="appointment-reminder-icon">
            <i class="fas fa-video"></i>
        </div>
        <div class="appointment-reminder-content">
            <div class="appointment-reminder-title">
                <i class="fas fa-exclamation-circle"></i> ${notification.title}
            </div>
            <div class="appointment-reminder-text">${notification.content}</div>
            <div class="appointment-reminder-actions">
                <a href="${redirectUrl}" class="appointment-reminder-btn appointment-reminder-btn-primary">
                    <i class="fas fa-video"></i> Rejoindre maintenant
                </a>
                <button class="appointment-reminder-btn appointment-reminder-btn-secondary dismiss-reminder">
                    <i class="fas fa-clock"></i> Me rappeler dans 1 min
                </button>
            </div>
        </div>
        <button class="appointment-reminder-close" aria-label="Fermer">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Ajouter au conteneur
    container.appendChild(reminderElement);
    
    // Jouer un son de notification si disponible
    playNotificationSound();
    
    // Gérer le clic sur le bouton de fermeture
    const closeButton = reminderElement.querySelector('.appointment-reminder-close');
    closeButton.addEventListener('click', function() {
        reminderElement.remove();
    });
    
    // Gérer le clic sur le bouton "Me rappeler dans 1 min"
    const dismissButton = reminderElement.querySelector('.dismiss-reminder');
    dismissButton.addEventListener('click', function() {
        reminderElement.remove();
        
        // Programmer un nouveau rappel dans 1 minute
        setTimeout(function() {
            showAppointmentReminder(notification);
        }, 60000); // 60 secondes
    });
    
    // Supprimer automatiquement après 5 minutes
    setTimeout(function() {
        if (reminderElement.parentNode) {
            reminderElement.remove();
        }
    }, 300000); // 5 minutes
}

/**
 * Joue un son de notification
 */
function playNotificationSound() {
    // Vérifier si un élément audio existe déjà
    let notificationSound = document.getElementById('notification-sound');
    
    // Si non, créer un nouvel élément audio
    if (!notificationSound) {
        notificationSound = document.createElement('audio');
        notificationSound.id = 'notification-sound';
        notificationSound.src = '/static/sounds/notification.mp3';
        notificationSound.style.display = 'none';
        document.body.appendChild(notificationSound);
    }
    
    // Jouer le son
    notificationSound.play().catch(error => {
        console.log('Impossible de jouer le son de notification:', error);
    });
}
