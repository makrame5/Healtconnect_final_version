document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les informations de la salle et de l'utilisateur
    const roomId = document.body.getAttribute('data-room-id');
    const userId = document.body.getAttribute('data-user-id');
    const userRole = document.body.getAttribute('data-user-role');
    const userName = document.body.getAttribute('data-user-name');
    const otherName = document.body.getAttribute('data-other-name');

    console.log('Initialisation de la salle vidéo:');
    console.log('- Rôle:', userRole);
    console.log('- Nom:', userName);
    console.log('- Autre participant:', otherName);
    console.log('- ID de salle:', roomId);
    console.log('- ID utilisateur:', userId);

    // Initialiser Socket.IO
    const socket = io();

    // Variables pour WebRTC
    let localStream = null;
    let peerConnection = null;
    let remoteStream = null;
    let isScreenSharing = false;
    let isMicMuted = false;
    let isVideoOff = false;

    // Configuration des serveurs STUN/TURN pour WebRTC
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Serveurs TURN gratuits pour améliorer la connectivité
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    };

    // Sidebar tabs functionality
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');

            // Remove active class from all tabs and panels
            sidebarTabs.forEach(t => t.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active class to current tab and panel
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Rejoindre la salle de consultation
    socket.on('connect', () => {
        console.log('Connecté à Socket.IO');
        console.log('Tentative de rejoindre la salle:', roomId);
        socket.emit('join_room', { room_id: roomId });
    });

    // Gérer les événements de la salle
    socket.on('user_joined', (data) => {
        console.log(`${data.user_name} a rejoint la salle`, data);

        // Mettre à jour le statut du participant
        if (data.user_id != userId) {
            const otherParticipant = document.getElementById('other-participant');
            if (otherParticipant) {
                const statusIndicator = otherParticipant.querySelector('.participant-status');
                statusIndicator.classList.add('online');

                // Afficher une notification
                const notificationElement = document.createElement('div');
                notificationElement.className = 'system-notification';
                notificationElement.textContent = `${data.user_name} a rejoint la salle`;

                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                    chatMessages.appendChild(notificationElement);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                // Si l'autre participant est connecté et que nous avons déjà démarré notre vidéo,
                // nous pouvons automatiquement initier l'appel
                if (localStream && peerConnection && peerConnection.connectionState !== 'connected') {
                    console.log('L\'autre participant est connecté, tentative d\'établir la connexion WebRTC...');
                    createOffer();
                }
            }
        }
    });

    socket.on('user_left', (data) => {
        console.log(`${data.user_name} a quitté la salle`, data);

        // Mettre à jour le statut du participant
        if (data.user_id != userId) {
            const otherParticipant = document.getElementById('other-participant');
            if (otherParticipant) {
                const statusIndicator = otherParticipant.querySelector('.participant-status');
                statusIndicator.classList.remove('online');

                // Afficher une notification
                const notificationElement = document.createElement('div');
                notificationElement.className = 'system-notification';
                notificationElement.textContent = `${data.user_name} a quitté la salle`;

                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                    chatMessages.appendChild(notificationElement);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                // Si nous avons une connexion WebRTC active, nous pouvons la fermer
                if (peerConnection) {
                    console.log('L\'autre participant est parti, fermeture de la connexion WebRTC...');

                    // Afficher un message dans la vidéo distante
                    const remoteVideo = document.querySelector('.video-participant:nth-child(2)');
                    if (remoteVideo) {
                        const videoElement = remoteVideo.querySelector('video');
                        if (videoElement) {
                            videoElement.style.display = 'none';
                        }

                        // Créer un message de déconnexion
                        const disconnectMessage = document.createElement('div');
                        disconnectMessage.className = 'video-disconnect-message';
                        disconnectMessage.innerHTML = `
                            <i class="fas fa-user-slash"></i>
                            <p>${data.user_name} s'est déconnecté</p>
                        `;

                        remoteVideo.appendChild(disconnectMessage);
                    }
                }
            }
        }
    });

    // Gérer les signaux WebRTC
    socket.on('webrtc_signal', (data) => {
        console.log('Signal WebRTC reçu', data);

        // Traiter le signal WebRTC
        const signal = data.signal;
        const senderId = data.sender_id;

        console.log(`Signal de type ${signal.type} reçu de ${senderId}`);

        if (signal.type === 'offer') {
            console.log('Offre reçue, traitement en cours...');
            handleVideoOffer(signal);
        } else if (signal.type === 'answer') {
            console.log('Réponse reçue, traitement en cours...');
            handleVideoAnswer(signal);
        } else if (signal.type === 'ice-candidate') {
            console.log('Candidat ICE reçu, traitement en cours...');
            handleNewICECandidate(signal.candidate);
        }
    });

    // Chat functionality
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');

    if (chatSendButton && chatInput) {
        chatSendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Empêcher le saut de ligne
                sendMessage();
            }
        });
    }

    function sendMessage() {
        const message = chatInput.value.trim();

        if (message) {
            console.log('Envoi du message:', message);

            // Désactiver le bouton d'envoi pendant l'envoi
            if (chatSendButton) {
                chatSendButton.disabled = true;
                chatSendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            // Envoyer le message via Socket.IO
            socket.emit('send_message', {
                room_id: roomId,
                content: message
            });

            // Vider le champ de saisie
            chatInput.value = '';
        }
    }

    // Recevoir un nouveau message
    socket.on('new_message', (data) => {
        console.log('Nouveau message reçu', data);

        // Réactiver le bouton d'envoi
        if (chatSendButton) {
            chatSendButton.disabled = false;
            chatSendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }

        // Ajouter le message à l'interface
        addMessageToUI(data);

        // Faire défiler jusqu'au dernier message
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Jouer un son de notification si le message vient de l'autre personne
        if (data.sender_id != userId) {
            playNotificationSound();

            // Si l'onglet chat n'est pas actif, ajouter un indicateur de notification
            const chatTab = document.querySelector('.sidebar-tab[data-tab="chat"]');
            if (chatTab && !chatTab.classList.contains('active')) {
                if (!chatTab.querySelector('.notification-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.textContent = '1';
                    chatTab.appendChild(badge);
                } else {
                    const badge = chatTab.querySelector('.notification-badge');
                    badge.textContent = parseInt(badge.textContent) + 1;
                }
            }
        }
    });

    // Fonction pour jouer un son de notification
    function playNotificationSound() {
        try {
            const audio = new Audio('/static/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (error) {
            console.error('Impossible de jouer le son de notification:', error);
        }
    }

    // Ajouter un message à l'interface
    function addMessageToUI(message) {
        // Utiliser le template pour créer un nouvel élément de message
        const template = document.getElementById('message-template');
        const messageElement = document.importNode(template.content, true);

        // Remplir le template avec les données du message
        const messageContainer = messageElement.querySelector('.chat-message');
        const messageSender = messageElement.querySelector('.message-sender');
        const messageTime = messageElement.querySelector('.message-time');
        const messageContent = messageElement.querySelector('.message-content');

        // Définir les classes et le contenu
        messageContainer.classList.add(message.sender_id == userId ? 'sent' : 'received');
        messageSender.textContent = message.sender_name;
        messageTime.textContent = message.timestamp;

        // Formater le contenu du message (liens cliquables, emojis, etc.)
        messageContent.innerHTML = formatMessageContent(message.content);

        // Ajouter le message à la liste
        chatMessages.appendChild(messageElement);
    }

    // Fonction pour formater le contenu du message
    function formatMessageContent(content) {
        // Échapper les caractères HTML pour éviter les injections XSS
        let formattedContent = escapeHtml(content);

        // Rendre les liens cliquables
        formattedContent = formattedContent.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        // Convertir les sauts de ligne en balises <br>
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        return formattedContent;
    }

    // Fonction pour échapper les caractères HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Charger l'historique des messages
    socket.on('message_history', (data) => {
        console.log('Historique des messages reçu', data);

        // Vider le conteneur de messages
        chatMessages.innerHTML = '';

        // Ajouter chaque message à l'interface
        data.messages.forEach(message => {
            addMessageToUI(message);
        });

        // Faire défiler jusqu'au dernier message
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Effacer les indicateurs de notification lorsqu'on clique sur un onglet
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const badge = this.querySelector('.notification-badge');
            if (badge) {
                badge.remove();
            }
        });
    });

    // Fonctionnalité de partage de fichiers
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const uploadFileBtn = document.getElementById('upload-file');
    const cancelUploadBtn = document.getElementById('cancel-upload');
    const filesList = document.getElementById('files-list');

    // Limites pour les fichiers
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_FILE_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const file = this.files[0];

                // Vérifier le type de fichier
                if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                    alert('Type de fichier non autorisé. Veuillez sélectionner un fichier PDF, une image ou un document Office.');
                    this.value = '';
                    return;
                }

                // Vérifier la taille du fichier
                if (file.size > MAX_FILE_SIZE) {
                    alert('Le fichier est trop volumineux. La taille maximale est de 10 MB.');
                    this.value = '';
                    return;
                }

                // Afficher les informations du fichier
                fileName.textContent = file.name;
                fileInfo.style.display = 'flex';
            }
        });
    }

    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', function() {
            fileInput.value = '';
            fileInfo.style.display = 'none';
        });
    }

    if (uploadFileBtn) {
        uploadFileBtn.addEventListener('click', function() {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];

                // Désactiver le bouton pendant l'upload
                uploadFileBtn.disabled = true;
                uploadFileBtn.textContent = 'Envoi en cours...';

                // Lire le fichier comme une URL de données
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Envoyer le fichier via Socket.IO
                    socket.emit('share_file', {
                        room_id: roomId,
                        file_data: e.target.result,
                        file_name: file.name,
                        file_type: file.type,
                        file_size: file.size
                    });
                };
                reader.onerror = function() {
                    alert('Erreur lors de la lecture du fichier.');
                    uploadFileBtn.disabled = false;
                    uploadFileBtn.textContent = 'Envoyer';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Recevoir un nouveau fichier
    socket.on('new_file', (data) => {
        console.log('Nouveau fichier reçu', data);

        // Réinitialiser le formulaire d'upload
        if (fileInput) {
            fileInput.value = '';
        }
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }
        if (uploadFileBtn) {
            uploadFileBtn.disabled = false;
            uploadFileBtn.textContent = 'Envoyer';
        }

        // Ajouter le fichier à l'interface
        addFileToUI(data);

        // Jouer un son de notification si le fichier vient de l'autre personne
        if (data.sender_id != userId) {
            playNotificationSound();

            // Si l'onglet fichiers n'est pas actif, ajouter un indicateur de notification
            const filesTab = document.querySelector('.sidebar-tab[data-tab="files"]');
            if (filesTab && !filesTab.classList.contains('active')) {
                if (!filesTab.querySelector('.notification-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.textContent = '1';
                    filesTab.appendChild(badge);
                } else {
                    const badge = filesTab.querySelector('.notification-badge');
                    badge.textContent = parseInt(badge.textContent) + 1;
                }
            }
        }
    });

    // Ajouter un fichier à l'interface
    function addFileToUI(file) {
        if (!filesList) return;

        // Utiliser le template pour créer un nouvel élément de fichier
        const template = document.getElementById('file-template');
        const fileElement = document.importNode(template.content, true);

        // Remplir le template avec les données du fichier
        const fileIcon = fileElement.querySelector('.file-icon i');
        const fileName = fileElement.querySelector('.file-name');
        const fileSize = fileElement.querySelector('.file-size');
        const fileSender = fileElement.querySelector('.file-sender');
        const fileDownload = fileElement.querySelector('.file-download');

        // Définir l'icône en fonction du type de fichier
        if (file.file_type.includes('pdf')) {
            fileIcon.className = 'fas fa-file-pdf';
        } else if (file.file_type.includes('image')) {
            fileIcon.className = 'fas fa-file-image';
        } else if (file.file_type.includes('word')) {
            fileIcon.className = 'fas fa-file-word';
        } else if (file.file_type.includes('excel') || file.file_type.includes('spreadsheet')) {
            fileIcon.className = 'fas fa-file-excel';
        } else {
            fileIcon.className = 'fas fa-file';
        }

        // Définir le nom du fichier
        fileName.textContent = file.file_name;

        // Définir la taille du fichier
        fileSize.textContent = formatFileSize(file.file_size);

        // Définir l'expéditeur
        fileSender.textContent = `Partagé par ${file.sender_name} à ${file.timestamp}`;

        // Définir le lien de téléchargement
        fileDownload.href = `/${file.file_path}`;
        fileDownload.setAttribute('download', file.file_name);

        // Ajouter le fichier à la liste
        filesList.appendChild(fileElement);
    }

    // Formater la taille du fichier
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }

    // Charger l'historique des fichiers
    socket.on('file_history', (data) => {
        console.log('Historique des fichiers reçu', data);

        // Vider la liste des fichiers
        if (filesList) {
            filesList.innerHTML = '';

            // Ajouter chaque fichier à l'interface
            data.files.forEach(file => {
                addFileToUI(file);
            });
        }
    });

    // Fonctionnalité de bloc-note du médecin (uniquement pour les médecins)
    if (userRole === 'doctor') {
        const notesContent = document.getElementById('notes-content');
        const saveNotesBtn = document.getElementById('save-notes');
        const notesStatus = document.getElementById('notes-status');

        let notesTimeout = null;
        let lastSavedContent = '';

        if (notesContent && saveNotesBtn) {
            // Sauvegarder automatiquement les notes après un délai d'inactivité
            notesContent.addEventListener('input', function() {
                if (notesTimeout) {
                    clearTimeout(notesTimeout);
                }

                notesStatus.textContent = 'Modifications non enregistrées...';

                notesTimeout = setTimeout(function() {
                    saveNotes();
                }, 3000); // Sauvegarder après 3 secondes d'inactivité
            });

            // Sauvegarder les notes lorsqu'on clique sur le bouton
            saveNotesBtn.addEventListener('click', function() {
                saveNotes();
            });

            // Fonction pour sauvegarder les notes
            function saveNotes() {
                const content = notesContent.value.trim();

                // Ne pas sauvegarder si le contenu est identique à la dernière sauvegarde
                if (content === lastSavedContent) {
                    notesStatus.textContent = 'Aucune modification à enregistrer';
                    return;
                }

                // Désactiver le bouton pendant la sauvegarde
                saveNotesBtn.disabled = true;
                saveNotesBtn.textContent = 'Enregistrement...';
                notesStatus.textContent = 'Enregistrement en cours...';

                // Envoyer les notes via Socket.IO
                socket.emit('save_notes', {
                    room_id: roomId,
                    content: content
                });
            }

            // Recevoir la confirmation de sauvegarde
            socket.on('notes_saved', (data) => {
                console.log('Notes enregistrées', data);

                // Réactiver le bouton
                saveNotesBtn.disabled = false;
                saveNotesBtn.textContent = 'Enregistrer';

                // Mettre à jour le statut
                notesStatus.textContent = `Enregistré à ${data.updated_at}`;

                // Mettre à jour le contenu sauvegardé
                lastSavedContent = notesContent.value.trim();
            });

            // Charger les notes existantes
            socket.on('load_notes', (data) => {
                console.log('Notes chargées', data);

                // Remplir le champ de texte avec les notes
                notesContent.value = data.content;

                // Mettre à jour le statut
                notesStatus.textContent = `Dernière modification: ${data.updated_at}`;

                // Mettre à jour le contenu sauvegardé
                lastSavedContent = data.content;
            });
        }
    }

    // Video control buttons
    const toggleMicBtn = document.getElementById('toggle-mic');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleScreenBtn = document.getElementById('toggle-screen');
    const endCallBtn = document.getElementById('end-call');

    if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', function() {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    isMicMuted = !isMicMuted;
                    audioTrack.enabled = !isMicMuted;

                    // Mettre à jour l'icône
                    const icon = this.querySelector('i');
                    icon.className = isMicMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
                }
            }
        });
    }

    if (toggleVideoBtn) {
        toggleVideoBtn.addEventListener('click', function() {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    isVideoOff = !isVideoOff;
                    videoTrack.enabled = !isVideoOff;

                    // Mettre à jour l'icône
                    const icon = this.querySelector('i');
                    icon.className = isVideoOff ? 'fas fa-video-slash' : 'fas fa-video';
                }
            }
        });
    }

    if (toggleScreenBtn) {
        toggleScreenBtn.addEventListener('click', async function() {
            try {
                if (!isScreenSharing) {
                    // Démarrer le partage d'écran
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true
                    });

                    // Remplacer la piste vidéo
                    const videoTrack = screenStream.getVideoTracks()[0];
                    const sender = peerConnection.getSenders().find(s =>
                        s.track.kind === 'video'
                    );

                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }

                    // Mettre à jour le flux local
                    const localVideoElement = document.querySelector('.video-participant:first-child video');
                    const newStream = new MediaStream([
                        videoTrack,
                        ...localStream.getAudioTracks()
                    ]);
                    localVideoElement.srcObject = newStream;

                    // Écouter la fin du partage d'écran
                    videoTrack.onended = () => {
                        toggleScreenSharing();
                    };

                    isScreenSharing = true;
                    this.classList.add('active');

                } else {
                    // Arrêter le partage d'écran
                    toggleScreenSharing();
                }

            } catch (error) {
                console.error('Erreur lors du partage d\'écran:', error);
            }
        });
    }

    async function toggleScreenSharing() {
        if (isScreenSharing) {
            // Revenir à la caméra
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s =>
                s.track.kind === 'video'
            );

            if (sender && videoTrack) {
                sender.replaceTrack(videoTrack);
            }

            // Mettre à jour le flux local
            const localVideoElement = document.querySelector('.video-participant:first-child video');
            localVideoElement.srcObject = localStream;

            isScreenSharing = false;
            toggleScreenBtn.classList.remove('active');
        }
    }

    if (endCallBtn) {
        endCallBtn.addEventListener('click', function() {
            if (confirm('Êtes-vous sûr de vouloir quitter la consultation ?')) {
                // Fermer la connexion WebRTC
                if (peerConnection) {
                    peerConnection.close();
                }

                // Arrêter les flux média
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                }

                // Quitter la salle (avec le paramètre end_consultation à true si c'est un médecin)
                socket.emit('leave_room', {
                    room_id: roomId,
                    end_consultation: userRole === 'doctor' // Marquer comme terminé seulement si c'est un médecin
                });

                // Rediriger vers la page appropriée
                if (userRole === 'doctor') {
                    window.location.href = '/doctor/virtual_office';
                } else {
                    window.location.href = '/patient/doctor-patient-space';
                }
            }
        });
    }

    // Start video call
    const startConsultationBtn = document.getElementById('start-consultation');
    const videoPlaceholder = document.querySelector('.video-placeholder');
    const videoGrid = document.querySelector('.video-grid');
    const videoControls = document.querySelector('.video-controls');

    if (startConsultationBtn) {
        startConsultationBtn.addEventListener('click', startVideoCall);
    }

    async function startVideoCall() {
        try {
            console.log('Démarrage de la consultation vidéo...');

            // Demander l'accès à la caméra et au microphone avec des contraintes spécifiques
            console.log('Demande d\'accès aux périphériques média...');

            // Essayer d'abord avec des contraintes spécifiques
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: "user"
                    },
                    audio: true
                });
                console.log('Accès aux périphériques média accordé avec contraintes spécifiques');
            } catch (specificError) {
                console.warn('Impossible d\'accéder aux périphériques média avec des contraintes spécifiques:', specificError);
                console.log('Tentative avec des contraintes génériques...');

                // Si cela échoue, essayer avec des contraintes génériques
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                console.log('Accès aux périphériques média accordé avec contraintes génériques');
            }

            // Vérifier que nous avons bien obtenu un flux vidéo
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length === 0) {
                throw new Error('Aucune piste vidéo n\'a été obtenue');
            }

            console.log('Pistes vidéo obtenues:', videoTracks);
            console.log('Paramètres de la piste vidéo:', videoTracks[0].getSettings());

            // Cacher le placeholder et afficher les contrôles
            videoPlaceholder.style.display = 'none';
            videoControls.style.display = 'flex';

            // Créer les éléments vidéo
            console.log('Création des éléments vidéo...');
            const localVideo = document.createElement('div');
            localVideo.className = 'video-participant';
            localVideo.innerHTML = `
                <video class="participant-video" autoplay muted playsinline></video>
                <div class="participant-info">
                    <i class="fas fa-user"></i>
                    <span>${userName} (Vous)</span>
                </div>
            `;

            const remoteVideo = document.createElement('div');
            remoteVideo.className = 'video-participant';
            remoteVideo.innerHTML = `
                <video class="participant-video" autoplay playsinline></video>
                <div class="participant-info">
                    <i class="fas fa-user"></i>
                    <span>${otherName}</span>
                </div>
            `;

            // Ajouter les éléments vidéo à la grille
            videoGrid.appendChild(localVideo);
            videoGrid.appendChild(remoteVideo);
            videoGrid.classList.add('two-participants');

            // Afficher le flux vidéo local
            const localVideoElement = localVideo.querySelector('video');
            localVideoElement.srcObject = localStream;

            // S'assurer que la vidéo est bien chargée
            localVideoElement.onloadedmetadata = () => {
                console.log('Métadonnées de la vidéo locale chargées');
                localVideoElement.play().catch(e => console.error('Erreur lors de la lecture de la vidéo locale:', e));
            };

            // Vérifier si la vidéo est bien affichée
            setTimeout(() => {
                if (localVideoElement.videoWidth === 0 || localVideoElement.videoHeight === 0) {
                    console.warn('La vidéo locale ne semble pas s\'afficher correctement');

                    // Essayer de réappliquer le flux
                    localVideoElement.srcObject = null;
                    localVideoElement.srcObject = localStream;
                    localVideoElement.play().catch(e => console.error('Erreur lors de la relecture de la vidéo locale:', e));
                } else {
                    console.log('Vidéo locale affichée avec succès, dimensions:', localVideoElement.videoWidth, 'x', localVideoElement.videoHeight);
                }
            }, 2000);

            // Initialiser la connexion WebRTC
            console.log('Initialisation de la connexion WebRTC...');
            initializePeerConnection();

            // Rejoindre la salle
            console.log('Rejoindre la salle:', roomId);
            socket.emit('join_room', { room_id: roomId });

            // Attendre un court instant pour s'assurer que la connexion à la salle est établie
            setTimeout(() => {
                // Créer une offre et l'envoyer à l'autre participant
                console.log('Création de l\'offre WebRTC...');
                createOffer();
            }, 1000);

        } catch (error) {
            console.error('Erreur lors de l\'accès aux périphériques média:', error);
            alert('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier vos permissions et que votre caméra n\'est pas utilisée par une autre application.');

            // Afficher un message d'erreur plus détaillé dans la console
            if (error.name) {
                console.error('Type d\'erreur:', error.name);

                if (error.name === 'NotAllowedError') {
                    console.error('L\'utilisateur a refusé l\'accès à la caméra ou au microphone');
                } else if (error.name === 'NotFoundError') {
                    console.error('Aucun périphérique média n\'a été trouvé');
                } else if (error.name === 'NotReadableError') {
                    console.error('Le périphérique média est déjà utilisé par une autre application');
                }
            }
        }
    }

    // Variable pour stocker les candidats ICE en attente
    let pendingCandidates = [];

    // Initialiser la connexion WebRTC
    function initializePeerConnection() {
        console.log('Initialisation de la connexion WebRTC...');

        // Créer une nouvelle connexion RTCPeerConnection
        peerConnection = new RTCPeerConnection(iceServers);

        // Ajouter les pistes audio et vidéo à la connexion
        localStream.getTracks().forEach(track => {
            console.log(`Ajout de la piste ${track.kind} au peer connection`);
            peerConnection.addTrack(track, localStream);
        });

        // Créer un flux distant pour recevoir les pistes de l'autre participant
        remoteStream = new MediaStream();
        const remoteVideoElement = document.querySelector('.video-participant:nth-child(2) video');

        if (!remoteVideoElement) {
            console.error('Élément vidéo distant non trouvé');
            return;
        }

        remoteVideoElement.srcObject = remoteStream;

        // S'assurer que la vidéo distante est prête à être lue
        remoteVideoElement.onloadedmetadata = () => {
            console.log('Métadonnées de la vidéo distante chargées');
            remoteVideoElement.play().catch(e => console.error('Erreur lors de la lecture de la vidéo distante:', e));
        };

        // Écouter les pistes entrantes
        peerConnection.ontrack = (event) => {
            console.log('Piste reçue:', event);

            // Vérifier que nous avons bien reçu des pistes
            if (!event.streams || event.streams.length === 0) {
                console.warn('Aucun flux reçu avec la piste');
                return;
            }

            // Ajouter les pistes au flux distant
            event.streams[0].getTracks().forEach(track => {
                console.log('Ajout de la piste au flux distant:', track.kind);
                remoteStream.addTrack(track);

                // Vérifier que la piste est active
                if (!track.enabled) {
                    console.warn(`La piste ${track.kind} n'est pas activée`);
                    track.enabled = true;
                }

                // Écouter les événements de fin de piste
                track.onended = () => {
                    console.log(`La piste ${track.kind} a été terminée`);
                };

                // Écouter les événements de mute
                track.onmute = () => {
                    console.log(`La piste ${track.kind} a été mise en sourdine`);
                };

                // Écouter les événements d'unmute
                track.onunmute = () => {
                    console.log(`La piste ${track.kind} a été réactivée`);
                };
            });

            // Vérifier que la vidéo distante s'affiche correctement
            setTimeout(() => {
                if (remoteVideoElement.videoWidth === 0 || remoteVideoElement.videoHeight === 0) {
                    console.warn('La vidéo distante ne semble pas s\'afficher correctement');

                    // Essayer de réappliquer le flux
                    remoteVideoElement.srcObject = null;
                    remoteVideoElement.srcObject = remoteStream;
                    remoteVideoElement.play().catch(e => console.error('Erreur lors de la relecture de la vidéo distante:', e));
                } else {
                    console.log('Vidéo distante affichée avec succès, dimensions:', remoteVideoElement.videoWidth, 'x', remoteVideoElement.videoHeight);
                }
            }, 2000);
        };

        // Écouter les candidats ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Candidat ICE généré:', event.candidate);
                // Envoyer le candidat ICE à l'autre participant
                socket.emit('webrtc_signal', {
                    room_id: roomId,
                    signal: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                });
            } else {
                console.log('Fin de la génération des candidats ICE');
            }
        };

        // Écouter les changements d'état de connexion
        peerConnection.onconnectionstatechange = () => {
            console.log('État de la connexion WebRTC:', peerConnection.connectionState);

            if (peerConnection.connectionState === 'connected') {
                console.log('Connexion WebRTC établie avec succès!');

                // Ajouter les candidats ICE en attente si nécessaire
                if (pendingCandidates && pendingCandidates.length > 0) {
                    console.log(`Ajout de ${pendingCandidates.length} candidats ICE en attente`);

                    pendingCandidates.forEach(async (candidate) => {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                            console.log('Candidat ICE en attente ajouté avec succès');
                        } catch (error) {
                            console.error('Erreur lors de l\'ajout d\'un candidat ICE en attente:', error);
                        }
                    });

                    // Vider la liste des candidats en attente
                    pendingCandidates = [];
                }

                // Vérifier que les vidéos s'affichent correctement
                const localVideoElement = document.querySelector('.video-participant:nth-child(1) video');
                const remoteVideoElement = document.querySelector('.video-participant:nth-child(2) video');

                if (localVideoElement && (localVideoElement.videoWidth === 0 || localVideoElement.videoHeight === 0)) {
                    console.warn('La vidéo locale ne semble pas s\'afficher correctement après connexion');
                    localVideoElement.srcObject = null;
                    localVideoElement.srcObject = localStream;
                    localVideoElement.play().catch(e => console.error('Erreur lors de la relecture de la vidéo locale:', e));
                }

                if (remoteVideoElement && (remoteVideoElement.videoWidth === 0 || remoteVideoElement.videoHeight === 0)) {
                    console.warn('La vidéo distante ne semble pas s\'afficher correctement après connexion');
                    remoteVideoElement.srcObject = null;
                    remoteVideoElement.srcObject = remoteStream;
                    remoteVideoElement.play().catch(e => console.error('Erreur lors de la relecture de la vidéo distante:', e));
                }

            } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                console.error('La connexion WebRTC a échoué ou a été déconnectée');
            }
        };

        // Écouter les changements d'état ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('État de la connexion ICE:', peerConnection.iceConnectionState);

            if (peerConnection.iceConnectionState === 'failed') {
                console.error('La connexion ICE a échoué');

                // Essayer de redémarrer la connexion ICE
                console.log('Tentative de redémarrage de la connexion ICE...');
                peerConnection.restartIce();
            } else if (peerConnection.iceConnectionState === 'connected') {
                console.log('Connexion ICE établie avec succès!');
            }
        };

        // Écouter les changements d'état de signalisation
        peerConnection.onsignalingstatechange = () => {
            console.log('État de signalisation WebRTC:', peerConnection.signalingState);
        };

        // Écouter les négociations nécessaires
        peerConnection.onnegotiationneeded = () => {
            console.log('Négociation WebRTC nécessaire');

            // Si nous sommes déjà connectés, créer une nouvelle offre
            if (peerConnection.connectionState === 'connected') {
                console.log('Création d\'une nouvelle offre suite à une renégociation...');
                createOffer();
            }
        };
    }

    // Créer une offre WebRTC
    async function createOffer() {
        try {
            // Créer une offre
            const offer = await peerConnection.createOffer();

            // Définir l'offre comme description locale
            await peerConnection.setLocalDescription(offer);

            // Envoyer l'offre à l'autre participant
            socket.emit('webrtc_signal', {
                room_id: roomId,
                signal: {
                    type: 'offer',
                    sdp: peerConnection.localDescription
                }
            });

        } catch (error) {
            console.error('Erreur lors de la création de l\'offre:', error);
        }
    }

    // Gérer une offre vidéo reçue
    async function handleVideoOffer(offer) {
        try {
            console.log('Traitement de l\'offre vidéo...');

            // Si la connexion WebRTC n'est pas encore initialisée
            if (!peerConnection) {
                console.log('Initialisation de la connexion WebRTC...');

                try {
                    // Demander l'accès à la caméra et au microphone avec des contraintes spécifiques
                    console.log('Demande d\'accès aux périphériques média...');

                    // Essayer d'abord avec des contraintes spécifiques
                    try {
                        localStream = await navigator.mediaDevices.getUserMedia({
                            video: {
                                width: { ideal: 1280 },
                                height: { ideal: 720 },
                                facingMode: "user"
                            },
                            audio: true
                        });
                        console.log('Accès aux périphériques média accordé avec contraintes spécifiques');
                    } catch (specificError) {
                        console.warn('Impossible d\'accéder aux périphériques média avec des contraintes spécifiques:', specificError);
                        console.log('Tentative avec des contraintes génériques...');

                        // Si cela échoue, essayer avec des contraintes génériques
                        localStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: true
                        });
                        console.log('Accès aux périphériques média accordé avec contraintes génériques');
                    }

                    // Vérifier que nous avons bien obtenu un flux vidéo
                    const videoTracks = localStream.getVideoTracks();
                    if (videoTracks.length === 0) {
                        throw new Error('Aucune piste vidéo n\'a été obtenue');
                    }

                    console.log('Pistes vidéo obtenues:', videoTracks);
                    console.log('Paramètres de la piste vidéo:', videoTracks[0].getSettings());

                    // Cacher le placeholder et afficher les contrôles
                    videoPlaceholder.style.display = 'none';
                    videoControls.style.display = 'flex';

                    // Créer les éléments vidéo
                    console.log('Création des éléments vidéo...');
                    const localVideo = document.createElement('div');
                    localVideo.className = 'video-participant';
                    localVideo.innerHTML = `
                        <video class="participant-video" autoplay muted playsinline></video>
                        <div class="participant-info">
                            <i class="fas fa-user"></i>
                            <span>${userName} (Vous)</span>
                        </div>
                    `;

                    const remoteVideo = document.createElement('div');
                    remoteVideo.className = 'video-participant';
                    remoteVideo.innerHTML = `
                        <video class="participant-video" autoplay playsinline></video>
                        <div class="participant-info">
                            <i class="fas fa-user"></i>
                            <span>${otherName}</span>
                        </div>
                    `;

                    // Ajouter les éléments vidéo à la grille
                    videoGrid.appendChild(localVideo);
                    videoGrid.appendChild(remoteVideo);
                    videoGrid.classList.add('two-participants');

                    // Afficher le flux vidéo local
                    const localVideoElement = localVideo.querySelector('video');
                    localVideoElement.srcObject = localStream;

                    // S'assurer que la vidéo est bien chargée
                    localVideoElement.onloadedmetadata = () => {
                        console.log('Métadonnées de la vidéo locale chargées');
                        localVideoElement.play().catch(e => console.error('Erreur lors de la lecture de la vidéo locale:', e));
                    };

                    // Vérifier si la vidéo est bien affichée
                    setTimeout(() => {
                        if (localVideoElement.videoWidth === 0 || localVideoElement.videoHeight === 0) {
                            console.warn('La vidéo locale ne semble pas s\'afficher correctement');

                            // Essayer de réappliquer le flux
                            localVideoElement.srcObject = null;
                            localVideoElement.srcObject = localStream;
                            localVideoElement.play().catch(e => console.error('Erreur lors de la relecture de la vidéo locale:', e));
                        } else {
                            console.log('Vidéo locale affichée avec succès, dimensions:', localVideoElement.videoWidth, 'x', localVideoElement.videoHeight);
                        }
                    }, 2000);

                    // Initialiser la connexion WebRTC
                    console.log('Initialisation de la connexion peer-to-peer...');
                    initializePeerConnection();
                } catch (mediaError) {
                    console.error('Erreur lors de l\'accès aux périphériques média:', mediaError);
                    alert('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier vos permissions et que votre caméra n\'est pas utilisée par une autre application.');

                    // Afficher un message d'erreur plus détaillé dans la console
                    if (mediaError.name) {
                        console.error('Type d\'erreur:', mediaError.name);

                        if (mediaError.name === 'NotAllowedError') {
                            console.error('L\'utilisateur a refusé l\'accès à la caméra ou au microphone');
                        } else if (mediaError.name === 'NotFoundError') {
                            console.error('Aucun périphérique média n\'a été trouvé');
                        } else if (mediaError.name === 'NotReadableError') {
                            console.error('Le périphérique média est déjà utilisé par une autre application');
                        }
                    }
                    return;
                }
            }

            // Définir l'offre comme description distante
            console.log('Définition de l\'offre comme description distante...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Créer une réponse
            console.log('Création d\'une réponse...');
            const answer = await peerConnection.createAnswer();

            // Définir la réponse comme description locale
            console.log('Définition de la réponse comme description locale...');
            await peerConnection.setLocalDescription(answer);

            // Envoyer la réponse à l'autre participant
            console.log('Envoi de la réponse à l\'autre participant...');
            socket.emit('webrtc_signal', {
                room_id: roomId,
                signal: {
                    type: 'answer',
                    sdp: peerConnection.localDescription
                }
            });

            console.log('Réponse envoyée avec succès');

        } catch (error) {
            console.error('Erreur lors du traitement de l\'offre vidéo:', error);
        }
    }

    // Gérer une réponse vidéo reçue
    async function handleVideoAnswer(answer) {
        try {
            console.log('Traitement de la réponse vidéo...');

            if (!peerConnection) {
                console.error('Impossible de traiter la réponse vidéo: la connexion WebRTC n\'est pas initialisée');
                return;
            }

            // Définir la réponse comme description distante
            console.log('Définition de la description distante (réponse)...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Description distante (réponse) définie avec succès');

            // Ajouter les candidats ICE en attente si nécessaire
            if (pendingCandidates && pendingCandidates.length > 0) {
                console.log(`Ajout de ${pendingCandidates.length} candidats ICE en attente après réception de la réponse`);

                for (const candidate of pendingCandidates) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('Candidat ICE en attente ajouté avec succès');
                    } catch (error) {
                        console.error('Erreur lors de l\'ajout d\'un candidat ICE en attente:', error);
                    }
                }

                // Vider la liste des candidats en attente
                pendingCandidates = [];
            }

            console.log('Réponse vidéo traitée avec succès');
        } catch (error) {
            console.error('Erreur lors du traitement de la réponse vidéo:', error);
        }
    }

    // Gérer un nouveau candidat ICE reçu
    async function handleNewICECandidate(candidate) {
        try {
            console.log('Traitement du candidat ICE:', candidate);

            // Ajouter le candidat ICE à la connexion
            if (peerConnection) {
                if (peerConnection.remoteDescription) {
                    console.log('Ajout du candidat ICE à la connexion...');
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Candidat ICE ajouté avec succès');
                } else {
                    console.warn('Impossible d\'ajouter le candidat ICE: la description distante n\'est pas définie');

                    // Stocker le candidat pour l'ajouter plus tard
                    console.log('Stockage du candidat ICE pour ajout ultérieur');
                    pendingCandidates = pendingCandidates || [];
                    pendingCandidates.push(candidate);
                }
            } else {
                console.error('Impossible d\'ajouter le candidat ICE: la connexion n\'est pas initialisée');
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE:', error);
        }
    }

    // Gérer la fermeture de la page
    window.addEventListener('beforeunload', function() {
        // Quitter la salle (avec le paramètre end_consultation à true si c'est un médecin)
        socket.emit('leave_room', {
            room_id: roomId,
            end_consultation: userRole === 'doctor' // Marquer comme terminé seulement si c'est un médecin
        });

        // Fermer la connexion WebRTC
        if (peerConnection) {
            peerConnection.close();
        }

        // Arrêter les flux média
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    });
});
