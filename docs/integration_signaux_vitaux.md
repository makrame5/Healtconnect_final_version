# Guide d'intégration des signaux vitaux dans HealthConnect

Ce document explique comment intégrer des moniteurs multi-paramètres pour capturer les signaux vitaux des patients en temps réel dans la plateforme HealthConnect.

## Architecture

L'architecture mise en place pour les signaux vitaux comprend les éléments suivants :

1. **Base de données** : Modèles pour stocker les capteurs, les signaux vitaux et les seuils personnalisés.
2. **Interface utilisateur** : Pages pour afficher les signaux vitaux en temps réel et l'historique des mesures.
3. **API REST** : Endpoints pour interagir avec les signaux vitaux.
4. **MQTT** : Broker pour publier et recevoir des signaux vitaux en temps réel.
5. **Socket.IO** : Communication en temps réel entre le serveur et les clients.

## Modèles de données

Trois nouveaux modèles ont été ajoutés à la base de données :

1. **Sensor** : Représente un capteur physique connecté à la plateforme.
2. **VitalSign** : Représente une mesure de signal vital.
3. **VitalSignThreshold** : Représente les seuils personnalisés pour chaque type de signal vital.

## Interface utilisateur

Trois interfaces ont été créées pour afficher les signaux vitaux :

1. **Guide des capteurs** : Page accessible via la sidebar dans le dashboard patient, qui affiche les signaux vitaux en temps réel.
2. **Profil patient** : Section "Signaux Vitaux" dans le profil patient, qui affiche l'historique des mesures.
3. **Consultation vidéo** : Section dans la page de consultation vidéo, qui affiche les signaux vitaux en temps réel pendant la consultation.

## API REST

Une API REST a été créée pour interagir avec les signaux vitaux. Les endpoints sont les suivants :

- `GET /api/vital-signs/latest` : Récupère les dernières mesures de signaux vitaux.
- `GET /api/vital-signs/history` : Récupère l'historique des mesures de signaux vitaux.
- `GET /api/vital-signs/thresholds` : Récupère les seuils personnalisés.
- `POST /api/vital-signs/thresholds` : Met à jour les seuils personnalisés.
- `GET /api/vital-signs/sensors` : Récupère les capteurs du patient.
- `POST /api/vital-signs/publish` : Publie un signal vital.
- `POST /api/vital-signs/simulate` : Simule des signaux vitaux.

Pour plus de détails, consultez la documentation de l'API dans le fichier `static/docs/vital_signs_api.md`.

## MQTT

Un handler MQTT a été créé pour publier et recevoir des signaux vitaux en temps réel. Le topic à utiliser est :

```
healthconnect/vitals/{patient_id}/{type}
```

Où :
- `{patient_id}` est l'ID du patient
- `{type}` est le type de signal vital (`heartrate`, `blood_pressure`, `temperature`, `oxygen`)

## Socket.IO

Les signaux vitaux sont également émis via Socket.IO. Les événements à écouter sont :

- `vital_sign_update` : Émis lorsqu'un signal vital est mis à jour
- `vital_sign_to_doctor` : Émis lorsqu'un signal vital est envoyé au médecin pendant une consultation

## Comment intégrer des moniteurs multi-paramètres

### 1. Utiliser l'API REST

Vous pouvez utiliser l'API REST pour publier des signaux vitaux. Voici un exemple avec Python :

```python
import requests
import json

# Configuration
base_url = "http://localhost:5000/api/vital-signs"
session = requests.Session()

# Connexion (à faire au préalable)
session.post("http://localhost:5000/login", data={
    "email": "patient@example.com",
    "password": "password"
})

# Publier un signal vital
response = session.post(f"{base_url}/publish", json={
    "type": "heartrate",
    "value": "72",
    "unit": "bpm",
    "appointment_id": 1  # Optionnel, pour les consultations
})
result = response.json()
print("Publication:", json.dumps(result, indent=2))
```

### 2. Utiliser MQTT

Vous pouvez utiliser MQTT pour publier des signaux vitaux. Voici un exemple avec Python et Paho MQTT :

