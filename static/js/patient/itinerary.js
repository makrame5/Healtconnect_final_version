// Variables globales
let facilityMarkers = [];
let userPosition = null;

// Note: La fonction initMap est maintenant définie dans le template HTML
// pour éviter les erreurs liées à l'API Google Maps manquante

// Obtenir la position de l'utilisateur
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                console.log("Position utilisateur obtenue:", userPosition);

                // Mettre à jour les établissements à proximité
                loadFacilities();
            },
            (error) => {
                console.error('Erreur de géolocalisation:', error);
                // Afficher un message d'erreur
                showLocationError(error);
            }
        );
    } else {
        console.error('La géolocalisation n\'est pas prise en charge par ce navigateur.');
        // Afficher un message d'erreur
        showLocationError({ code: 0 });
    }
}

// Afficher une erreur de géolocalisation
function showLocationError(error) {
    let errorMessage = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'L\'accès à la géolocalisation a été refusé.';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'Les informations de localisation ne sont pas disponibles.';
            break;
        case error.TIMEOUT:
            errorMessage = 'La demande de géolocalisation a expiré.';
            break;
        default:
            errorMessage = 'Une erreur inconnue s\'est produite lors de la géolocalisation.';
            break;
    }

    // Afficher un message à l'utilisateur
    alert(errorMessage + ' Nous utilisons une position par défaut.');
}

// Initialiser les événements
function initEvents() {
    // Slider de distance
    const distanceSlider = document.getElementById('distance-slider');

    // Mettre à jour la position du curseur du slider
    distanceSlider.addEventListener('input', function() {
        const value = this.value;
        const max = this.max;
        const percentage = (value / max) * 100;
        document.querySelector('.slider-thumb').style.left = `${percentage}%`;
    });

    // Boutons d'itinéraire
    document.querySelectorAll('.btn-itinerary').forEach(button => {
        button.addEventListener('click', function() {
            const facilityId = this.getAttribute('data-id');
            showItinerary(facilityId);
        });
    });

    // Fermeture des modals
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    // Fermer les modals en cliquant en dehors
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal(this);
            }
        });
    });

    // Filtres de type d'établissement
    document.querySelectorAll('input[name="type"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            applyFilters();
        });
    });

    // Filtres de services
    document.querySelectorAll('input[name="service"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            applyFilters();
        });
    });

    // Slider de distance (changement de valeur)
    distanceSlider.addEventListener('change', function() {
        applyFilters();
    });
}

// Appliquer les filtres
function applyFilters() {
    // Récupérer les valeurs des filtres
    const typeFilters = Array.from(document.querySelectorAll('input[name="type"]:checked')).map(input => input.value);
    const serviceFilters = Array.from(document.querySelectorAll('input[name="service"]:checked')).map(input => input.value);
    const distanceFilter = parseInt(document.getElementById('distance-slider').value);

    // Filtrer les établissements (simulé)
    loadFacilities(typeFilters, serviceFilters, distanceFilter);
}

