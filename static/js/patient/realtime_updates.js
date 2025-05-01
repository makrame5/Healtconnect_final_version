/**
 * Gestion des mises à jour en temps réel pour les rendez-vous
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation des mises à jour en temps réel pour les rendez-vous...');
    
    // Vérifier si Socket.IO est disponible
    if (typeof io === 'undefined') {
        console.error('Socket.IO n\'est pas chargé. Les mises à jour en temps réel ne fonctionneront pas.');
        return;
    }
    
    // Initialiser la connexion Socket.IO
    const socket = io();
    
    // Écouter les mises à jour de rendez-vous
    socket.on('appointment_update', function(data) {
        console.log('Mise à jour de rendez-vous reçue:', data);
        
        // Mettre à jour l'interface utilisateur en fonction du statut du rendez-vous
        updateAppointmentUI(data);
    });
    
    /**
     * Met à jour l'interface utilisateur en fonction des données du rendez-vous
     * @param {Object} appointmentData - Données du rendez-vous
     */
    function updateAppointmentUI(appointmentData) {
        const appointmentId = appointmentData.id;
        const status = appointmentData.status;
        
        // Trouver tous les éléments liés à ce rendez-vous
        const appointmentElements = document.querySelectorAll(`.appointment-card[data-appointment-id="${appointmentId}"]`);
        
        if (appointmentElements.length === 0) {
            console.log(`Aucun élément trouvé pour le rendez-vous ${appointmentId}. Rechargement de la page...`);
            // Si nous sommes sur la page des rendez-vous ou l'espace patient-médecin, recharger la page
            if (window.location.pathname.includes('/appointments') || 
                window.location.pathname.includes('/doctor-patient-space')) {
                window.location.reload();
            }
            return;
        }
        
        console.log(`${appointmentElements.length} éléments trouvés pour le rendez-vous ${appointmentId}`);
        
        // Mettre à jour chaque élément
        appointmentElements.forEach(function(element) {
            // Mettre à jour le statut
            const statusElement = element.querySelector('.appointment-status');
            if (statusElement) {
                // Supprimer les classes de statut existantes
                statusElement.classList.remove('status-pending', 'status-accepted', 'status-rejected', 'status-completed', 'status-cancelled');
                
                // Ajouter la nouvelle classe de statut
                statusElement.classList.add(`status-${status}`);
                
                // Mettre à jour le texte du statut
                let statusText = '';
                switch (status) {
                    case 'pending':
                        statusText = 'En attente';
                        break;
                    case 'accepted':
                        statusText = 'Confirmé';
                        break;
                    case 'rejected':
                        statusText = 'Refusé';
                        break;
                    case 'completed':
                        statusText = 'Terminé';
                        break;
                    case 'cancelled':
                        statusText = 'Annulé';
                        break;
                    default:
                        statusText = status;
                }
                statusElement.textContent = statusText;
            }
            
            // Mettre à jour les boutons d'action
            updateAppointmentActions(element, status, appointmentData);
        });
        
        // Si nous sommes sur la page des rendez-vous, déplacer la carte vers l'onglet approprié
        if (window.location.pathname.includes('/appointments')) {
            moveAppointmentToCorrectTab(appointmentId, status);
        }
        
        // Afficher une notification à l'utilisateur
        showStatusChangeNotification(status, appointmentData);
    }
    
    /**
     * Met à jour les boutons d'action d'un rendez-vous
     * @param {Element} element - Élément du rendez-vous
     * @param {string} status - Statut du rendez-vous
     * @param {Object} appointmentData - Données du rendez-vous
     */
    function updateAppointmentActions(element, status, appointmentData) {
        const actionsContainer = element.querySelector('.appointment-actions');
        if (!actionsContainer) return;
        
        // Mettre à jour les boutons en fonction du statut
        switch (status) {
            case 'pending':
                // Le patient peut annuler un rendez-vous en attente
                actionsContainer.innerHTML = `
                    <button class="btn-action btn-danger" onclick="cancelAppointment(${appointmentData.id})">
                        <i class="fas fa-times"></i> Annuler
                    </button>
                    <button class="btn-details" onclick="showAppointmentDetails(${appointmentData.id}, '${appointmentData.doctor_name}', '${appointmentData.doctor_specialty}', '${new Date(appointmentData.date_time).toLocaleString()}')">
                        <i class="fas fa-info-circle"></i> Voir détails
                    </button>
                `;
                break;
                
            case 'accepted':
                // Le patient peut voir les détails et rejoindre la consultation si disponible
                let joinButton = '';
                if (appointmentData.video_room_id) {
                    joinButton = `
                        <a href="/video/${appointmentData.video_room_id}" class="btn-action btn-primary join-consultation-btn" data-room-id="${appointmentData.video_room_id}">
                            <i class="fas fa-video"></i> Rejoindre la consultation
                        </a>
                    `;
                } else {
                    joinButton = `
                        <button type="button" class="btn-action btn-secondary disabled">
                            <i class="fas fa-video"></i> Lien non disponible
                        </button>
                    `;
                }
                
                actionsContainer.innerHTML = `
                    ${joinButton}
                    <button class="btn-details" onclick="showAppointmentDetails(${appointmentData.id}, '${appointmentData.doctor_name}', '${appointmentData.doctor_specialty}', '${new Date(appointmentData.date_time).toLocaleString()}')">
                        <i class="fas fa-info-circle"></i> Voir détails
                    </button>
                `;
                break;
                
            case 'completed':
            case 'rejected':
            case 'cancelled':
                // Le patient peut seulement voir les détails
                actionsContainer.innerHTML = `
                    <button class="btn-details" onclick="showAppointmentDetails(${appointmentData.id}, '${appointmentData.doctor_name}', '${appointmentData.doctor_specialty}', '${new Date(appointmentData.date_time).toLocaleString()}')">
                        <i class="fas fa-info-circle"></i> Voir détails
                    </button>
                `;
                break;
        }
    }
    
    /**
     * Déplace la carte de rendez-vous vers l'onglet approprié
     * @param {number} appointmentId - ID du rendez-vous
     * @param {string} status - Statut du rendez-vous
     */
    function moveAppointmentToCorrectTab(appointmentId, status) {
        const appointmentCard = document.querySelector(`.appointment-card[data-appointment-id="${appointmentId}"]`);
        if (!appointmentCard) return;
        
        // Déterminer l'onglet cible
        let targetTabId = '';
        switch (status) {
            case 'pending':
                targetTabId = 'pending-tab';
                break;
            case 'accepted':
                targetTabId = 'upcoming-tab';
                break;
            case 'completed':
                targetTabId = 'past-tab';
                break;
            case 'rejected':
            case 'cancelled':
                targetTabId = 'cancelled-tab';
                break;
        }
        
        if (!targetTabId) return;
        
        // Trouver l'onglet cible
        const targetTab = document.getElementById(targetTabId);
        if (!targetTab) return;
        
        // Trouver le conteneur de l'onglet cible
        const targetTabContent = document.querySelector(`.tab-content[data-tab="${targetTabId}"]`);
        if (!targetTabContent) return;
        
        // Déplacer la carte vers l'onglet cible
        const appointmentContainer = appointmentCard.parentElement;
        if (appointmentContainer) {
            // Cloner la carte pour éviter les problèmes de référence
            const clonedCard = appointmentCard.cloneNode(true);
            
            // Supprimer la carte originale
            appointmentContainer.removeChild(appointmentCard);
            
            // Ajouter la carte clonée à l'onglet cible
            const targetContainer = targetTabContent.querySelector('.appointments-grid');
            if (targetContainer) {
                targetContainer.appendChild(clonedCard);
            } else {
                // Créer un nouveau conteneur si nécessaire
                const newContainer = document.createElement('div');
                newContainer.className = 'appointments-grid';
                newContainer.appendChild(clonedCard);
                targetTabContent.appendChild(newContainer);
            }
            
            // Mettre à jour le compteur de l'onglet
            updateTabCounter(targetTabId);
            
            // Activer l'onglet cible
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            targetTab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            targetTabContent.classList.add('active');
        }
    }
    
    /**
     * Met à jour le compteur d'un onglet
     * @param {string} tabId - ID de l'onglet
     */
    function updateTabCounter(tabId) {
        const tab = document.getElementById(tabId);
        if (!tab) return;
        
        const tabContent = document.querySelector(`.tab-content[data-tab="${tabId}"]`);
        if (!tabContent) return;
        
        const appointmentCards = tabContent.querySelectorAll('.appointment-card');
        const counter = tab.querySelector('.tab-counter');
        
        if (counter) {
            counter.textContent = appointmentCards.length;
        }
    }
    
    /**
     * Affiche une notification de changement de statut
     * @param {string} status - Statut du rendez-vous
     * @param {Object} appointmentData - Données du rendez-vous
     */
    function showStatusChangeNotification(status, appointmentData) {
        let title = '';
        let message = '';
        let type = 'info';
        
        const formattedDate = new Date(appointmentData.date_time).toLocaleString();
        
        switch (status) {
            case 'accepted':
                title = 'Rendez-vous confirmé';
                message = `Votre rendez-vous avec ${appointmentData.doctor_name} pour le ${formattedDate} a été confirmé.`;
                type = 'success';
                break;
            case 'rejected':
                title = 'Rendez-vous refusé';
                message = `Votre rendez-vous avec ${appointmentData.doctor_name} pour le ${formattedDate} a été refusé.`;
                type = 'error';
                break;
            case 'completed':
                title = 'Consultation terminée';
                message = `Votre consultation avec ${appointmentData.doctor_name} du ${formattedDate} a été marquée comme terminée.`;
                type = 'success';
                break;
            case 'cancelled':
                title = 'Rendez-vous annulé';
                message = `Votre rendez-vous avec ${appointmentData.doctor_name} pour le ${formattedDate} a été annulé.`;
                type = 'warning';
                break;
        }
        
        if (title && message) {
            // Créer une notification visuelle
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-header">
                    <h3>${title}</h3>
                    <button class="close-notification"><i class="fas fa-times"></i></button>
                </div>
                <div class="notification-body">
                    <p>${message}</p>
                </div>
            `;
            
            // Ajouter la notification au document
            document.body.appendChild(notification);
            
            // Ajouter un gestionnaire d'événements pour fermer la notification
            const closeButton = notification.querySelector('.close-notification');
            if (closeButton) {
                closeButton.addEventListener('click', function() {
                    document.body.removeChild(notification);
                });
            }
            
            // Supprimer automatiquement la notification après 5 secondes
            setTimeout(function() {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 5000);
        }
    }
});
