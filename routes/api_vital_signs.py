from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from models import VitalSign, Sensor, VitalSignThreshold, Patient, Appointment, db
from utils.datetime_utils import get_current_time_naive
from sqlalchemy import desc
import json
from datetime import datetime, timedelta

api_vital_signs_bp = Blueprint('api_vital_signs', __name__, url_prefix='/api/vital-signs')

@api_vital_signs_bp.route('/latest', methods=['GET'])
@login_required
def get_latest_vital_signs():
    """Récupère les dernières mesures de signaux vitaux pour le patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les dernières mesures pour chaque type de signal vital
    vital_types = ['heartrate', 'blood_pressure', 'temperature', 'oxygen']
    latest_vitals = {}
    
    for vital_type in vital_types:
        latest = VitalSign.query.filter_by(
            patient_id=patient_id,
            type=vital_type
        ).order_by(desc(VitalSign.timestamp)).first()
        
        if latest:
            latest_vitals[vital_type] = {
                'id': latest.id,
                'value': latest.value,
                'unit': latest.unit,
                'timestamp': latest.timestamp.isoformat(),
                'is_abnormal': latest.is_abnormal
            }
    
    return jsonify(latest_vitals)

@api_vital_signs_bp.route('/history', methods=['GET'])
@login_required
def get_vital_signs_history():
    """Récupère l'historique des mesures de signaux vitaux pour le patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Paramètres de filtrage
    vital_type = request.args.get('type', 'heartrate')
    period = request.args.get('period', 'day')
    
    # Déterminer la date de début en fonction de la période
    now = get_current_time_naive()
    if period == 'day':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'month':
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == 'year':
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        return jsonify({'error': 'Période invalide. Les valeurs acceptées sont: day, week, month, year'}), 400
    
    # Récupérer les mesures
    vitals = VitalSign.query.filter(
        VitalSign.patient_id == patient_id,
        VitalSign.type == vital_type,
        VitalSign.timestamp >= start_date
    ).order_by(VitalSign.timestamp).all()
    
    # Formater les résultats
    results = []
    for vital in vitals:
        results.append({
            'id': vital.id,
            'value': vital.value,
            'unit': vital.unit,
            'timestamp': vital.timestamp.isoformat(),
            'is_abnormal': vital.is_abnormal
        })
    
    return jsonify(results)

@api_vital_signs_bp.route('/thresholds', methods=['GET'])
@login_required
def get_thresholds():
    """Récupère les seuils personnalisés pour le patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les seuils
    thresholds = VitalSignThreshold.query.filter_by(patient_id=patient_id).all()
    
    # Formater les résultats
    results = {}
    for threshold in thresholds:
        results[threshold.type] = {
            'id': threshold.id,
            'min_value': threshold.min_value,
            'max_value': threshold.max_value,
            'unit': threshold.unit
        }
    
    return jsonify(results)

@api_vital_signs_bp.route('/thresholds', methods=['POST'])
@login_required
def update_thresholds():
    """Met à jour les seuils personnalisés pour le patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les données de la requête
    data = request.json
    if not data:
        return jsonify({'error': 'Données manquantes'}), 400
    
    # Vérifier que les données sont valides
    required_fields = ['type', 'min_value', 'max_value', 'unit']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Le champ {field} est requis'}), 400
    
    # Récupérer le seuil existant ou en créer un nouveau
    threshold = VitalSignThreshold.query.filter_by(
        patient_id=patient_id,
        type=data['type']
    ).first()
    
    if not threshold:
        threshold = VitalSignThreshold(
            patient_id=patient_id,
            type=data['type'],
            min_value=data['min_value'],
            max_value=data['max_value'],
            unit=data['unit']
        )
        db.session.add(threshold)
    else:
        threshold.min_value = data['min_value']
        threshold.max_value = data['max_value']
        threshold.unit = data['unit']
        threshold.updated_at = get_current_time_naive()
    
    db.session.commit()
    
    return jsonify({
        'id': threshold.id,
        'type': threshold.type,
        'min_value': threshold.min_value,
        'max_value': threshold.max_value,
        'unit': threshold.unit,
        'updated_at': threshold.updated_at.isoformat()
    })