// Charger les établissements (simulé)
function loadFacilities(typeFilters = ['hospital', 'pharmacy', 'clinic'], serviceFilters = [], distanceFilter = 5) {
    // Effacer les marqueurs existants
    clearMarkers();

    // Données simulées d'établissements
    const facilities = [
        {
            id: 'hospital1',
            name: 'Hôpital Universitaire',
            type: 'hospital',
            position: { lat: 48.8566, lng: 2.3522 },
            address: '123 Avenue de la Santé, 75001 Paris',
            distance: 1.2,
            services: ['emergency', '24h'],
            phone: '01 23 45 67 89',
            website: 'https://hopital-universitaire.fr',
            hours: '24h/24, 7j/7'
        },
        {
            id: 'pharmacy1',
            name: 'Pharmacie Centrale',
            type: 'pharmacy',
            position: { lat: 48.8606, lng: 2.3376 },
            address: '45 Rue des Médicaments, 75001 Paris',
            distance: 0.8,
            services: ['guard'],
            phone: '01 23 45 67 90',
            website: 'https://pharmacie-centrale.fr',
            hours: 'Lun-Sam: 8h30-20h, Dim: 10h-19h'
        },
        {
            id: 'clinic1',
            name: 'Clinique Saint-Louis',
            type: 'clinic',
            position: { lat: 48.8656, lng: 2.3412 },
            address: '78 Boulevard des Soins, 75001 Paris',
            distance: 1.5,
            services: [],
            phone: '01 23 45 67 91',
            website: 'https://clinique-saint-louis.fr',
            hours: 'Lun-Ven: 8h-19h, Sam: 9h-17h'
        }
    ];

    // Filtrer les établissements
    const filteredFacilities = facilities.filter(facility => {
        // Filtrer par type
        if (!typeFilters.includes(facility.type)) {
            return false;
        }

        // Filtrer par service
        if (serviceFilters.length > 0 && !facility.services.some(service => serviceFilters.includes(service))) {
            return false;
        }

        // Filtrer par distance
        if (facility.distance > distanceFilter) {
            return false;
        }

        return true;
    });

    // Ajouter les marqueurs pour chaque établissement
    filteredFacilities.forEach(facility => {
        addFacilityMarker(facility);
    });

    // Mettre à jour la liste des résultats
    updateResultsList(filteredFacilities);
}

// Ajouter un marqueur pour un établissement (version simulée sans Google Maps)
function addFacilityMarker(facility) {
    // Stocker l'établissement sans créer de marqueur réel
    facilityMarkers.push({
        id: facility.id,
        marker: null, // Pas de marqueur réel
        facility: facility
    });
}

// Effacer tous les marqueurs (version simulée sans Google Maps)
function clearMarkers() {
    // Simplement vider le tableau
    facilityMarkers = [];
}

// Mettre à jour la liste des résultats
function updateResultsList(facilities) {
    const establishmentList = document.querySelector('.establishment-list');

    // Si aucun résultat
    if (facilities.length === 0) {
        establishmentList.innerHTML = '<div class="no-results">Aucun établissement ne correspond à vos critères.</div>';
        return;
    }

    // Vider la liste
    establishmentList.innerHTML = '';

    // Ajouter chaque établissement
    facilities.forEach(facility => {
        establishmentList.innerHTML += `
            <div class="establishment-card">
                <div class="establishment-icon ${facility.type}">
                    <i class="fas fa-${facility.type === 'hospital' ? 'hospital' : facility.type === 'pharmacy' ? 'prescription-bottle-medical' : 'stethoscope'}"></i>
                </div>
                <div class="establishment-info">
                    <h3>${facility.name}</h3>
                    <p>${facility.address}</p>
                </div>
                <button class="btn-itinerary" data-id="${facility.id}">
                    <i class="fas fa-directions"></i> Itinéraire
                </button>
            </div>
        `;
    });

    // Réinitialiser les événements
    document.querySelectorAll('.btn-itinerary').forEach(button => {
        button.addEventListener('click', function() {
            const facilityId = this.getAttribute('data-id');
            showItinerary(facilityId);
        });
    });
}

