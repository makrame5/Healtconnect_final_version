# API des Signaux Vitaux - Documentation

Cette API permet d'interagir avec les signaux vitaux des patients dans l'application HealthConnect. Elle est conçue pour être utilisée par les développeurs qui souhaitent intégrer des capteurs de signaux vitaux à la plateforme.

## Base URL

Toutes les routes de l'API sont préfixées par `/api/vital-signs`.

## Authentification

Toutes les routes de l'API nécessitent une authentification. L'utilisateur doit être connecté et avoir le rôle de patient.

## Endpoints

### Récupérer les dernières mesures

```
GET /api/vital-signs/latest
```

Récupère les dernières mesures de signaux vitaux pour le patient connecté.

#### Réponse

```json
{
  "heartrate": {
    "id": 1,
    "value": "72",
    "unit": "bpm",
    "timestamp": "2023-04-30T12:34:56",
    "is_abnormal": false
  },
  "blood_pressure": {
    "id": 2,
    "value": "120/80",
    "unit": "mmHg",
    "timestamp": "2023-04-30T12:34:56",
    "is_abnormal": false
  },
  "temperature": {
    "id": 3,
    "value": "36.8",
    "unit": "°C",
    "timestamp": "2023-04-30T12:34:56",
    "is_abnormal": false
  },
  "oxygen": {
    "id": 4,
    "value": "98",
    "unit": "%",
    "timestamp": "2023-04-30T12:34:56",
    "is_abnormal": false
  }
}
```

### Récupérer l'historique des mesures

```
GET /api/vital-signs/history?type=heartrate&period=day
```

Récupère l'historique des mesures de signaux vitaux pour le patient connecté.

#### Paramètres

- `type` (optionnel) : Type de signal vital à récupérer. Valeurs possibles : `heartrate`, `blood_pressure`, `temperature`, `oxygen`. Par défaut : `heartrate`.
- `period` (optionnel) : Période de temps à récupérer. Valeurs possibles : `day`, `week`, `month`, `year`. Par défaut : `day`.

#### Réponse

```json
[
  {
    "id": 1,
    "value": "72",
    "unit": "bpm",
    "timestamp": "2023-04-30T12:34:56",
    "is_abnormal": false
  },
  {
    "id": 2,
    "value": "75",
    "unit": "bpm",
    "timestamp": "2023-04-30T12:35:56",
    "is_abnormal": false
  }
]
```

### Récupérer les seuils personnalisés

```
GET /api/vital-signs/thresholds
```

Récupère les seuils personnalisés pour le patient connecté.

#### Réponse

```json
{
  "heartrate": {
    "id": 1,
    "min_value": 60,
    "max_value": 100,
    "unit": "bpm"
  },
  "blood_pressure": {
    "id": 2,
    "min_value": 90,
    "max_value": 140,
    "unit": "mmHg"
  },
  "temperature": {
    "id": 3,
    "min_value": 36.1,
    "max_value": 37.8,
    "unit": "°C"
  },
  "oxygen": {
    "id": 4,
    "min_value": 95,
    "max_value": 100,
    "unit": "%"
  }
}
```

### Mettre à jour les seuils personnalisés

```
POST /api/vital-signs/thresholds
```

Met à jour les seuils personnalisés pour le patient connecté.

#### Corps de la requête

```json
{
  "type": "heartrate",
  "min_value": 60,
  "max_value": 100,
  "unit": "bpm"
}
```

#### Réponse

```json
{
  "id": 1,
  "type": "heartrate",
  "min_value": 60,
  "max_value": 100,
  "unit": "bpm",
  "updated_at": "2023-04-30T12:34:56"
}
```

### Récupérer les capteurs

```
GET /api/vital-signs/sensors
```

Récupère les capteurs du patient connecté.

#### Réponse

```json
[
  {
    "id": 1,
    "name": "Heartrate Sensor",
    "type": "heartrate",
    "status": "active",
    "last_connected_at": "2023-04-30T12:34:56"
  },
  {
    "id": 2,
    "name": "Blood Pressure Sensor",
    "type": "blood_pressure",
    "status": "active",
    "last_connected_at": "2023-04-30T12:34:56"
  }
]
```

### Publier un signal vital

```
POST /api/vital-signs/publish
```

Publie un signal vital sur le broker MQTT.

#### Corps de la requête

```json
{
  "type": "heartrate",
  "value": "72",
  "unit": "bpm",
  "appointment_id": 1
}
```

Le champ `appointment_id` est optionnel. S'il est fourni, le signal vital sera également envoyé au médecin pendant la consultation.

#### Réponse

```json
{
  "success": true,
  "message": "Signal vital publié sur healthconnect/vitals/1/heartrate",
  "data": {
    "patient_id": 1,
    "type": "heartrate",
    "value": "72",
    "unit": "bpm",
    "is_abnormal": false,
    "timestamp": "2023-04-30T12:34:56",
    "appointment_id": 1
  }
}
```