@api_vital_signs_bp.route('/sensors', methods=['GET'])
@login_required
def get_sensors():
    """Récupère les capteurs du patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les capteurs
    sensors = Sensor.query.filter_by(patient_id=patient_id).all()
    
    # Formater les résultats
    results = []
    for sensor in sensors:
        results.append({
            'id': sensor.id,
            'name': sensor.name,
            'type': sensor.type,
            'status': sensor.status,
            'last_connected_at': sensor.last_connected_at.isoformat() if sensor.last_connected_at else None
        })
    
    return jsonify(results)

@api_vital_signs_bp.route('/publish', methods=['POST'])
@login_required
def publish_vital_sign():
    """Publie un signal vital sur le broker MQTT."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les données de la requête
    data = request.json
    if not data:
        return jsonify({'error': 'Données manquantes'}), 400
    
    # Vérifier que les données sont valides
    required_fields = ['type', 'value', 'unit']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Le champ {field} est requis'}), 400
    
    # Vérifier si la valeur est anormale en fonction des seuils
    threshold = VitalSignThreshold.query.filter_by(
        patient_id=patient_id,
        type=data['type']
    ).first()
    
    is_abnormal = False
    if threshold:
        if data['type'] == 'blood_pressure':
            # Pour la tension artérielle, la valeur est au format "120/80"
            try:
                systolic, diastolic = map(int, data['value'].split('/'))
                is_abnormal = (systolic < threshold.min_value or 
                              systolic > threshold.max_value or 
                              diastolic < threshold.min_value or 
                              diastolic > threshold.max_value)
            except (ValueError, AttributeError):
                is_abnormal = False
        else:
            try:
                value = float(data['value'])
                is_abnormal = (value < threshold.min_value or value > threshold.max_value)
            except (ValueError, TypeError):
                is_abnormal = False
    
    # Ajouter l'ID du patient et le statut d'anomalie aux données
    mqtt_data = {
        'patient_id': patient_id,
        'type': data['type'],
        'value': data['value'],
        'unit': data['unit'],
        'is_abnormal': is_abnormal,
        'timestamp': get_current_time_naive().isoformat()
    }
    
    # Ajouter l'ID du rendez-vous si fourni
    if 'appointment_id' in data:
        # Vérifier que le rendez-vous existe et appartient au patient
        appointment = Appointment.query.filter_by(
            id=data['appointment_id'],
            patient_id=patient_id
        ).first()
        
        if appointment:
            mqtt_data['appointment_id'] = appointment.id
    
    # Publier sur le broker MQTT
    if current_app.mqtt_handler:
        topic = f"healthconnect/vitals/{patient_id}/{data['type']}"
        success = current_app.mqtt_handler.publish(topic, mqtt_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Signal vital publié sur {topic}',
                'data': mqtt_data
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Échec de la publication sur le broker MQTT'
            }), 500
    else:
        # Si le handler MQTT n'est pas disponible, émettre directement via Socket.IO
        from extensions import socketio
        
        # Créer un enregistrement dans la base de données
        try:
            # Vérifier si un capteur existe pour ce patient et ce type
            sensor = Sensor.query.filter_by(
                patient_id=patient_id,
                type=data['type']
            ).first()
            
            if not sensor:
                sensor = Sensor(
                    name=f"{data['type'].capitalize()} Sensor",
                    type=data['type'],
                    patient_id=patient_id,
                    status='active',
                    last_connected_at=get_current_time_naive()
                )
                db.session.add(sensor)
                db.session.commit()
            
            # Créer un nouvel enregistrement de signal vital
            vital_sign = VitalSign(
                sensor_id=sensor.id,
                patient_id=patient_id,
                type=data['type'],
                value=data['value'],
                unit=data['unit'],
                is_abnormal=is_abnormal,
                appointment_id=mqtt_data.get('appointment_id')
            )
            db.session.add(vital_sign)
            db.session.commit()
            
            # Émettre un événement Socket.IO
            socketio.emit('vital_sign_update', mqtt_data)
            
            # Si c'est pendant une consultation, émettre également un événement spécifique
            if 'appointment_id' in mqtt_data:
                socketio.emit('vital_sign_to_doctor', mqtt_data)
            
            return jsonify({
                'success': True,
                'message': 'Signal vital enregistré et émis via Socket.IO',
                'data': mqtt_data
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': f'Échec de l\'enregistrement du signal vital: {str(e)}'
            }), 500