// Afficher les détails d'un établissement
function showFacilityDetails(facilityId) {
    // Trouver l'établissement
    const facilityItem = facilityMarkers.find(item => item.id === facilityId);
    if (!facilityItem) return;

    const facility = facilityItem.facility;

    // Remplir le modal
    document.getElementById('modal-facility-name').textContent = facility.name;
    document.getElementById('modal-facility-address').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${facility.address}`;
    document.getElementById('modal-facility-phone').innerHTML = `<i class="fas fa-phone"></i> ${facility.phone}`;
    document.getElementById('modal-facility-hours').innerHTML = `<i class="fas fa-clock"></i> ${facility.hours}`;

    // Services
    const servicesContainer = document.getElementById('modal-facility-services');
    servicesContainer.innerHTML = '';

    if (facility.services.length > 0) {
        facility.services.forEach(service => {
            let serviceLabel = '';
            let serviceClass = '';

            switch (service) {
                case 'emergency':
                    serviceLabel = 'Urgences';
                    serviceClass = 'emergency';
                    break;
                case '24h':
                    serviceLabel = '24h/24';
                    serviceClass = 'h24';
                    break;
                case 'guard':
                    serviceLabel = 'De garde';
                    serviceClass = 'guard';
                    break;
                default:
                    serviceLabel = service;
                    serviceClass = '';
            }

            servicesContainer.innerHTML += `<span class="service-tag ${serviceClass}">${serviceLabel}</span>`;
        });
    } else {
        servicesContainer.innerHTML = '<span class="no-services">Aucun service spécifique</span>';
    }

    // Bouton d'itinéraire
    document.getElementById('modal-btn-itinerary').setAttribute('data-facility-id', facilityId);

    // Bouton d'appel
    document.getElementById('modal-btn-call').onclick = function() {
        window.location.href = `tel:${facility.phone.replace(/\s/g, '')}`;
    };

    // Bouton de site web
    document.getElementById('modal-btn-website').onclick = function() {
        window.open(facility.website, '_blank');
    };

    // Afficher le modal
    openModal(document.getElementById('facility-details-modal'));
}

// Afficher l'itinéraire vers un établissement (version simulée sans Google Maps)
function showItinerary(facilityId) {
    // Trouver l'établissement
    const facilityItem = facilityMarkers.find(item => item.id === facilityId);
    if (!facilityItem) return;

    const facility = facilityItem.facility;

    // Remplir le modal
    document.getElementById('destination-name').textContent = facility.name;
    document.getElementById('itinerary-distance').textContent = `${facility.distance} km`;
    document.getElementById('itinerary-time').textContent = `10 min en voiture (simulé)`;

    // Afficher le modal
    openModal(document.getElementById('itinerary-modal'));

    // Créer une carte simulée
    const mapElement = document.getElementById('itinerary-map');
    if (mapElement) {
        mapElement.innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; background-color: #e9ecef;">
                <i class="fas fa-route" style="font-size: 3rem; color: #2471A3; margin-bottom: 15px;"></i>
                <p style="text-align: center; padding: 0 20px;">Itinéraire vers ${facility.name}<br>Distance: ${facility.distance} km</p>
            </div>
        `;
    }

    // Simuler les étapes de l'itinéraire
    const steps = [
        { instruction: "Prenez la rue des Médicaments en direction du nord", distance: { text: "300 m" } },
        { instruction: "Tournez à droite sur l'Avenue de la Santé", distance: { text: "1.2 km" } },
        { instruction: "Votre destination se trouve sur la droite", distance: { text: "50 m" } }
    ];

    // Mettre à jour les étapes
    updateRouteSteps(steps);
}

// Cette fonction a été supprimée car elle dépendait de l'API Google Maps
// Fonction de remplacement simplifiée pour la simulation
function calculateRoute() {
    console.log("Calcul d'itinéraire simulé");
}

// Mettre à jour les étapes de l'itinéraire
function updateRouteSteps(steps) {
    const stepsList = document.querySelector('.itinerary-steps');
    stepsList.innerHTML = '';

    steps.forEach((step, index) => {
        // Nettoyer les instructions HTML
        const instruction = step.instructions.replace(/<[^>]*>/g, '');

        stepsList.innerHTML += `
            <div class="step">
                <div class="step-number">${index + 1}</div>
                <div class="step-instruction">
                    ${instruction}
                </div>
                <div class="step-distance">
                    ${step.distance.text}
                </div>
            </div>
        `;
    });
}

// Définir le mode de transport (version simplifiée)
function setTransportMode(mode) {
    // Mettre à jour l'apparence des boutons
    document.querySelectorAll('.transport-mode').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`.transport-mode[data-mode="${mode}"]`).classList.add('active');

    // Simuler un changement de mode de transport
    const modeText = mode === 'driving' ? 'voiture' : mode === 'walking' ? 'marchant' : mode === 'bicycling' ? 'vélo' : 'transport';
    document.getElementById('itinerary-time').textContent = `10 min en ${modeText} (simulé)`;
}

// Ouvrir un modal
function openModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Fermer un modal
function closeModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Exposer les fonctions au contexte global pour les appels depuis le HTML
window.showFacilityDetails = showFacilityDetails;
window.showItinerary = showItinerary;
// Note: initMap est maintenant défini dans le template HTML
