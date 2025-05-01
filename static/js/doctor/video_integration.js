// Script pour l'intégration de la vidéo dans la page virtual_office

document.addEventListener('DOMContentLoaded', function() {
    // Éléments de l'interface
    const joinConsultationBtn = document.getElementById('join-consultation-btn');
    const videoContainer = document.getElementById('video-container');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const videoGrid = document.getElementById('video-grid');
    const localParticipant = document.getElementById('local-participant');
    const remoteParticipant = document.getElementById('remote-participant');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const connectionStatus = document.getElementById('connection-status');
    const videoCallControls = document.getElementById('video-call-controls');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleAudioBtn = document.getElementById('toggle-audio');
    const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
    const endCallBtn = document.getElementById('end-call');

    // Variables pour WebRTC
    let localStream = null;
    let peerConnection = null;
    let remoteStream = null;
    let roomId = null;
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isFullscreen = false;
    let pendingCandidates = [];

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

    // Événement de clic sur le bouton "Rejoindre la consultation"
    if (joinConsultationBtn) {
        joinConsultationBtn.addEventListener('click', function() {
            // Récupérer l'ID de la salle
            roomId = this.getAttribute('data-room-id');
            console.log('Démarrage de la consultation dans la salle:', roomId);

            // Initialiser la vidéo consultation
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

            // Masquer le bouton de démarrage
            joinConsultationBtn.style.display = 'none';

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
            connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Le patient a quitté la consultation';
            connectionStatus.style.display = 'flex';
        }
    });

    // Gestionnaire pour les messages de chat
    socket.on('new_message', (data) => {
        console.log('Nouveau message reçu:', data);

        // Vérifier si la fonction addChatMessage existe (définie dans virtual_office.js)
        if (typeof addChatMessage === 'function') {
            addChatMessage(data);
        } else {
            console.warn('La fonction addChatMessage n\'est pas définie. Le message ne peut pas être affiché.');

            // Afficher une notification
            const notificationElement = document.createElement('div');
            notificationElement.className = 'notification';
            notificationElement.innerHTML = `
                <div class="notification-content">
                    <strong>${data.sender_name}:</strong> ${data.content}
                </div>
            `;
            document.body.appendChild(notificationElement);

            // Supprimer la notification après 5 secondes
            setTimeout(() => {
                notificationElement.remove();
            }, 5000);
        }
    });

    // Fonction pour envoyer un message de chat
    function sendChatMessage(message, isUrgent = false) {
        if (message && roomId) {
            console.log('Envoi du message:', message);

            // Envoyer le message via Socket.IO
            socket.emit('send_message', {
                room_id: roomId,
                content: message,
                is_urgent: isUrgent
            });

            return true;
        }
        return false;
    }

    // Exposer la fonction sendChatMessage globalement
    window.sendChatMessage = sendChatMessage;

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

                // Quitter la salle et marquer la consultation comme terminée
                socket.emit('leave_room', {
                    room_id: roomId,
                    end_consultation: true  // Indiquer que la consultation est terminée
                });

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
                videoPlaceholder.style.display = 'flex';
                localParticipant.style.display = 'none';
                remoteParticipant.style.display = 'none';
                videoCallControls.style.display = 'none';
                videoGrid.classList.remove('active');
                joinConsultationBtn.style.display = 'inline-flex';

                // Réinitialiser les flux vidéo
                localVideo.srcObject = null;
                remoteVideo.srcObject = null;
            }
        });
    }
});
