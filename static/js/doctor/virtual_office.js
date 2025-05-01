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

    // Onglets de navigation principaux (All calls, Video call, Lab results)
    const mainTabItems = document.querySelectorAll('.consultation-tabs > .tab-item');
    const mainTabPanes = document.querySelectorAll('.tab-content > .tab-pane');

    console.log('Nombre d\'onglets principaux trouvés:', mainTabItems.length);
    console.log('Nombre de panneaux principaux trouvés:', mainTabPanes.length);

    mainTabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            // Récupérer l'ID de l'onglet
            const tabId = this.getAttribute('data-tab');
            console.log('Clic sur l\'onglet principal:', tabId);

            // Supprimer la classe active de tous les onglets et panneaux principaux
            mainTabItems.forEach(t => t.classList.remove('active'));
            mainTabPanes.forEach(p => p.classList.remove('active'));

            // Ajouter la classe active à l'onglet et au panneau cliqués
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Si on clique sur l'onglet "video-call" et qu'on a un ID de rendez-vous
            if (tabId === 'video-call') {
                // Mettre à jour l'URL
                window.location.hash = 'video-call';

                // Récupérer l'ID du rendez-vous depuis l'attribut data-appointment-id du body
                const appointmentId = document.body.getAttribute('data-appointment-id');
                console.log('ID de rendez-vous lors du clic sur l\'onglet video-call:', appointmentId);

                if (appointmentId) {
                    // Recharger les informations du rendez-vous
                    console.log('Rechargement des informations du rendez-vous');

                    // Utiliser la fonction reloadAppointmentData pour recharger les informations
                    // mais sans changer l'onglet actif (puisqu'on vient de le faire)
                    reloadAppointmentData(appointmentId);
                } else {
                    console.warn('Aucun ID de rendez-vous trouvé lors du clic sur l\'onglet video-call');
                }
            } else if (tabId === 'all-calls') {
                // Si on revient à l'onglet "all-calls", mettre à jour l'URL
                window.location.hash = '';
            }
        });
    });

    // Onglets secondaires (Notes/Prescription dans la section Video call)
    const secondaryTabButtons = document.querySelectorAll('.consultation-tabs > .tab-button');
    const secondaryTabPanes = document.querySelectorAll('.consultation-content > .tab-pane');

    console.log('Nombre d\'onglets secondaires trouvés:', secondaryTabButtons.length);
    console.log('Nombre de panneaux secondaires trouvés:', secondaryTabPanes.length);

    secondaryTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Récupérer l'ID de l'onglet
            const tabId = this.getAttribute('data-tab') + '-tab';
            console.log('Clic sur l\'onglet secondaire:', tabId);

            // Supprimer la classe active de tous les onglets et panneaux secondaires
            secondaryTabButtons.forEach(t => t.classList.remove('active'));
            secondaryTabPanes.forEach(p => p.classList.remove('active'));

            // Ajouter la classe active à l'onglet et au panneau cliqués
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Fonction pour recharger les données du rendez-vous sans changer d'onglet
    function reloadAppointmentData(appointmentId) {
        console.log('Rechargement des données du rendez-vous:', appointmentId);

        // Charger les informations du rendez-vous
        fetch(`/doctor/get_appointment_data/${appointmentId}`)
            .then(response => response.json())
            .then(data => {
                console.log('Données du rendez-vous reçues:', data);

                // Mettre à jour les informations du patient
                const patientNameElement = document.getElementById('current-patient-name');
                if (patientNameElement) {
                    patientNameElement.textContent = data.patient_name;
                    patientNameElement.setAttribute('data-patient-id', data.patient_id);
                    patientNameElement.setAttribute('data-appointment-id', appointmentId);

                    // Supprimer l'ancien badge de salle vidéo s'il existe
                    const existingBadge = patientNameElement.querySelector('.room-id-badge');
                    if (existingBadge) {
                        existingBadge.remove();
                    }

                    // Ajouter l'ID de la salle vidéo si disponible
                    if (data.video_room_id) {
                        const roomIdBadge = document.createElement('span');
                        roomIdBadge.className = 'room-id-badge';
                        roomIdBadge.title = 'ID de salle vidéo';
                        roomIdBadge.innerHTML = `<i class="fas fa-video"></i> ${data.video_room_id}`;
                        patientNameElement.appendChild(roomIdBadge);
                        patientNameElement.setAttribute('data-room-id', data.video_room_id);

                        // Mettre à jour la variable globale roomId
                        roomId = data.video_room_id;
                    }
                }

                // Mettre à jour les détails du patient
                updatePatientDetails(data);

                // Mettre à jour les informations de date et d'heure du rendez-vous
                if (data.appointment_date) {
                    const appointmentDateElements = document.querySelectorAll('.appointment-date');
                    appointmentDateElements.forEach(el => {
                        el.innerHTML = `<i class="far fa-calendar"></i> ${data.appointment_date}`;
                    });
                }

                if (data.appointment_time) {
                    const appointmentTimeElements = document.querySelectorAll('.appointment-time');
                    appointmentTimeElements.forEach(el => {
                        el.innerHTML = `<i class="far fa-clock"></i> ${data.appointment_time}`;
                    });
                }

                // Mettre à jour les zones de notes et de prescription
                const consultationNotes = document.getElementById('consultation-notes');
                if (consultationNotes && data.notes) {
                    consultationNotes.value = data.notes;
                }

                // Mettre à jour la prescription si elle existe
                if (data.prescription) {
                    const prescriptionContent = document.getElementById('prescription-content');
                    if (prescriptionContent) {
                        prescriptionContent.value = data.prescription;
                    }
                }

                // Mettre à jour le lien de consultation vidéo
                if (data.video_room_id) {
                    const joinConsultationBtn = document.querySelector('.join-consultation-btn');
                    if (joinConsultationBtn) {
                        joinConsultationBtn.href = `/video_room/${data.video_room_id}`;
                    }
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des informations du rendez-vous:', error);
            });
    }

    // Boutons d'action (Patient chat / Doctor's notes)
    const patientChatBtn = document.querySelector('.patient-chat-btn');
    const doctorNotesBtn = document.querySelector('.doctor-notes-btn');
    const chatContainer = document.querySelector('.chat-container');
    const notesContainer = document.querySelector('.notes-container');

    if (patientChatBtn && doctorNotesBtn) {
        patientChatBtn.addEventListener('click', function() {
            patientChatBtn.classList.add('active');
            doctorNotesBtn.classList.remove('active');
            chatContainer.classList.add('active');
            notesContainer.classList.remove('active');
        });

        doctorNotesBtn.addEventListener('click', function() {
            doctorNotesBtn.classList.add('active');
            patientChatBtn.classList.remove('active');
            notesContainer.classList.add('active');
            chatContainer.classList.remove('active');
        });
    }

    // Fonction pour activer l'onglet "Video call" et charger les informations du rendez-vous
    function activateVideoCallTab(appointmentId) {
        console.log('Activation de l\'onglet Video call pour le rendez-vous:', appointmentId);

        // Mettre à jour l'attribut data-appointment-id du body
        document.body.setAttribute('data-appointment-id', appointmentId);

        // Rediriger vers l'onglet "Video call"
        const videoCallTab = document.querySelector('.consultation-tabs > .tab-item[data-tab="video-call"]');
        const videoCallPane = document.getElementById('video-call');

        // Supprimer la classe active de tous les onglets et panneaux principaux
        document.querySelectorAll('.consultation-tabs > .tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content > .tab-pane').forEach(p => p.classList.remove('active'));

        // Ajouter la classe active à l'onglet et au panneau "Video call"
        if (videoCallTab) {
            videoCallTab.classList.add('active');
        } else {
            console.error('Onglet Video call non trouvé');
        }

        if (videoCallPane) {
            videoCallPane.classList.add('active');
        } else {
            console.error('Panneau Video call non trouvé');
        }

        // Mettre à jour l'URL pour refléter le changement d'onglet sans recharger la page
        const url = new URL(window.location.href);
        url.hash = 'video-call';
        window.history.pushState({}, '', url);

        // Utiliser la fonction reloadAppointmentData pour charger les informations du rendez-vous
        reloadAppointmentData(appointmentId);
    }

    // Boutons pour démarrer la consultation depuis l'onglet "All calls"
    const startConsultationButtons = document.querySelectorAll('.start-consultation');

    startConsultationButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();

            // Récupérer l'ID du rendez-vous
            const appointmentId = this.getAttribute('data-appointment-id');

            // Activer l'onglet "Video call" et charger les informations du rendez-vous
            activateVideoCallTab(appointmentId);
        });
    });

    // Fonction pour mettre à jour les détails du patient
    function updatePatientDetails(data) {
        const patientDetails = document.getElementById('patient-details');

        // Vider les détails actuels
        patientDetails.innerHTML = '';

        // Créer les éléments de détail
        const details = [
            { label: 'Genre', value: data.gender || 'Non spécifié' },
            { label: 'Groupe sanguin', value: data.blood_type || 'Non spécifié' },
            { label: 'Spécialité', value: data.specialty || 'Médecine générale' },
            { label: 'Âge', value: data.age || 'Non spécifié' },
            { label: 'Date du rendez-vous', value: data.appointment_date },
            { label: 'ID Patient', value: data.patient_id || 'Non spécifié' }
        ];

        // Ajouter chaque détail
        details.forEach(detail => {
            const detailItem = document.createElement('div');
            detailItem.className = 'patient-detail-item';

            const detailLabel = document.createElement('div');
            detailLabel.className = 'detail-label';
            detailLabel.textContent = detail.label;

            const detailValue = document.createElement('div');
            detailValue.className = 'detail-value';
            detailValue.textContent = detail.value;

            detailItem.appendChild(detailLabel);
            detailItem.appendChild(detailValue);
            patientDetails.appendChild(detailItem);
        });
    }

    // Bouton pour démarrer la consultation vidéo
    const startConsultationBtn = document.getElementById('start-consultation');

    if (startConsultationBtn) {
        startConsultationBtn.addEventListener('click', function() {
            // Initialiser la vidéo consultation
            initializeVideoConsultation();
        });
    }

    // Variables pour WebRTC
    let localStream = null;
    let peerConnection = null;
    let remoteStream = null;
    let isScreenSharing = false;

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

    // Initialiser Socket.IO
    const socket = io();

    // Récupérer l'ID de la salle vidéo
    let roomId = null;

    // Essayer de récupérer l'ID de salle depuis l'élément HTML
    const currentPatientName = document.getElementById('current-patient-name');
    if (currentPatientName && currentPatientName.dataset.roomId) {
        roomId = currentPatientName.dataset.roomId;
        console.log("Room ID trouvé dans l'élément HTML:", roomId);
    } else {
        console.warn("Room ID non trouvé dans l'élément HTML");

        // Essayer de récupérer l'ID de salle depuis l'attribut data-appointment-id du body
        const appointmentId = document.body.getAttribute('data-appointment-id');
        if (appointmentId) {
            console.log('Tentative de récupération de l\'ID de salle depuis l\'API pour le rendez-vous:', appointmentId);
            fetch(`/doctor/get_appointment_data/${appointmentId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.video_room_id) {
                        console.log('ID de salle récupéré depuis l\'API:', data.video_room_id);
                        roomId = data.video_room_id;

                        // Mettre à jour l'attribut data-room-id de l'élément HTML
                        if (currentPatientName) {
                            currentPatientName.dataset.roomId = roomId;
                        }
                    } else {
                        console.error('Aucun ID de salle trouvé dans la réponse API');
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la récupération des données du rendez-vous:', error);
                });
        } else {
            console.error("Aucun ID de rendez-vous trouvé");
        }
    }

    // Fonction pour initialiser la vidéo consultation
    async function initializeVideoConsultation() {
        try {
            console.log('Initialisation de la vidéo consultation...');

            // Vérifier si l'ID de salle est disponible
            if (!roomId) {
                console.warn('ID de salle non disponible, tentative de récupération...');

                // Essayer de récupérer l'ID de salle depuis l'élément HTML (au cas où il aurait été mis à jour)
                const currentPatientNameElement = document.getElementById('current-patient-name');
                if (currentPatientNameElement && currentPatientNameElement.dataset.roomId) {
                    roomId = currentPatientNameElement.dataset.roomId;
                    console.log("Room ID trouvé dans l'élément HTML (mise à jour):", roomId);
                } else {
                    // Essayer de récupérer l'ID de salle depuis l'API
                    const appointmentId = document.body.getAttribute('data-appointment-id');
                    if (appointmentId) {
                        console.log('Tentative de récupération de l\'ID de salle depuis l\'API pour le rendez-vous:', appointmentId);

                        try {
                            const response = await fetch(`/doctor/get_appointment_data/${appointmentId}`);
                            const data = await response.json();

                            if (data.video_room_id) {
                                console.log('ID de salle récupéré depuis l\'API:', data.video_room_id);
                                roomId = data.video_room_id;

                                // Mettre à jour l'attribut data-room-id de l'élément HTML
                                if (currentPatientNameElement) {
                                    currentPatientNameElement.dataset.roomId = roomId;
                                }
                            } else {
                                throw new Error('Aucun ID de salle trouvé dans la réponse API');
                            }
                        } catch (error) {
                            console.error('Erreur lors de la récupération des données du rendez-vous:', error);
                            alert('Erreur: Impossible de récupérer les informations de la salle. Veuillez réessayer.');
                            return;
                        }
                    } else {
                        console.error("Aucun ID de rendez-vous trouvé");
                        alert('Erreur: Aucun rendez-vous sélectionné. Veuillez sélectionner un patient dans l\'onglet "All calls".');
                        return;
                    }
                }
            }

            // Vérifier à nouveau si l'ID de salle est disponible
            if (!roomId) {
                console.error('Impossible de récupérer l\'ID de salle');
                alert('Erreur: Impossible de récupérer l\'ID de salle. Veuillez réessayer.');
                return;
            }

            console.log('ID de salle confirmé:', roomId);

            // Demander l'accès à la caméra et au microphone
            console.log('Demande d\'accès à la caméra et au microphone...');
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('Accès aux périphériques média accordé');

            // Afficher le flux vidéo local
            const doctorVideo = document.getElementById('doctor-video');
            const doctorVideoPlaceholder = document.getElementById('doctor-video-placeholder');

            if (doctorVideo && doctorVideoPlaceholder) {
                doctorVideo.srcObject = localStream;
                doctorVideo.style.display = 'block';
                doctorVideoPlaceholder.style.display = 'none';
                console.log('Flux vidéo local affiché');
            }

            // Activer les contrôles vidéo
            const videoControls = document.querySelectorAll('.video-control-btn');
            videoControls.forEach(control => {
                control.disabled = false;
            });
            console.log('Contrôles vidéo activés');

            // Cacher le bouton de démarrage
            startConsultationBtn.style.display = 'none';

            // Rejoindre la salle
            console.log('Rejoindre la salle:', roomId);
            socket.emit('join_room', { room_id: roomId });

            // Initialiser la connexion WebRTC
            console.log('Initialisation de la connexion WebRTC...');
            initializePeerConnection();

            // Attendre un court instant pour s'assurer que la connexion à la salle est établie
            console.log('Attente avant création de l\'offre WebRTC...');
            setTimeout(() => {
                console.log('Création de l\'offre WebRTC...');
                createOffer();
            }, 1000);

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
        const patientVideo = document.getElementById('patient-video');
        if (patientVideo) {
            patientVideo.srcObject = remoteStream;
            patientVideo.style.display = 'block';
        }

        // Masquer le placeholder du patient
        const patientVideoPlaceholder = document.getElementById('patient-video-placeholder');
        if (patientVideoPlaceholder) {
            patientVideoPlaceholder.innerHTML = '<p>Connexion en cours...</p>';
        }

        // Écouter les pistes entrantes
        peerConnection.ontrack = (event) => {
            console.log('Piste reçue:', event);

            // Masquer complètement le placeholder
            if (patientVideoPlaceholder) {
                patientVideoPlaceholder.style.display = 'none';
            }

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

                // Mettre à jour l'interface
                if (patientVideoPlaceholder) {
                    patientVideoPlaceholder.style.display = 'flex';
                    patientVideoPlaceholder.innerHTML = '<p>La connexion a échoué. Veuillez réessayer.</p>';
                }
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

    // Écouter l'événement de connexion à la salle
    socket.on('user_joined', (data) => {
        console.log('Utilisateur rejoint la salle:', data);

        // Si c'est le patient qui a rejoint, mettre à jour l'interface
        if (data.user_role === 'patient') {
            const patientVideoPlaceholder = document.getElementById('patient-video-placeholder');
            if (patientVideoPlaceholder) {
                patientVideoPlaceholder.querySelector('p').textContent = `${data.user_name} a rejoint la salle. En attente de la connexion vidéo...`;
            }
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
                        const doctorVideo = document.getElementById('doctor-video');
                        const doctorVideoPlaceholder = document.getElementById('doctor-video-placeholder');

                        if (doctorVideo && doctorVideoPlaceholder) {
                            doctorVideo.srcObject = localStream;
                            doctorVideo.style.display = 'block';
                            doctorVideoPlaceholder.style.display = 'none';
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

            // Mettre à jour l'interface pour indiquer que la connexion est établie
            const patientVideoPlaceholder = document.getElementById('patient-video-placeholder');
            if (patientVideoPlaceholder) {
                patientVideoPlaceholder.querySelector('p').textContent = 'Connexion établie. En attente du flux vidéo...';
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

    // Variable pour stocker les candidats ICE en attente
    let pendingCandidates = [];

    // Contrôles vidéo
    const videoControlButtons = document.querySelectorAll('.video-control-btn');

    videoControlButtons.forEach(button => {
        button.addEventListener('click', function() {
            const icon = this.querySelector('i');

            if (icon.classList.contains('fa-microphone')) {
                icon.classList.toggle('fa-microphone');
                icon.classList.toggle('fa-microphone-slash');

                // Couper/activer le microphone
                const doctorVideo = document.getElementById('doctor-video');
                if (doctorVideo && doctorVideo.srcObject) {
                    const audioTrack = doctorVideo.srcObject.getAudioTracks()[0];
                    if (audioTrack) {
                        audioTrack.enabled = !audioTrack.enabled;
                    }
                }

            } else if (icon.classList.contains('fa-video')) {
                icon.classList.toggle('fa-video');
                icon.classList.toggle('fa-video-slash');

                // Couper/activer la caméra
                const doctorVideo = document.getElementById('doctor-video');
                if (doctorVideo && doctorVideo.srcObject) {
                    const videoTrack = doctorVideo.srcObject.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.enabled = !videoTrack.enabled;
                    }
                }

            } else if (icon.classList.contains('fa-desktop')) {
                // Toggle screen sharing
                this.classList.toggle('active');

                // Implémenter le partage d'écran
                toggleScreenSharing(this.classList.contains('active'));

            } else if (icon.classList.contains('fa-phone-slash')) {
                // End call
                if (confirm('Êtes-vous sûr de vouloir terminer la consultation ?')) {
                    endVideoConsultation();
                }
            }
        });
    });

    // Fonction pour activer/désactiver le partage d'écran
    async function toggleScreenSharing(isActive) {
        const doctorVideo = document.getElementById('doctor-video');

        if (isActive) {
            try {
                // Demander l'accès à l'écran
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                // Sauvegarder le flux de la caméra
                const cameraStream = doctorVideo.srcObject;
                doctorVideo.setAttribute('data-camera-stream', cameraStream);

                // Afficher le flux de l'écran
                doctorVideo.srcObject = screenStream;

                // Écouter la fin du partage d'écran
                screenStream.getVideoTracks()[0].onended = () => {
                    const toggleScreenBtn = document.getElementById('toggle-screen');
                    if (toggleScreenBtn) {
                        toggleScreenBtn.classList.remove('active');
                    }

                    // Restaurer le flux de la caméra
                    doctorVideo.srcObject = doctorVideo.getAttribute('data-camera-stream');
                };

            } catch (error) {
                console.error('Erreur lors du partage d\'écran:', error);
                alert('Impossible de partager l\'écran. Veuillez réessayer.');

                // Réinitialiser le bouton
                const toggleScreenBtn = document.getElementById('toggle-screen');
                if (toggleScreenBtn) {
                    toggleScreenBtn.classList.remove('active');
                }
            }
        } else {
            // Restaurer le flux de la caméra
            const cameraStream = doctorVideo.getAttribute('data-camera-stream');
            if (cameraStream) {
                doctorVideo.srcObject = cameraStream;
            }
        }
    }

    // Fonction pour terminer la consultation vidéo
    function endVideoConsultation() {
        // Arrêter les flux média
        const doctorVideo = document.getElementById('doctor-video');
        if (doctorVideo && doctorVideo.srcObject) {
            doctorVideo.srcObject.getTracks().forEach(track => track.stop());
            doctorVideo.srcObject = null;
            doctorVideo.style.display = 'none';
        }

        // Afficher le placeholder
        const doctorVideoPlaceholder = document.getElementById('doctor-video-placeholder');
        if (doctorVideoPlaceholder) {
            doctorVideoPlaceholder.style.display = 'block';
        }

        // Réinitialiser les contrôles vidéo
        const videoControls = document.querySelectorAll('.video-control-btn');
        videoControls.forEach(control => {
            const icon = control.querySelector('i');
            if (icon.classList.contains('fa-microphone-slash')) {
                icon.classList.remove('fa-microphone-slash');
                icon.classList.add('fa-microphone');
            } else if (icon.classList.contains('fa-video-slash')) {
                icon.classList.remove('fa-video-slash');
                icon.classList.add('fa-video');
            }
            control.classList.remove('active');
        });

        // Afficher le bouton de démarrage
        const startConsultationBtn = document.getElementById('start-consultation');
        if (startConsultationBtn) {
            startConsultationBtn.style.display = 'inline-block';
        }

        // Rediriger vers l'onglet "All calls"
        const allCallsTab = document.querySelector('.tab-item[data-tab="all-calls"]');
        if (allCallsTab) {
            allCallsTab.click();
        }
    }

    // Fonctionnalité de chat en temps réel
    const chatInput = document.getElementById('chat-input');
    const sendMessageBtn = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');
    const highPriorityCheckbox = document.getElementById('high-priority');

    if (sendMessageBtn && chatInput) {
        sendMessageBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // Fonction pour envoyer un message de chat
    function sendChatMessage() {
        const message = chatInput.value.trim();
        const isUrgent = highPriorityCheckbox && highPriorityCheckbox.checked;
        const roomId = document.getElementById('current-patient-name')?.dataset.roomId;

        if (message && roomId) {
            // Envoyer le message via Socket.IO
            socket.emit('send_message', {
                room_id: roomId,
                content: message,
                is_urgent: isUrgent
            });

            // Ajouter le message à l'interface
            addChatMessage({
                sender_id: 'me',
                sender_name: 'Vous',
                content: message,
                is_urgent: isUrgent,
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });

            // Vider le champ de saisie et réinitialiser la case à cocher
            chatInput.value = '';
            if (highPriorityCheckbox) {
                highPriorityCheckbox.checked = false;
            }
        }
    }

    // Fonction pour ajouter un message au chat
    function addChatMessage(message) {
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';

        // Déterminer si le message est envoyé ou reçu
        if (message.sender_id === 'me') {
            messageElement.classList.add('sent');
        } else {
            messageElement.classList.add('received');

            // Ajouter le nom de l'expéditeur pour les messages reçus
            const senderElement = document.createElement('div');
            senderElement.className = 'message-sender';
            senderElement.textContent = message.sender_name;
            messageElement.appendChild(senderElement);
        }

        // Ajouter la classe urgent si nécessaire
        if (message.is_urgent) {
            messageElement.classList.add('urgent');
        }

        // Contenu du message
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.innerHTML = message.content.replace(/\n/g, '<br>');
        messageElement.appendChild(contentElement);

        // Horodatage
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = message.timestamp;
        messageElement.appendChild(timeElement);

        // Ajouter le message au conteneur
        chatMessages.appendChild(messageElement);

        // Faire défiler vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Écouter les nouveaux messages
    socket.on('new_message', function(data) {
        console.log('Nouveau message reçu:', data);
        addChatMessage(data);
    });

    // Fonctionnalité d'onglets pour les notes et prescriptions
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.consultation-content .tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');

            // Supprimer la classe active de tous les boutons et panneaux
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Ajouter la classe active au bouton et au panneau cliqués
            this.classList.add('active');
            document.getElementById(tabId + '-tab').classList.add('active');
        });
    });

    // Fonctionnalité de sauvegarde des notes
    const saveNotesBtn = document.getElementById('save-notes-btn');
    const notesTextarea = document.getElementById('consultation-notes');
    const notesStatus = document.getElementById('notes-status');

    if (saveNotesBtn && notesTextarea) {
        saveNotesBtn.addEventListener('click', function() {
            const notes = notesTextarea.value.trim();
            const appointmentId = document.body.getAttribute('data-appointment-id');

            if (appointmentId) {
                // Désactiver le bouton pendant la sauvegarde
                saveNotesBtn.disabled = true;
                saveNotesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';

                // Envoyer les notes au serveur
                fetch(`/doctor/save_notes/${appointmentId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `notes=${encodeURIComponent(notes)}`
                })
                .then(response => {
                    if (response.ok) {
                        if (notesStatus) {
                            notesStatus.textContent = 'Notes enregistrées avec succès';
                            setTimeout(() => {
                                notesStatus.textContent = '';
                            }, 3000);
                        }
                    } else {
                        throw new Error('Erreur lors de la sauvegarde des notes');
                    }
                })
                .catch(error => {
                    console.error('Erreur:', error);
                    if (notesStatus) {
                        notesStatus.textContent = 'Erreur lors de la sauvegarde';
                        notesStatus.style.color = '#e74c3c';
                        setTimeout(() => {
                            notesStatus.textContent = '';
                            notesStatus.style.color = '';
                        }, 3000);
                    }
                })
                .finally(() => {
                    // Réactiver le bouton
                    saveNotesBtn.disabled = false;
                    saveNotesBtn.innerHTML = 'Enregistrer les notes';
                });
            }
        });
    }

    // Fonctionnalité de sauvegarde des prescriptions
    const savePrescriptionBtn = document.getElementById('save-prescription-btn');
    const prescriptionTextarea = document.getElementById('prescription-content');
    const prescriptionStatus = document.getElementById('prescription-status');

    if (savePrescriptionBtn && prescriptionTextarea) {
        savePrescriptionBtn.addEventListener('click', function() {
            const content = prescriptionTextarea.value.trim();
            const appointmentId = document.body.getAttribute('data-appointment-id');

            if (appointmentId && content) {
                // Désactiver le bouton pendant la sauvegarde
                savePrescriptionBtn.disabled = true;
                savePrescriptionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';

                // Envoyer la prescription au serveur
                fetch(`/doctor/save_prescription/${appointmentId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `content=${encodeURIComponent(content)}`
                })
                .then(response => {
                    if (response.ok) {
                        if (prescriptionStatus) {
                            prescriptionStatus.textContent = 'Prescription enregistrée avec succès';
                            setTimeout(() => {
                                prescriptionStatus.textContent = '';
                            }, 3000);
                        }
                    } else {
                        throw new Error('Erreur lors de la sauvegarde de la prescription');
                    }
                })
                .catch(error => {
                    console.error('Erreur:', error);
                    if (prescriptionStatus) {
                        prescriptionStatus.textContent = 'Erreur lors de la sauvegarde';
                        prescriptionStatus.style.color = '#e74c3c';
                        setTimeout(() => {
                            prescriptionStatus.textContent = '';
                            prescriptionStatus.style.color = '';
                        }, 3000);
                    }
                })
                .finally(() => {
                    // Réactiver le bouton
                    savePrescriptionBtn.disabled = false;
                    savePrescriptionBtn.innerHTML = 'Enregistrer la prescription';
                });
            }
        });
    }

    // Fonctionnalité de tri pour le tableau d'historique
    const sortableHeaders = document.querySelectorAll('.history-table th i.fa-sort');

    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const th = this.parentElement;
            const table = th.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Get the index of the column
            const index = Array.from(th.parentElement.children).indexOf(th);

            // Sort the rows
            rows.sort((a, b) => {
                const aValue = a.children[index].textContent.trim();
                const bValue = b.children[index].textContent.trim();

                return aValue.localeCompare(bValue);
            });

            // Toggle sort direction
            if (this.classList.contains('fa-sort-up')) {
                this.classList.remove('fa-sort-up');
                this.classList.add('fa-sort-down');
                rows.reverse();
            } else {
                this.classList.remove('fa-sort-down');
                this.classList.add('fa-sort-up');
            }

            // Remove all rows
            rows.forEach(row => tbody.removeChild(row));

            // Append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        });
    });

    // Fonctionnalité de recherche
    const searchInput = document.querySelector('.search-box input');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const messages = document.querySelectorAll('.chat-messages .message p');

            messages.forEach(message => {
                const text = message.textContent.toLowerCase();
                const messageElement = message.closest('.message');

                if (text.includes(searchTerm) || searchTerm === '') {
                    messageElement.style.display = 'block';
                } else {
                    messageElement.style.display = 'none';
                }
            });
        });
    }

    // Fonctionnalité "read more"
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('read-more')) {
            e.preventDefault();
            const message = e.target.closest('.message');
            const messageContent = message.querySelector('p');

            messageContent.classList.toggle('expanded');
            e.target.textContent = messageContent.classList.contains('expanded') ? 'read less' : 'read more';
        }
    });

    // Fonctionnalité de planification de rendez-vous
    const scheduleBtn = document.querySelector('.schedule-btn');

    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', function() {
            // Récupérer l'ID du patient depuis l'URL ou un attribut data
            const patientId = document.body.getAttribute('data-patient-id');
            if (patientId) {
                window.location.href = `/doctor/schedule_appointment/${patientId}`;
            } else {
                // Vérifier si nous avons un rendez-vous actuel
                const currentAppointmentElement = document.querySelector('.patient-name');
                if (currentAppointmentElement && currentAppointmentElement.dataset.patientId) {
                    window.location.href = `/doctor/schedule_appointment/${currentAppointmentElement.dataset.patientId}`;
                } else {
                    alert('Veuillez sélectionner un patient pour planifier un rendez-vous.');
                }
            }
        });
    }

    // Fonctionnalité de filtrage pour l'historique des traitements
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', function() {
            alert('La fonctionnalité de filtrage sera implémentée dans une future mise à jour.');
        });
    }

    // Fonctionnalité de téléchargement de la fiche médicale
    const downloadBtn = document.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            alert('La fonctionnalité de téléchargement de la fiche médicale sera implémentée dans une future mise à jour.');
        });
    }

    // Rendre le tableau responsive
    function adjustTableForScreenSize() {
        const historyTable = document.querySelector('.history-table');
        if (historyTable) {
            if (window.innerWidth < 768) {
                // Pour les petits écrans, ajouter un indicateur de défilement horizontal
                historyTable.classList.add('scroll-indicator');
            } else {
                historyTable.classList.remove('scroll-indicator');
            }
        }
    }

    // Appeler au chargement et au redimensionnement
    adjustTableForScreenSize();
    window.addEventListener('resize', adjustTableForScreenSize);
});
