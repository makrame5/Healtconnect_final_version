import paho.mqtt.client as mqtt
import json
import time
from flask_socketio import SocketIO
from models import VitalSign, Sensor, Patient, db
from utils.datetime_utils import get_current_time_naive
from config import Config

class MQTTHandler:
    def __init__(self, app=None, socketio=None):
        self.app = app
        self.socketio = socketio
        self.client = None
        
        if app is not None and socketio is not None:
            self.init_app(app, socketio)
    
    def init_app(self, app, socketio):
        self.app = app
        self.socketio = socketio
        
        # Configuration MQTT
        mqtt_config = {
            'broker_url': app.config.get('MQTT_BROKER_URL', 'localhost'),
            'broker_port': app.config.get('MQTT_BROKER_PORT', 1883),
            'username': app.config.get('MQTT_USERNAME', ''),
            'password': app.config.get('MQTT_PASSWORD', ''),
            'keepalive': app.config.get('MQTT_KEEPALIVE', 60),
            'client_id': app.config.get('MQTT_CLIENT_ID', f'flask_mqtt_{time.time()}')
        }
        
        # Initialiser le client MQTT
        self.client = mqtt.Client(client_id=mqtt_config['client_id'])
        
        # Définir les callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
        # Définir les identifiants si nécessaire
        if mqtt_config['username'] and mqtt_config['password']:
            self.client.username_pw_set(mqtt_config['username'], mqtt_config['password'])
        
        # Se connecter au broker MQTT
        try:
            self.client.connect(mqtt_config['broker_url'], mqtt_config['broker_port'], mqtt_config['keepalive'])
            self.client.loop_start()
            app.logger.info(f"Connected to MQTT broker at {mqtt_config['broker_url']}:{mqtt_config['broker_port']}")
        except Exception as e:
            app.logger.error(f"Failed to connect to MQTT broker: {str(e)}")
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback appelé lorsque le client se connecte au broker MQTT."""
        if rc == 0:
            self.app.logger.info("Connected to MQTT broker")
            
            # S'abonner aux topics
            client.subscribe("healthconnect/vitals/#")
            self.app.logger.info("Subscribed to healthconnect/vitals/#")
        else:
            self.app.logger.error(f"Failed to connect to MQTT broker with code {rc}")
    
    def on_message(self, client, userdata, msg):
        """Callback appelé lorsqu'un message est reçu sur un topic auquel le client est abonné."""
        try:
            # Décoder le message JSON
            payload = json.loads(msg.payload.decode())
            self.app.logger.info(f"Received message on topic {msg.topic}: {payload}")
            
            # Traiter le message en fonction du topic
            if msg.topic.startswith("healthconnect/vitals/"):
                self.handle_vital_sign(msg.topic, payload)
        except json.JSONDecodeError:
            self.app.logger.error(f"Failed to decode JSON message: {msg.payload}")
        except Exception as e:
            self.app.logger.error(f"Error processing MQTT message: {str(e)}")
    
    def handle_vital_sign(self, topic, payload):
        """Traite un message de signal vital."""
        try:
            # Extraire l'ID du patient du topic (format: healthconnect/vitals/{patient_id}/{sensor_type})
            topic_parts = topic.split('/')
            if len(topic_parts) < 4:
                self.app.logger.error(f"Invalid topic format: {topic}")
                return
            
            patient_id = int(topic_parts[2])
            sensor_type = topic_parts[3]
            
            # Vérifier que le patient existe
            with self.app.app_context():
                patient = Patient.query.get(patient_id)
                if not patient:
                    self.app.logger.error(f"Patient with ID {patient_id} not found")
                    return
                
                # Vérifier si le capteur existe, sinon le créer
                sensor = Sensor.query.filter_by(patient_id=patient_id, type=sensor_type).first()
                if not sensor:
                    sensor = Sensor(
                        name=f"{sensor_type.capitalize()} Sensor",
                        type=sensor_type,
                        patient_id=patient_id,
                        status='active',
                        last_connected_at=get_current_time_naive()
                    )
                    db.session.add(sensor)
                    db.session.commit()
                else:
                    # Mettre à jour la date de dernière connexion
                    sensor.last_connected_at = get_current_time_naive()
                    db.session.commit()
                
                # Extraire les données du signal vital
                value = payload.get('value')
                unit = payload.get('unit')
                is_abnormal = payload.get('is_abnormal', False)
                appointment_id = payload.get('appointment_id')
                
                # Créer un nouvel enregistrement de signal vital
                vital_sign = VitalSign(
                    sensor_id=sensor.id,
                    patient_id=patient_id,
                    type=sensor_type,
                    value=value,
                    unit=unit,
                    is_abnormal=is_abnormal,
                    appointment_id=appointment_id
                )
                db.session.add(vital_sign)
                db.session.commit()
                
                # Émettre un événement Socket.IO pour mettre à jour l'interface en temps réel
                vital_sign_data = {
                    'type': sensor_type,
                    'value': value,
                    'unit': unit,
                    'timestamp': vital_sign.timestamp.isoformat(),
                    'is_abnormal': is_abnormal,
                    'patient_id': patient_id
                }
                
                # Émettre l'événement à tous les clients
                self.socketio.emit('vital_sign_update', vital_sign_data)
                
                # Si c'est pendant une consultation, émettre également un événement spécifique
                if appointment_id:
                    vital_sign_data['appointment_id'] = appointment_id
                    self.socketio.emit('vital_sign_to_doctor', vital_sign_data)
                
                self.app.logger.info(f"Processed vital sign: {vital_sign_data}")
        except Exception as e:
            self.app.logger.error(f"Error handling vital sign: {str(e)}")
    
    def publish(self, topic, payload):
        """Publie un message sur un topic MQTT."""
        if self.client:
            try:
                # Convertir le payload en JSON si c'est un dictionnaire
                if isinstance(payload, dict):
                    payload = json.dumps(payload)
                
                # Publier le message
                result = self.client.publish(topic, payload)
                
                # Vérifier si la publication a réussi
                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    self.app.logger.info(f"Published message to {topic}: {payload}")
                    return True
                else:
                    self.app.logger.error(f"Failed to publish message to {topic}: {mqtt.error_string(result.rc)}")
                    return False
            except Exception as e:
                self.app.logger.error(f"Error publishing message to {topic}: {str(e)}")
                return False
        else:
            self.app.logger.error("MQTT client not initialized")
            return False
    
    def disconnect(self):
        """Déconnecte le client MQTT."""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.app.logger.info("Disconnected from MQTT broker")