### Simuler des signaux vitaux

```
POST /api/vital-signs/simulate
```

Simule des signaux vitaux pour le patient connecté.

#### Corps de la requête

```json
{
  "duration": 60,
  "interval": 5,
  "types": ["heartrate", "blood_pressure", "temperature", "oxygen"],
  "appointment_id": 1
}
```

Tous les champs sont optionnels :
- `duration` : Durée de la simulation en secondes. Par défaut : 60.
- `interval` : Intervalle entre chaque mesure en secondes. Par défaut : 5.
- `types` : Types de signaux vitaux à simuler. Par défaut : tous les types.
- `appointment_id` : ID du rendez-vous pour lequel simuler les signaux vitaux. Si fourni, les signaux vitaux seront également envoyés au médecin pendant la consultation.

#### Réponse

```json
{
  "success": true,
  "message": "Simulation démarrée pour 60 secondes avec un intervalle de 5 secondes",
  "types": ["heartrate", "blood_pressure", "temperature", "oxygen"],
  "appointment_id": 1
}
```

## Intégration avec MQTT

Les signaux vitaux peuvent également être publiés directement sur le broker MQTT. Le topic à utiliser est :

```
healthconnect/vitals/{patient_id}/{type}
```

Où :
- `{patient_id}` est l'ID du patient
- `{type}` est le type de signal vital (`heartrate`, `blood_pressure`, `temperature`, `oxygen`)

Le message doit être au format JSON et contenir les champs suivants :

```json
{
  "value": "72",
  "unit": "bpm",
  "timestamp": "2023-04-30T12:34:56",
  "appointment_id": 1
}
```

Le champ `appointment_id` est optionnel. S'il est fourni, le signal vital sera également envoyé au médecin pendant la consultation.

## Intégration avec Socket.IO

Les signaux vitaux sont également émis via Socket.IO. Les événements à écouter sont :

- `vital_sign_update` : Émis lorsqu'un signal vital est mis à jour
- `vital_sign_to_doctor` : Émis lorsqu'un signal vital est envoyé au médecin pendant une consultation

Le format des données est le même que pour l'API REST et MQTT.

## Exemple d'utilisation avec Python

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

# Récupérer les dernières mesures
response = session.get(f"{base_url}/latest")
latest_vitals = response.json()
print("Dernières mesures:", json.dumps(latest_vitals, indent=2))

# Publier un signal vital
response = session.post(f"{base_url}/publish", json={
    "type": "heartrate",
    "value": "72",
    "unit": "bpm"
})
result = response.json()
print("Publication:", json.dumps(result, indent=2))

# Simuler des signaux vitaux
response = session.post(f"{base_url}/simulate", json={
    "duration": 60,
    "interval": 5,
    "types": ["heartrate", "blood_pressure"]
})
result = response.json()
print("Simulation:", json.dumps(result, indent=2))
```

## Exemple d'utilisation avec JavaScript

```javascript
// Configuration
const baseUrl = "http://localhost:5000/api/vital-signs";

// Récupérer les dernières mesures
fetch(`${baseUrl}/latest`)
  .then(response => response.json())
  .then(data => {
    console.log("Dernières mesures:", data);
  });

// Publier un signal vital
fetch(`${baseUrl}/publish`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "heartrate",
    value: "72",
    unit: "bpm"
  })
})
  .then(response => response.json())
  .then(data => {
    console.log("Publication:", data);
  });

// Simuler des signaux vitaux
fetch(`${baseUrl}/simulate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    duration: 60,
    interval: 5,
    types: ["heartrate", "blood_pressure"]
  })
})
  .then(response => response.json())
  .then(data => {
    console.log("Simulation:", data);
  });

// Écouter les événements Socket.IO
const socket = io();
socket.on("vital_sign_update", data => {
  console.log("Mise à jour de signal vital:", data);
});
```

## Exemple d'utilisation avec MQTT (Python)

```python
import paho.mqtt.client as mqtt
import json
import time

# Configuration
broker_url = "localhost"
broker_port = 1883
patient_id = 1

# Callback lorsqu'un message est reçu
def on_message(client, userdata, msg):
    print(f"Message reçu sur {msg.topic}: {msg.payload.decode()}")

# Créer un client MQTT
client = mqtt.Client()
client.on_message = on_message

# Se connecter au broker
client.connect(broker_url, broker_port, 60)

# S'abonner aux topics
client.subscribe(f"healthconnect/vitals/{patient_id}/#")

# Démarrer la boucle de réception
client.loop_start()

# Publier un signal vital
topic = f"healthconnect/vitals/{patient_id}/heartrate"
payload = {
    "value": "72",
    "unit": "bpm",
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
}
client.publish(topic, json.dumps(payload))

# Attendre un peu
time.sleep(10)

# Arrêter la boucle et se déconnecter
client.loop_stop()
client.disconnect()
```
