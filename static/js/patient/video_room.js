document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les informations de la salle et de l'utilisateur
    const roomId = document.body.getAttribute('data-room-id');
    const userId = document.body.getAttribute('data-user-id');
    const userRole = document.body.getAttribute('data-user-role');
    const userName = document.body.getAttribute('data-user-name');
    const otherName = document.body.getAttribute('data-other-name');

    console.log('Initialisation de la salle vidéo côté patient:');
    console.log('- Rôle:', userRole);
    console.log('- Nom:', userName);
    console.log('- Autre participant:', otherName);
    console.log('- ID de salle:', roomId);
    console.log('- ID utilisateur:', userId);

    // Variables pour WebRTC
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let pendingCandidates = [];

    // Configuration des serveurs ICE (STUN/TURN)
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

    // Initialiser Socket.IO
    const socket = io();

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
        console.log('Signal WebRTC reçu:', data);

        const signal = data.signal;
        const senderId = data.sender_id;

        console.log(`Signal de type ${signal.type} reçu de ${senderId}`);

        if (signal.type === 'offer') {
            console.log('Traitement de l\'offre vidéo...');
            handleVideoOffer(signal);
        } else if (signal.type === 'answer') {
            console.log('Traitement de la réponse vidéo...');
            handleVideoAnswer(signal);
        } else if (signal.type === 'ice-candidate') {
            console.log('Traitement du candidat ICE...');
            handleNewICECandidate(signal.candidate);
        }
    });

    // Gérer une offre vidéo reçue
    async function handleVideoOffer(offer) {
        try {
            console.log('Traitement de l\'offre vidéo...');

            // Si la connexion WebRTC n'est pas encore initialisée
            if (!peerConnection) {
                console.log('Initialisation de la connexion WebRTC suite à une offre...');

                // Demander l'accès à la caméra et au microphone si ce n'est pas déjà fait
                if (!localStream) {
                    try {
                        console.log('Demande d\'accès aux périphériques média...');
                        localStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: true
                        });
                        console.log('Accès aux périphériques média accordé');

                        // Afficher le flux vidéo local
                        const localVideoElement = document.querySelector('.video-participant:nth-child(1) video');
                        if (localVideoElement) {
                            localVideoElement.srcObject = localStream;
                        }

                        // Cacher le placeholder
                        const videoPlaceholder = document.querySelector('.video-placeholder');
                        if (videoPlaceholder) {
                            videoPlaceholder.style.display = 'none';
                        }

                        // Afficher les contrôles
                        const videoControls = document.querySelector('.video-controls');
                        if (videoControls) {
                            videoControls.style.display = 'flex';
                        }
                    } catch (mediaError) {
                        console.error('Erreur lors de l\'accès aux périphériques média:', mediaError);
                        alert('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier vos permissions.');
                        return;
                    }
                }

                // Initialiser la connexion WebRTC
                console.log('Initialisation de la connexion peer-to-peer...');
                initializePeerConnection();
            }

            // Définir l'offre comme description distante
            console.log('Définition de la description distante...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('Description distante définie avec succès');

            // Créer une réponse
            console.log('Création d\'une réponse...');
            const answer = await peerConnection.createAnswer();
            console.log('Réponse créée avec succès');

            // Définir la réponse comme description locale
            console.log('Définition de la description locale...');
            await peerConnection.setLocalDescription(answer);
            console.log('Description locale définie avec succès');

            // Envoyer la réponse à l'autre participant
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
        remoteVideoElement.srcObject = remoteStream;

        // Écouter les pistes entrantes
        peerConnection.ontrack = (event) => {
            console.log('Piste reçue:', event);
            event.streams[0].getTracks().forEach(track => {
                console.log('Ajout de la piste au flux distant:', track.kind);
                remoteStream.addTrack(track);
            });
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
            }
        };
    }

    // Créer une offre WebRTC
    async function createOffer() {
        try {
            console.log('Création d\'une offre WebRTC...');

            // Créer une offre
            const offer = await peerConnection.createOffer();

            // Définir l'offre comme description locale
            await peerConnection.setLocalDescription(offer);

            console.log('Offre créée:', offer);

            // Envoyer l'offre à l'autre participant
            socket.emit('webrtc_signal', {
                room_id: roomId,
                signal: {
                    type: 'offer',
                    sdp: peerConnection.localDescription
                }
            });

            console.log('Offre envoyée');

        } catch (error) {
            console.error('Erreur lors de la création de l\'offre:', error);
        }
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

            // Demander l'accès à la caméra et au microphone
            console.log('Demande d\'accès aux périphériques média...');
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('Accès aux périphériques média accordé');

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
            alert('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier vos permissions.');
        }
    }

    // Contrôles vidéo
    const toggleMicBtn = document.getElementById('toggle-mic');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleScreenBtn = document.getElementById('toggle-screen');
    const endCallBtn = document.getElementById('end-call');

    if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    toggleMicBtn.querySelector('i').classList.toggle('fa-microphone');
                    toggleMicBtn.querySelector('i').classList.toggle('fa-microphone-slash');
                }
            }
        });
    }

    if (toggleVideoBtn) {
        toggleVideoBtn.addEventListener('click', () => {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = !videoTrack.enabled;
                    toggleVideoBtn.querySelector('i').classList.toggle('fa-video');
                    toggleVideoBtn.querySelector('i').classList.toggle('fa-video-slash');
                }
            }
        });
    }

    if (toggleScreenBtn) {
        toggleScreenBtn.addEventListener('click', async () => {
            try {
                if (toggleScreenBtn.classList.contains('active')) {
                    // Revenir à la caméra
                    toggleScreenBtn.classList.remove('active');

                    // Arrêter le partage d'écran
                    localStream.getTracks().forEach(track => track.stop());

                    // Redémarrer la caméra
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });

                    // Mettre à jour la vidéo locale
                    const localVideoElement = document.querySelector('.video-participant:nth-child(1) video');
                    if (localVideoElement) {
                        localVideoElement.srcObject = localStream;
                    }

                    // Mettre à jour la connexion WebRTC
                    if (peerConnection) {
                        // Remplacer les pistes
                        const senders = peerConnection.getSenders();
                        const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                        const audioSender = senders.find(sender => sender.track && sender.track.kind === 'audio');

                        if (videoSender) {
                            videoSender.replaceTrack(localStream.getVideoTracks()[0]);
                        }

                        if (audioSender) {
                            audioSender.replaceTrack(localStream.getAudioTracks()[0]);
                        }
                    }
                } else {
                    // Partager l'écran
                    toggleScreenBtn.classList.add('active');

                    // Demander l'accès à l'écran
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true
                    });

                    // Combiner l'audio de la caméra avec la vidéo de l'écran
                    const audioTrack = localStream.getAudioTracks()[0];
                    screenStream.addTrack(audioTrack);

                    // Arrêter les anciennes pistes vidéo
                    localStream.getVideoTracks().forEach(track => track.stop());

                    // Mettre à jour le flux local
                    localStream = screenStream;

                    // Mettre à jour la vidéo locale
                    const localVideoElement = document.querySelector('.video-participant:nth-child(1) video');
                    if (localVideoElement) {
                        localVideoElement.srcObject = localStream;
                    }

                    // Mettre à jour la connexion WebRTC
                    if (peerConnection) {
                        // Remplacer la piste vidéo
                        const senders = peerConnection.getSenders();
                        const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');

                        if (videoSender) {
                            videoSender.replaceTrack(localStream.getVideoTracks()[0]);
                        }
                    }

                    // Écouter la fin du partage d'écran
                    screenStream.getVideoTracks()[0].onended = async () => {
                        toggleScreenBtn.classList.remove('active');

                        // Redémarrer la caméra
                        localStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: true
                        });

                        // Mettre à jour la vidéo locale
                        const localVideoElement = document.querySelector('.video-participant:nth-child(1) video');
                        if (localVideoElement) {
                            localVideoElement.srcObject = localStream;
                        }

                        // Mettre à jour la connexion WebRTC
                        if (peerConnection) {
                            // Remplacer les pistes
                            const senders = peerConnection.getSenders();
                            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                            const audioSender = senders.find(sender => sender.track && sender.track.kind === 'audio');

                            if (videoSender) {
                                videoSender.replaceTrack(localStream.getVideoTracks()[0]);
                            }

                            if (audioSender) {
                                audioSender.replaceTrack(localStream.getAudioTracks()[0]);
                            }
                        }
                    };
                }
            } catch (error) {
                console.error('Erreur lors du partage d\'écran:', error);
                toggleScreenBtn.classList.remove('active');
            }
        });
    }

    if (endCallBtn) {
        endCallBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir terminer la consultation ?')) {
                // Arrêter les flux média
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                }

                // Fermer la connexion WebRTC
                if (peerConnection) {
                    peerConnection.close();
                    peerConnection = null;
                }

                // Quitter la salle
                socket.emit('leave_room', { room_id: roomId });

                // Rediriger vers la page précédente
                window.location.href = '/patient/doctor_patient_space';
            }
        });
    }

    // Gestion du chat
    const chatInput = document.getElementById('chat-input');
    const sendMessageBtn = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');

    if (chatInput && sendMessageBtn && chatMessages) {
        // Charger l'historique des messages
        socket.on('message_history', (data) => {
            console.log('Historique des messages reçu:', data);

            // Afficher les messages
            data.messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = `message ${message.sender_id === userId ? 'sent' : 'received'}`;
                messageElement.innerHTML = `
                    <div class="message-content">
                        <div class="message-sender">${message.sender_name}</div>
                        <div class="message-text">${message.content}</div>
                        <div class="message-time">${message.timestamp}</div>
                    </div>
                `;

                chatMessages.appendChild(messageElement);
            });

            // Faire défiler vers le bas
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        // Écouter les nouveaux messages
        socket.on('new_message', (data) => {
            console.log('Nouveau message reçu:', data);

            // Afficher le message
            const messageElement = document.createElement('div');
            messageElement.className = `message ${data.sender_id === userId ? 'sent' : 'received'}`;
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-sender">${data.sender_name}</div>
                    <div class="message-text">${data.content}</div>
                    <div class="message-time">${data.timestamp}</div>
                </div>
            `;

            chatMessages.appendChild(messageElement);

            // Faire défiler vers le bas
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        // Envoyer un message
        function sendMessage() {
            const message = chatInput.value.trim();

            if (message) {
                console.log('Envoi du message:', message);

                socket.emit('send_message', {
                    room_id: roomId,
                    content: message
                });

                // Vider le champ de saisie
                chatInput.value = '';
            }
        }

        // Événement de clic sur le bouton d'envoi
        sendMessageBtn.addEventListener('click', sendMessage);

        // Événement de pression de la touche Entrée
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
});
