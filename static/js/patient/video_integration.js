// Script pour l'intégration de la vidéo dans la page doctor_patient_space

document.addEventListener('DOMContentLoaded', function() {
    // Éléments de l'interface
    const videoConsultationSection = document.getElementById('video-consultation-section');
    const closeVideoConsultationBtn = document.getElementById('close-video-consultation');
    const consultationInfo = document.getElementById('consultation-info');
    const videoContainer = document.getElementById('video-container');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const videoGrid = document.getElementById('video-grid');
    const localParticipant = document.getElementById('local-participant');
    const remoteParticipant = document.getElementById('remote-participant');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const doctorNameElement = document.getElementById('doctor-name');
    const connectionStatus = document.getElementById('connection-status');
    const videoCallControls = document.getElementById('video-call-controls');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleAudioBtn = document.getElementById('toggle-audio');
    const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
    const endCallBtn = document.getElementById('end-call');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageBtn = document.getElementById('send-message');

    // Variables pour WebRTC
    let localStream = null;
    let peerConnection = null;
    let remoteStream = null;
    let roomId = null;
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isFullscreen = false;
    let currentAppointmentId = null;
    let pendingCandidates = [];

    // Vérifier si nous avons un ID de salle dans les attributs de données
    let roomIdFromElement = null;
    const roomIdElement = document.getElementById('room-id');
    if (roomIdElement && roomIdElement.value) {
        roomIdFromElement = roomIdElement.value;
        console.log('ID de salle trouvé dans l\'élément caché:', roomIdFromElement);
    }

    // Vérifier si nous avons un ID de salle dans les attributs de données du body
    const roomIdFromBody = document.body.getAttribute('data-room-id');
    if (roomIdFromBody) {
        console.log('ID de salle trouvé dans les attributs de données du body:', roomIdFromBody);
    }

    // Vérifier si nous avons un ID de salle dans les paramètres d'URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room_id');
    if (roomIdFromUrl) {
        console.log('ID de salle trouvé dans les paramètres d\'URL:', roomIdFromUrl);
    }

    // Utiliser l'ID de salle disponible (priorité: URL > body > élément caché)
    roomId = roomIdFromUrl || roomIdFromBody || roomIdFromElement;

    if (roomId) {
        console.log('ID de salle final utilisé:', roomId);

        // Récupérer l'ID du rendez-vous depuis les paramètres d'URL
        const appointmentIdFromUrl = urlParams.get('appointment_id');
        if (appointmentIdFromUrl) {
            currentAppointmentId = appointmentIdFromUrl;
            console.log('ID de rendez-vous trouvé dans les paramètres d\'URL:', currentAppointmentId);
        }

        // Afficher la section de consultation vidéo
        if (videoConsultationSection) {
            console.log('Affichage de la section de consultation vidéo');
            videoConsultationSection.style.display = 'block';

            // Faire défiler jusqu'à la section de consultation
            videoConsultationSection.scrollIntoView({ behavior: 'smooth' });

            // Initialiser la vidéo consultation automatiquement
            console.log('Initialisation automatique de la vidéo consultation dans 1 seconde...');
            setTimeout(() => {
                initializeVideoConsultation();
            }, 1000);
        } else {
            console.error('Section de consultation vidéo non trouvée dans le DOM');
        }
    } else {
        console.log('Aucun ID de salle trouvé, en attente du clic sur le bouton "Rejoindre la consultation"');
    }

    // Récupérer l'ID de l'utilisateur courant depuis les attributs de données
    const current_user_id = document.body.getAttribute('data-user-id') || '';

    // Configuration des serveurs STUN/TURN pour WebRTC
    const iceServers = {
        iceServers: [
            // Serveurs STUN de Google
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },

            // Serveurs STUN alternatifs
            { urls: 'stun:stun.stunprotocol.org:3478' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipbuster.com' },
            { urls: 'stun:stun.voipstunt.com' },
            { urls: 'stun:stun.voxgratia.org' },

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
            },
            {
                urls: 'turn:numb.viagenie.ca',
                username: 'webrtc@live.com',
                credential: 'muazkh'
            },
            {
                urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
                username: 'webrtc',
                credential: 'webrtc'
            }
        ],
        iceCandidatePoolSize: 10
    };

    // Initialiser Socket.IO
    const socket = io();

    // Événements de clic sur les boutons "Rejoindre la consultation"
    const joinConsultationBtns = document.querySelectorAll('.join-consultation-btn');

    joinConsultationBtns.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();

            // Récupérer les informations du rendez-vous
            roomId = this.getAttribute('data-room-id');
            currentAppointmentId = this.getAttribute('data-appointment-id');
            const doctorName = this.getAttribute('data-doctor-name');
            const appointmentTime = this.getAttribute('data-appointment-time');

            console.log('Démarrage de la consultation dans la salle:', roomId);

            // Mettre à jour les informations de la consultation
            if (doctorNameElement) {
                doctorNameElement.textContent = doctorName;
            }

            if (consultationInfo) {
                consultationInfo.textContent = `Rendez-vous du ${appointmentTime}`;
            }

            // Afficher la section de consultation vidéo
            if (videoConsultationSection) {
                videoConsultationSection.style.display = 'block';

                // Faire défiler jusqu'à la section de consultation
                videoConsultationSection.scrollIntoView({ behavior: 'smooth' });
            }

            // Initialiser la vidéo consultation
            initializeVideoConsultation();
        });
    });

    // Événement de clic sur le bouton de fermeture
    if (closeVideoConsultationBtn) {
        closeVideoConsultationBtn.addEventListener('click', function() {
            // Confirmer la fermeture
            if (confirm('Êtes-vous sûr de vouloir quitter la consultation ?')) {
                endVideoConsultation();
            }
        });
    }

    // Événement de clic sur le bouton de démarrage manuel
    const startVideoManuallyBtn = document.getElementById('start-video-manually');
    if (startVideoManuallyBtn) {
        startVideoManuallyBtn.addEventListener('click', function() {
            console.log('Démarrage manuel de la vidéo consultation...');
            initializeVideoConsultation();
        });
    }

    // Fonction pour initialiser la vidéo consultation
    async function initializeVideoConsultation() {
        try {
            console.log('Initialisation de la vidéo consultation...');

            // Vérifier si l'ID de salle est disponible
            if (!roomId) {
                console.error('ID de salle non disponible');
                alert('Erreur: ID de salle non disponible. Veuillez réessayer.');
                return;
            }

            // Demander l'accès à la caméra et au microphone
            console.log('Demande d\'accès à la caméra et au microphone...');
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('Accès aux périphériques média accordé');

            // Masquer le placeholder et afficher les vidéos
            videoPlaceholder.style.display = 'none';
            localParticipant.style.display = 'block';
            remoteParticipant.style.display = 'block';
            videoCallControls.style.display = 'flex';
            videoGrid.classList.add('active');

            // Afficher le flux vidéo local
            localVideo.srcObject = localStream;
            console.log('Flux vidéo local affiché');

            // Rejoindre la salle
            console.log('Rejoindre la salle:', roomId);
            socket.emit('join_room', { room_id: roomId });

            // Initialiser la connexion WebRTC
            console.log('Initialisation de la connexion WebRTC...');
            initializePeerConnection();

            // Attendre un instant pour s'assurer que la connexion à la salle est établie
            console.log('Attente avant création de l\'offre WebRTC...');
            setTimeout(() => {
                console.log('Création de l\'offre WebRTC...');
                createOffer();
            }, 3000); // Délai plus long pour s'assurer que tout est bien initialisé

        } catch (error) {
            console.error('Erreur lors de l\'accès aux périphériques média:', error);
            alert('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier vos permissions.');
        }
    }

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
        remoteVideo.srcObject = remoteStream;

        // Écouter les pistes entrantes
        peerConnection.ontrack = (event) => {
            console.log('Nouvelle piste reçue:', event.track.kind);
            event.streams[0].getTracks().forEach(track => {
                console.log('Ajout de la piste distante au flux distant:', track.kind);
                remoteStream.addTrack(track);
            });

            // Masquer le statut de connexion
            if (connectionStatus) {
                connectionStatus.style.display = 'none';
            }
        };

        // Écouter les candidats ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Nouveau candidat ICE:', event.candidate);
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

        // Écouter les changements d'état de connexion ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('État de connexion ICE:', peerConnection.iceConnectionState);

            // Afficher l'état de connexion dans la console pour le débogage
            switch (peerConnection.iceConnectionState) {
                case 'new':
                    console.log('ICE: Nouvel état - en attente de candidats');
                    break;
                case 'checking':
                    console.log('ICE: Vérification des candidats en cours...');
                    if (connectionStatus) {
                        connectionStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connexion en cours...';
                        connectionStatus.style.display = 'flex';
                    }
                    break;
                case 'connected':
                    console.log('ICE: Connexion établie!');
                    if (connectionStatus) {
                        connectionStatus.style.display = 'none';
                    }
                    break;
                case 'completed':
                    console.log('ICE: Connexion établie et complète');
                    if (connectionStatus) {
                        connectionStatus.style.display = 'none';
                    }
                    break;
                case 'disconnected':
                    console.log('ICE: Connexion temporairement interrompue');
                    if (connectionStatus) {
                        connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Connexion instable';
                        connectionStatus.style.display = 'flex';
                    }
                    break;
                case 'failed':
                    console.log('ICE: Échec de la connexion');
                    if (connectionStatus) {
                        connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Échec de la connexion';
                        connectionStatus.style.display = 'flex';
                    }
                    // Tenter de redémarrer la connexion ICE
                    console.log('Tentative de redémarrage de la connexion ICE...');
                    peerConnection.restartIce();
                    break;
                case 'closed':
                    console.log('ICE: Connexion fermée');
                    if (connectionStatus) {
                        connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Connexion fermée';
                        connectionStatus.style.display = 'flex';
                    }
                    break;
            }
        };

        // Écouter les changements d'état de connexion
        peerConnection.onconnectionstatechange = () => {
            console.log('État de la connexion WebRTC:', peerConnection.connectionState);
        };
    }

    // Créer une offre WebRTC
    async function createOffer() {
        if (!peerConnection) {
            console.error('Peer connection non initialisé');
            return;
        }

        try {
            console.log('Création de l\'offre...');
            const offer = await peerConnection.createOffer();
            console.log('Offre créée:', offer);

            console.log('Définition de la description locale (offre)...');
            await peerConnection.setLocalDescription(offer);
            console.log('Description locale (offre) définie avec succès');

            console.log('Envoi de l\'offre au serveur...');
            socket.emit('webrtc_signal', {
                room_id: roomId,
                signal: {
                    type: 'offer',
                    sdp: peerConnection.localDescription
                }
            });
            console.log('Offre envoyée avec succès');
        } catch (error) {
            console.error('Erreur lors de la création de l\'offre:', error);
        }
    }

    // Gérer les signaux WebRTC
    socket.on('webrtc_signal', async (data) => {
        console.log('Signal WebRTC reçu:', data);

        const signal = data.signal;
        const senderId = data.sender_id;

        console.log(`Signal de type ${signal.type} reçu de ${senderId}`);

        if (!peerConnection) {
            console.warn('Signal reçu mais peer connection non initialisé');
            console.log('Initialisation de la connexion WebRTC...');
            initializePeerConnection();
        }

        if (signal.type === 'offer') {
            console.log('Traitement de l\'offre vidéo...');
            try {
                console.log('Définition de la description distante (offre)...');
                await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                console.log('Description distante (offre) définie avec succès');

                // Ajouter les candidats ICE en attente
                if (pendingCandidates.length > 0) {
                    console.log(`Ajout de ${pendingCandidates.length} candidats ICE en attente...`);
                    for (const candidate of pendingCandidates) {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                            console.log('Candidat ICE en attente ajouté avec succès');
                        } catch (error) {
                            console.error('Erreur lors de l\'ajout d\'un candidat ICE en attente:', error);
                        }
                    }
                    pendingCandidates = [];
                }

                console.log('Création de la réponse...');
                const answer = await peerConnection.createAnswer();
                console.log('Réponse créée:', answer);

                console.log('Définition de la description locale (réponse)...');
                await peerConnection.setLocalDescription(answer);
                console.log('Description locale (réponse) définie avec succès');

                console.log('Envoi de la réponse...');
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
        } else if (signal.type === 'answer') {
            console.log('Traitement de la réponse vidéo...');
            try {
                if (!peerConnection.remoteDescription) {
                    console.log('Définition de la description distante (réponse)...');
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    console.log('Description distante (réponse) définie avec succès');

                    // Ajouter les candidats ICE en attente
                    if (pendingCandidates.length > 0) {
                        console.log(`Ajout de ${pendingCandidates.length} candidats ICE en attente...`);
                        for (const candidate of pendingCandidates) {
                            try {
                                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                                console.log('Candidat ICE en attente ajouté avec succès');
                            } catch (error) {
                                console.error('Erreur lors de l\'ajout d\'un candidat ICE en attente:', error);
                            }
                        }
                        pendingCandidates = [];
                    }
                } else {
                    console.warn('La description distante est déjà définie');
                }
            } catch (error) {
                console.error('Erreur lors du traitement de la réponse vidéo:', error);
            }
        } else if (signal.type === 'ice-candidate') {
            console.log('Traitement du candidat ICE...');
            try {
                if (peerConnection.remoteDescription) {
                    console.log('Ajout du candidat ICE à la connexion...');
                    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    console.log('Candidat ICE ajouté avec succès');
                } else {
                    console.warn('Impossible d\'ajouter le candidat ICE: la description distante n\'est pas définie');
                    // Stocker le candidat pour l'ajouter plus tard
                    console.log('Stockage du candidat ICE pour ajout ultérieur');
                    pendingCandidates = pendingCandidates || [];
                    pendingCandidates.push(signal.candidate);
                }
            } catch (error) {
                console.error('Erreur lors du traitement du candidat ICE:', error);
            }
        }
    });

    // Événements Socket.IO
    socket.on('connect', () => {
        console.log('Connecté à Socket.IO');
    });

    socket.on('user_joined', (data) => {
        console.log(`${data.user_name} a rejoint la salle`, data);

        // Mettre à jour le statut de connexion
        if (connectionStatus) {
            connectionStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connexion en cours...';
        }
    });

    socket.on('user_left', (data) => {
        console.log(`${data.user_name} a quitté la salle`, data);

        // Mettre à jour le statut de connexion
        if (connectionStatus) {
            connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Le médecin a quitté la consultation';
            connectionStatus.style.display = 'flex';
        }
    });

    // Recevoir un nouveau message
    socket.on('new_message', (data) => {
        console.log('Nouveau message reçu:', data);

        // Vérifier le format des données et ajouter le message au chat
        if (data) {
            // Si le message vient d'être reçu, utiliser directement l'objet data
            addChatMessage(data);
        }
    });

    // Fonction pour envoyer un message
    function sendMessage() {
        const message = chatInput.value.trim();

        if (message && roomId) {
            console.log('Envoi du message:', message);

            // Envoyer le message via Socket.IO
            socket.emit('send_message', {
                room_id: roomId,
                content: message
            });

            // Créer un objet message pour l'affichage local
            const now = new Date();
            const timeString = now.getHours().toString().padStart(2, '0') + ':' +
                              now.getMinutes().toString().padStart(2, '0');

            const messageData = {
                sender_name: 'Vous',
                content: message,
                sender_id: current_user_id,
                timestamp: timeString
            };

            // Ajouter le message au chat
            addChatMessage(messageData);

            // Vider le champ de saisie
            chatInput.value = '';
        }
    }

    // Fonction pour ajouter un message au chat
    function addChatMessage(sender, content, isSent) {
        if (!chatMessages) return;

        // Gérer les deux formats possibles de paramètres
        let senderName = sender;
        let messageContent = content;
        let isMessageSent = isSent;

        // Si le premier paramètre est un objet (format de données complet)
        if (typeof sender === 'object' && sender !== null) {
            const data = sender;
            senderName = data.sender_name;
            messageContent = data.content;
            isMessageSent = data.sender_id == current_user_id;
        }

        // Créer l'élément de message
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${isMessageSent ? 'sent' : 'received'}`;

        // Obtenir l'heure actuelle ou utiliser celle du message
        const now = new Date();
        const timeString = (typeof sender === 'object' && sender.timestamp) ?
            sender.timestamp :
            now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        // Ajouter le contenu du message
        messageElement.innerHTML = `
            <div class="message-bubble">
                ${messageContent}
            </div>
            <div class="message-info">
                <span class="message-time">${timeString}</span>
                ${isMessageSent ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
            </div>
        `;

        // Ajouter le message au conteneur
        chatMessages.appendChild(messageElement);

        // Faire défiler vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Événement de clic sur le bouton d'envoi de message
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }

    // Événement de pression de la touche Entrée dans le champ de saisie
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Contrôles vidéo
    if (toggleVideoBtn) {
        toggleVideoBtn.addEventListener('click', function() {
            isVideoEnabled = !isVideoEnabled;

            // Activer/désactiver la vidéo
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoEnabled;
            });

            // Mettre à jour l'icône du bouton
            this.innerHTML = isVideoEnabled ?
                '<i class="fas fa-video"></i>' :
                '<i class="fas fa-video-slash"></i>';

            // Mettre à jour la classe du bouton
            this.classList.toggle('active', isVideoEnabled);
        });
    }

    if (toggleAudioBtn) {
        toggleAudioBtn.addEventListener('click', function() {
            isAudioEnabled = !isAudioEnabled;

            // Activer/désactiver l'audio
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isAudioEnabled;
            });

            // Mettre à jour l'icône du bouton
            this.innerHTML = isAudioEnabled ?
                '<i class="fas fa-microphone"></i>' :
                '<i class="fas fa-microphone-slash"></i>';

            // Mettre à jour la classe du bouton
            this.classList.toggle('active', isAudioEnabled);
        });
    }

    // Fonction pour terminer la vidéo consultation
    function endVideoConsultation() {
        console.log('Fin de la vidéo consultation...');

        // Fermer les flux média
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            localStream = null;
        }

        // Fermer la connexion WebRTC
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        // Réinitialiser l'interface
        if (videoPlaceholder) {
            videoPlaceholder.style.display = 'block';
        }

        if (localParticipant) {
            localParticipant.style.display = 'none';
        }

        if (remoteParticipant) {
            remoteParticipant.style.display = 'none';
        }

        if (videoCallControls) {
            videoCallControls.style.display = 'none';
        }

        if (videoGrid) {
            videoGrid.classList.remove('active');
        }

        // Masquer la section de consultation vidéo
        if (videoConsultationSection) {
            videoConsultationSection.style.display = 'none';
        }

        // Réinitialiser les variables
        roomId = null;
        currentAppointmentId = null;

        console.log('Vidéo consultation terminée');
    }

    // Gestion du mode plein écran
    if (toggleFullscreenBtn) {
        toggleFullscreenBtn.addEventListener('click', function() {
            isFullscreen = !isFullscreen;

            // Basculer la classe fullscreen
            if (videoContainer) {
                videoContainer.classList.toggle('fullscreen', isFullscreen);
            }

            // Mettre à jour l'icône du bouton
            this.innerHTML = isFullscreen ?
                '<i class="fas fa-compress"></i>' :
                '<i class="fas fa-expand"></i>';

            // Mettre à jour la classe du bouton
            this.classList.toggle('fullscreen-active', isFullscreen);

            // Gérer l'échappement du mode plein écran avec la touche Escape
            if (isFullscreen) {
                document.addEventListener('keydown', handleEscapeKey);
            } else {
                document.removeEventListener('keydown', handleEscapeKey);
            }
        });
    }

    // Fonction pour gérer la touche Escape en mode plein écran
    function handleEscapeKey(event) {
        if (event.key === 'Escape' && isFullscreen && toggleFullscreenBtn) {
            toggleFullscreenBtn.click();
        }
    }

    if (endCallBtn) {
        endCallBtn.addEventListener('click', function() {
            if (confirm('Êtes-vous sûr de vouloir terminer la consultation ?')) {
                endVideoConsultation();
            }
        });
    }

    // Fonction pour terminer la consultation vidéo
    function endVideoConsultation() {
        // Fermer la connexion WebRTC
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        // Arrêter les flux média
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Quitter la salle (sans marquer comme terminé car seul le médecin peut le faire)
        if (roomId) {
            socket.emit('leave_room', {
                room_id: roomId,
                end_consultation: false  // Le patient ne peut pas terminer la consultation
            });
            roomId = null;
        }

        // Sortir du mode plein écran si actif
        if (isFullscreen && videoContainer) {
            videoContainer.classList.remove('fullscreen');
            if (toggleFullscreenBtn) {
                toggleFullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                toggleFullscreenBtn.classList.remove('fullscreen-active');
            }
            isFullscreen = false;
            document.removeEventListener('keydown', handleEscapeKey);
        }

        // Réinitialiser l'interface
        if (videoPlaceholder) videoPlaceholder.style.display = 'flex';
        if (localParticipant) localParticipant.style.display = 'none';
        if (remoteParticipant) remoteParticipant.style.display = 'none';
        if (videoCallControls) videoCallControls.style.display = 'none';
        if (videoGrid) videoGrid.classList.remove('active');

        // Réinitialiser les flux vidéo
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        // Vider le chat
        if (chatMessages) {
            // Conserver uniquement le message d'information
            const chatInfo = chatMessages.querySelector('.chat-info');
            if (chatInfo) {
                chatMessages.innerHTML = '';
                chatMessages.appendChild(chatInfo);
            } else {
                chatMessages.innerHTML = '';
            }
        }

        // Masquer la section de consultation vidéo
        if (videoConsultationSection) {
            videoConsultationSection.style.display = 'none';
        }

        // Réinitialiser les variables
        currentAppointmentId = null;
    }
});
