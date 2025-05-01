// Script pour gérer le chat en temps réel avec Socket.IO

document.addEventListener('DOMContentLoaded', function() {
    // Éléments du chat
    const chatContainer = document.querySelector('.chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    const typingIndicator = document.getElementById('typing-indicator');
    const minimizeButton = document.getElementById('minimize-chat');
    const maximizeButton = document.getElementById('maximize-chat');
    const chatNotification = document.getElementById('chat-notification');

    // Variables pour le chat
    let isMinimized = false;
    let isMaximized = false;
    let isTyping = false;
    let typingTimeout;
    let lastMessageTime = null;
    let socket = null;
    let roomId = null;
    let userId = null;

    // Initialiser Socket.IO
    function initializeSocket() {
        console.log('Initialisation de Socket.IO pour le chat');

        // Récupérer l'ID de l'utilisateur et l'ID de la salle depuis les attributs data du body
        userId = document.body.getAttribute('data-user-id');
        roomId = document.body.getAttribute('data-room-id');

        if (!userId) {
            console.error('ID utilisateur non trouvé');
            return;
        }

        console.log('ID utilisateur:', userId);
        console.log('ID de salle:', roomId);

        // Initialiser Socket.IO
        socket = io();

        // Écouter les nouveaux messages
        socket.on('new_message', function(data) {
            console.log('Nouveau message reçu:', data);
            addChatMessage(data);
        });

        // Écouter l'historique des messages
        socket.on('message_history', function(data) {
            console.log('Historique des messages reçu:', data);
            if (data.messages && data.messages.length > 0) {
                // Effacer les messages existants (sauf les infos système)
                const systemMessages = chatMessages.querySelectorAll('.chat-info, .system-message');
                chatMessages.innerHTML = '';
                systemMessages.forEach(msg => chatMessages.appendChild(msg));

                // Ajouter les messages de l'historique
                let currentDate = null;
                data.messages.forEach(message => {
                    // Vérifier si nous devons ajouter un séparateur de date
                    const messageDate = new Date(message.date);
                    if (!currentDate || !isSameDay(currentDate, messageDate)) {
                        addDateDivider(messageDate);
                        currentDate = messageDate;
                    }

                    addChatMessage(message);
                });

                // Faire défiler vers le bas
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });

        // Rejoindre la salle si un ID de salle est disponible
        if (roomId) {
            console.log('Rejoindre la salle:', roomId);
            socket.emit('join_room', { room_id: roomId });
        }
    }

    // Fonction pour envoyer un message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message === '' || !roomId) return;

        console.log('Envoi du message:', message, 'Salle:', roomId);

        // Envoyer le message via Socket.IO
        socket.emit('send_message', {
            room_id: roomId,
            content: message,
            is_urgent: false
        });

        // Réinitialiser l'input
        chatInput.value = '';

        // Ajuster la hauteur du textarea
        chatInput.style.height = 'auto';
    }

    // Fonction pour ajouter un message au chat
    function addChatMessage(message) {
        // Vérifier si nous devons ajouter un séparateur de date
        const messageDate = new Date(message.date || new Date());
        if (!lastMessageTime || !isSameDay(lastMessageTime, messageDate)) {
            addDateDivider(messageDate);
        }
        lastMessageTime = messageDate;

        // Déterminer si le message est envoyé par l'utilisateur actuel
        const isSent = message.sender_id == userId;

        // Créer l'élément de message
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${isSent ? 'sent' : 'received'} ${message.is_urgent ? 'urgent' : ''}`;

        // Formater l'heure
        const timeString = message.timestamp || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        messageElement.innerHTML = `
            <div class="message-bubble">
                ${formatMessageContent(message.content)}
            </div>
            <div class="message-info">
                <span class="message-time">${timeString}</span>
                ${isSent ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
            </div>
        `;

        // Ajouter le message au chat
        chatMessages.appendChild(messageElement);

        // Faire défiler vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Afficher la notification de nouveau message si le chat est minimisé et que le message est reçu
        if (!isSent && isMinimized && chatNotification) {
            chatNotification.style.display = 'block';

            // Faire disparaître la notification après 5 secondes
            setTimeout(() => {
                chatNotification.style.display = 'none';
            }, 5000);
        }
    }

    // Fonction pour formater le contenu du message (liens, emojis, etc.)
    function formatMessageContent(content) {
        if (!content) return '';

        // Convertir les liens en liens cliquables
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" class="message-link" target="_blank">$1</a>'
        );

        // Convertir les emojis textuels en emojis
        const emojiMap = {
            ':)': '😊',
            ':-)': '😊',
            ':(': '😞',
            ':-(': '😞',
            ':D': '😃',
            ':-D': '😃',
            ';)': '😉',
            ';-)': '😉',
            ':p': '😛',
            ':-p': '😛',
            '<3': '❤️',
            ':heart:': '❤️',
            ':+1:': '👍',
            ':-1:': '👎'
        };

        for (const [emoji, unicode] of Object.entries(emojiMap)) {
            content = content.replace(new RegExp(emoji, 'g'), unicode);
        }

        return content;
    }

    // Fonction pour ajouter un séparateur de date
    function addDateDivider(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateText;
        if (isSameDay(date, today)) {
            dateText = 'Aujourd\'hui';
        } else if (isSameDay(date, yesterday)) {
            dateText = 'Hier';
        } else {
            dateText = date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        const divider = document.createElement('div');
        divider.className = 'chat-date-divider';
        divider.innerHTML = `<span class="chat-date">${dateText}</span>`;

        chatMessages.appendChild(divider);
    }

    // Fonction pour vérifier si deux dates sont le même jour
    function isSameDay(date1, date2) {
        if (!date1 || !date2) return false;

        // Convertir en objets Date si ce sont des chaînes
        if (typeof date1 === 'string') date1 = new Date(date1);
        if (typeof date2 === 'string') date2 = new Date(date2);

        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    // Fonction pour minimiser/maximiser le chat
    function toggleChatSize(action) {
        if (action === 'minimize') {
            chatContainer.style.height = '50px';
            chatMessages.style.display = 'none';
            chatInput.style.display = 'none';
            const chatOptions = document.querySelector('.chat-options');
            if (chatOptions) chatOptions.style.display = 'none';
            isMinimized = true;
            isMaximized = false;

            // Masquer la notification si elle est affichée
            if (chatNotification) {
                chatNotification.style.display = 'none';
            }
        } else if (action === 'maximize') {
            chatContainer.style.height = '80vh';
            chatMessages.style.display = 'flex';
            chatInput.style.display = 'block';
            const chatOptions = document.querySelector('.chat-options');
            if (chatOptions) chatOptions.style.display = 'flex';
            isMinimized = false;
            isMaximized = true;

            // Masquer la notification si elle est affichée
            if (chatNotification) {
                chatNotification.style.display = 'none';
            }
        } else {
            // Restaurer la taille normale
            chatContainer.style.height = '';
            chatMessages.style.display = 'flex';
            chatInput.style.display = 'block';
            const chatOptions = document.querySelector('.chat-options');
            if (chatOptions) chatOptions.style.display = 'flex';
            isMinimized = false;
            isMaximized = false;

            // Masquer la notification si elle est affichée
            if (chatNotification) {
                chatNotification.style.display = 'none';
            }
        }
    }

    // Événements
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Ajuster automatiquement la hauteur du textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';

            // Gérer l'indicateur de frappe
            if (!isTyping && this.value.trim() !== '' && socket && roomId) {
                isTyping = true;
                // Envoyer un événement de frappe au serveur
                socket.emit('typing', { room_id: roomId, is_typing: true });
            }

            // Réinitialiser le timeout
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                if (isTyping && socket && roomId) {
                    isTyping = false;
                    // Envoyer un événement de fin de frappe au serveur
                    socket.emit('typing', { room_id: roomId, is_typing: false });
                }
            }, 1000);
        });
    }

    if (minimizeButton) {
        minimizeButton.addEventListener('click', function() {
            if (isMinimized) {
                toggleChatSize('restore');
            } else {
                toggleChatSize('minimize');
            }
        });
    }

    if (maximizeButton) {
        maximizeButton.addEventListener('click', function() {
            if (isMaximized) {
                toggleChatSize('restore');
            } else {
                toggleChatSize('maximize');
            }
        });
    }

    // Faire défiler vers le bas au chargement
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Initialiser Socket.IO
    initializeSocket();
});
