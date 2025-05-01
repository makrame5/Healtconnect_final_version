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
        const appointmentElements = document.querySelectorAll(`.appointment-row[data-appointment-id="${appointmentId}"]`);
        
        if (appointmentElements.length === 0) {
            console.log(`Aucun élément trouvé pour le rendez-vous ${appointmentId}. Rechargement de la page...`);
            // Si nous sommes sur la page des rendez-vous ou le bureau virtuel, recharger la page
            if (window.location.pathname.includes('/appointments') || 
                window.location.pathname.includes('/virtual_office')) {
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
        
        // Si nous sommes sur la page des rendez-vous, déplacer la ligne vers l'onglet approprié
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
                // Le médecin peut accepter ou refuser un rendez-vous en attente
                actionsContainer.innerHTML = `
                    <a href="/doctor/appointment/${appointmentData.id}/accept" class="btn btn-success btn-sm">
                        <i class="fas fa-check"></i> Accepter
                    </a>
                    <a href="/doctor/appointment/${appointmentData.id}/reject" class="btn btn-danger btn-sm">
                        <i class="fas fa-times"></i> Refuser
                    </a>
                    <a href="/doctor/appointment/${appointmentData.id}/delete" class="btn btn-secondary btn-sm" onclick="return confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?');">
                        <i class="fas fa-trash"></i> Supprimer
                    </a>
                `;
                break;
                
            case 'accepted':
                // Le médecin peut marquer comme terminé ou supprimer un rendez-vous accepté
                let joinButton = '';
                if (appointmentData.video_room_id) {
                    joinButton = `
                        <a href="/video/${appointmentData.video_room_id}" class="btn btn-primary btn-sm">
                            <i class="fas fa-video"></i> Rejoindre
                        </a>
                    `;
                }
                
                actionsContainer.innerHTML = `
                    ${joinButton}
                    <a href="/doctor/appointment/${appointmentData.id}/complete" class="btn btn-info btn-sm">
                        <i class="fas fa-check-double"></i> Terminer
                    </a>
                    <a href="/doctor/appointment/${appointmentData.id}/delete" class="btn btn-secondary btn-sm" onclick="return confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?');">
                        <i class="fas fa-trash"></i> Supprimer
                    </a>
                `;
                break;
                
            case 'completed':
            case 'rejected':
            case 'cancelled':
                // Le médecin peut seulement supprimer un rendez-vous terminé, refusé ou annulé
                actionsContainer.innerHTML = `
                    <a href="/doctor/appointment/${appointmentData.id}/delete" class="btn btn-secondary btn-sm" onclick="return confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?');">
                        <i class="fas fa-trash"></i> Supprimer
                    </a>
                `;
                break;
        }
    }
    
    /**
     * Déplace la ligne de rendez-vous vers l'onglet approprié
     * @param {number} appointmentId - ID du rendez-vous
     * @param {string} status - Statut du rendez-vous
     */
    function moveAppointmentToCorrectTab(appointmentId, status) {
        const appointmentRow = document.querySelector(`.appointment-row[data-appointment-id="${appointmentId}"]`);
        if (!appointmentRow) return;
        
        // Déterminer l'onglet cible
        let targetTabId = '';
        switch (status) {
            case 'pending':
                targetTabId = 'pending';
                break;
            case 'accepted':
                targetTabId = 'accepted';
                break;
            case 'completed':
                targetTabId = 'completed';
                break;
            case 'rejected':
            case 'cancelled':
                targetTabId = 'rejected';
                break;
        }
        
        if (!targetTabId) return;
        
        // Trouver l'onglet cible
        const targetTab = document.querySelector(`a[href="#tab=${targetTabId}"]`);
        if (!targetTab) return;
        
        // Trouver le conteneur de l'onglet cible
        const targetTabContent = document.getElementById(`${targetTabId}-appointments`);
        if (!targetTabContent) return;
        
        // Déplacer la ligne vers l'onglet cible
        const appointmentTable = appointmentRow.closest('table');
        if (appointmentTable) {
            // Cloner la ligne pour éviter les problèmes de référence
            const clonedRow = appointmentRow.cloneNode(true);
            
            // Supprimer la ligne originale
            appointmentTable.querySelector('tbody').removeChild(appointmentRow);
            
            // Ajouter la ligne clonée à l'onglet cible
            const targetTable = targetTabContent.querySelector('table');
            if (targetTable) {
                targetTable.querySelector('tbody').appendChild(clonedRow);
            }
            
            // Mettre à jour le compteur de l'onglet
            updateTabCounter(targetTabId);
            
            // Activer l'onglet cible
            document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
            targetTab.classList.add('active');
            
            document.querySelectorAll('.tab-pane').forEach(content => content.classList.remove('show', 'active'));
            targetTabContent.classList.add('show', 'active');
        }
    }
    
    /**
     * Met à jour le compteur d'un onglet
     * @param {string} tabId - ID de l'onglet
     */
    function updateTabCounter(tabId) {
        const tab = document.querySelector(`a[href="#tab=${tabId}"]`);
        if (!tab) return;
        
        const tabContent = document.getElementById(`${tabId}-appointments`);
        if (!tabContent) return;
        
        const appointmentRows = tabContent.querySelectorAll('.appointment-row');
        const counter = tab.querySelector('.badge');
        
        if (counter) {
            counter.textContent = appointmentRows.length;
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
            case 'pending':
                title = 'Nouvelle demande de rendez-vous';
                message = `Nouvelle demande de rendez-vous de ${appointmentData.patient_name} pour le ${formattedDate}.`;
                type = 'info';
                break;
            case 'cancelled':
                title = 'Rendez-vous annulé';
                message = `Le rendez-vous avec ${appointmentData.patient_name} pour le ${formattedDate} a été annulé par le patient.`;
                type = 'warning';
                break;
            case 'completed':
                title = 'Consultation terminée';
                message = `La consultation avec ${appointmentData.patient_name} du ${formattedDate} a été marquée comme terminée.`;
                type = 'success';
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