@api_vital_signs_bp.route('/simulate', methods=['POST'])
@login_required
def simulate_vital_signs():
    """Simule des signaux vitaux pour le patient connecté."""
    if current_user.role != 'patient':
        return jsonify({'error': 'Accès refusé. Vous devez être un patient pour accéder à cette ressource.'}), 403
    
    patient_id = current_user.patient.id
    
    # Récupérer les données de la requête
    data = request.json or {}
    
    # Paramètres de simulation
    duration = data.get('duration', 60)  # Durée en secondes
    interval = data.get('interval', 5)   # Intervalle en secondes
    types = data.get('types', ['heartrate', 'blood_pressure', 'temperature', 'oxygen'])
    appointment_id = data.get('appointment_id')
    
    # Vérifier que le rendez-vous existe et appartient au patient
    if appointment_id:
        appointment = Appointment.query.filter_by(
            id=appointment_id,
            patient_id=patient_id
        ).first()
        
        if not appointment:
            return jsonify({'error': 'Rendez-vous non trouvé ou non autorisé'}), 404
    
    # Démarrer la simulation en arrière-plan
    from threading import Thread
    import time
    import random
    
    def simulate():
        # Valeurs initiales
        values = {
            'heartrate': 72,
            'blood_pressure': {'systolic': 120, 'diastolic': 80},
            'temperature': 36.8,
            'oxygen': 98
        }
        
        # Plages de variation
        variations = {
            'heartrate': 5,
            'blood_pressure': {'systolic': 10, 'diastolic': 5},
            'temperature': 0.3,
            'oxygen': 2
        }
        
        # Unités
        units = {
            'heartrate': 'bpm',
            'blood_pressure': 'mmHg',
            'temperature': '°C',
            'oxygen': '%'
        }
        
        # Seuils
        thresholds = {}
        for vital_type in types:
            threshold = VitalSignThreshold.query.filter_by(
                patient_id=patient_id,
                type=vital_type
            ).first()
            
            if threshold:
                thresholds[vital_type] = {
                    'min': threshold.min_value,
                    'max': threshold.max_value
                }
            else:
                # Seuils par défaut
                if vital_type == 'heartrate':
                    thresholds[vital_type] = {'min': 60, 'max': 100}
                elif vital_type == 'blood_pressure':
                    thresholds[vital_type] = {'min': 90, 'max': 140}  # Systolique
                elif vital_type == 'temperature':
                    thresholds[vital_type] = {'min': 36.1, 'max': 37.8}
                elif vital_type == 'oxygen':
                    thresholds[vital_type] = {'min': 95, 'max': 100}
        
        # Simuler les signaux vitaux
        end_time = time.time() + duration
        while time.time() < end_time:
            for vital_type in types:
                # Générer une nouvelle valeur
                if vital_type == 'blood_pressure':
                    # Pour la tension artérielle, nous avons deux valeurs
                    systolic = values[vital_type]['systolic'] + random.uniform(-1, 1) * variations[vital_type]['systolic']
                    diastolic = values[vital_type]['diastolic'] + random.uniform(-1, 1) * variations[vital_type]['diastolic']
                    
                    # Arrondir les valeurs
                    systolic = round(systolic)
                    diastolic = round(diastolic)
                    
                    # Mettre à jour les valeurs
                    values[vital_type] = {'systolic': systolic, 'diastolic': diastolic}
                    
                    # Formater la valeur pour l'affichage
                    value = f"{systolic}/{diastolic}"
                    
                    # Vérifier si la valeur est anormale
                    is_abnormal = (systolic < thresholds[vital_type]['min'] or 
                                  systolic > thresholds[vital_type]['max'])
                else:
                    # Pour les autres types, nous avons une seule valeur
                    value = values[vital_type] + random.uniform(-1, 1) * variations[vital_type]
                    
                    # Arrondir les valeurs
                    if vital_type == 'temperature':
                        value = round(value, 1)
                    else:
                        value = round(value)
                    
                    # Mettre à jour la valeur
                    values[vital_type] = value
                    
                    # Vérifier si la valeur est anormale
                    is_abnormal = (value < thresholds[vital_type]['min'] or 
                                  value > thresholds[vital_type]['max'])
                
                # Créer les données pour le signal vital
                vital_data = {
                    'type': vital_type,
                    'value': value,
                    'unit': units[vital_type],
                    'is_abnormal': is_abnormal
                }
                
                if appointment_id:
                    vital_data['appointment_id'] = appointment_id
                
                # Publier le signal vital
                with current_app.app_context():
                    try:
                        # Créer un enregistrement dans la base de données
                        sensor = Sensor.query.filter_by(
                            patient_id=patient_id,
                            type=vital_type
                        ).first()
                        
                        if not sensor:
                            sensor = Sensor(
                                name=f"{vital_type.capitalize()} Sensor",
                                type=vital_type,
                                patient_id=patient_id,
                                status='active',
                                last_connected_at=get_current_time_naive()
                            )
                            db.session.add(sensor)
                            db.session.commit()
                        
                        # Créer un nouvel enregistrement de signal vital
                        vital_sign = VitalSign(
                            sensor_id=sensor.id,
                            patient_id=patient_id,
                            type=vital_type,
                            value=str(value),
                            unit=units[vital_type],
                            is_abnormal=is_abnormal,
                            appointment_id=appointment_id
                        )
                        db.session.add(vital_sign)
                        db.session.commit()
                        
                        # Préparer les données pour Socket.IO
                        emit_data = {
                            'patient_id': patient_id,
                            'type': vital_type,
                            'value': str(value),
                            'unit': units[vital_type],
                            'is_abnormal': is_abnormal,
                            'timestamp': get_current_time_naive().isoformat()
                        }
                        
                        if appointment_id:
                            emit_data['appointment_id'] = appointment_id
                        
                        # Émettre un événement Socket.IO
                        from extensions import socketio
                        socketio.emit('vital_sign_update', emit_data)
                        
                        # Si c'est pendant une consultation, émettre également un événement spécifique
                        if appointment_id:
                            socketio.emit('vital_sign_to_doctor', emit_data)
                        
                        print(f"Signal vital simulé: {emit_data}")
                    except Exception as e:
                        print(f"Erreur lors de la simulation du signal vital: {str(e)}")
                        db.session.rollback()
            
            # Attendre l'intervalle
            time.sleep(interval)
    
    # Démarrer la simulation dans un thread séparé
    simulation_thread = Thread(target=simulate)
    simulation_thread.daemon = True
    simulation_thread.start()
    
    return jsonify({
        'success': True,
        'message': f'Simulation démarrée pour {duration} secondes avec un intervalle de {interval} secondes',
        'types': types,
        'appointment_id': appointment_id
    })