```python
import paho.mqtt.client as mqtt
import json
import time

# Configuration
broker_url = "localhost"
broker_port = 1883
patient_id = 1

# Créer un client MQTT
client = mqtt.Client()

# Se connecter au broker
client.connect(broker_url, broker_port, 60)

# Publier un signal vital
topic = f"healthconnect/vitals/{patient_id}/heartrate"
payload = {
    "value": "72",
    "unit": "bpm",
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "appointment_id": 1  # Optionnel, pour les consultations
}
client.publish(topic, json.dumps(payload))

# Se déconnecter
client.disconnect()
```

### 3. Utiliser Socket.IO

Vous pouvez utiliser Socket.IO pour émettre des signaux vitaux. Voici un exemple avec Python et python-socketio :

```python
import socketio
import time

# Créer un client Socket.IO
sio = socketio.Client()

# Se connecter au serveur
sio.connect('http://localhost:5000')

# Émettre un signal vital
sio.emit('vital_sign_update', {
    'patient_id': 1,
    'type': 'heartrate',
    'value': '72',
    'unit': 'bpm',
    'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S"),
    'is_abnormal': False,
    'appointment_id': 1  # Optionnel, pour les consultations
})

# Se déconnecter
sio.disconnect()
```

## Simulation de signaux vitaux

Pour tester l'intégration sans avoir de capteurs physiques, vous pouvez utiliser l'endpoint de simulation :

```python
import requests
import json

# Configuration
base_url = "http://localhost:5000/api/vital-signs"
session = requests.Session()

# Connexion (à faire au préalable)
session.post("http://localhost:5000/login", data={
    "email": "patient@example.com",
    "password": "password"
})

# Simuler des signaux vitaux
response = session.post(f"{base_url}/simulate", json={
    "duration": 60,  # Durée en secondes
    "interval": 5,   # Intervalle en secondes
    "types": ["heartrate", "blood_pressure", "temperature", "oxygen"],
    "appointment_id": 1  # Optionnel, pour les consultations
})
result = response.json()
print("Simulation:", json.dumps(result, indent=2))
```

## Fichiers importants

- `models.py` : Modèles de données pour les signaux vitaux
- `routes/api_vital_signs.py` : API REST pour les signaux vitaux
- `mqtt_handler.py` : Handler MQTT pour les signaux vitaux
- `socket_events.py` : Événements Socket.IO pour les signaux vitaux
- `static/js/patient/vital_signs.js` : JavaScript pour afficher les signaux vitaux dans le profil patient
- `static/js/patient/sensor_guide.js` : JavaScript pour afficher les signaux vitaux dans le guide des capteurs
- `static/js/patient/vital_signs_consultation.js` : JavaScript pour afficher les signaux vitaux pendant la consultation
- `static/css/patient/vital_signs.css` : CSS pour les signaux vitaux
- `templates/patient/sensor_guide.html` : Template pour le guide des capteurs
- `static/docs/vital_signs_api.md` : Documentation de l'API des signaux vitaux

## Prochaines étapes

1. **Intégrer les capteurs physiques** : Connecter les moniteurs multi-paramètres à la plateforme en utilisant l'API REST, MQTT ou Socket.IO.
2. **Améliorer l'interface utilisateur** : Personnaliser l'affichage des signaux vitaux en fonction des besoins spécifiques.
3. **Ajouter des alertes** : Configurer des alertes pour les valeurs anormales.
4. **Ajouter des graphiques avancés** : Améliorer les graphiques pour afficher des tendances et des analyses plus détaillées.
5. **Intégrer avec d'autres systèmes** : Connecter la plateforme à d'autres systèmes de santé pour échanger des données de signaux vitaux.

## Conclusion

L'infrastructure pour les signaux vitaux est maintenant en place et prête à être utilisée. Vous pouvez commencer à intégrer des moniteurs multi-paramètres en utilisant l'API REST, MQTT ou Socket.IO. Si vous avez des questions ou des problèmes, n'hésitez pas à me contacter.
