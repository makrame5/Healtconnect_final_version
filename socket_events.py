from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from extensions import db
from models import Notification, User, Doctor, Patient, Appointment, Message, ConsultationNote, SharedFile
from utils.datetime_utils import get_current_time, get_current_time_naive, format_datetime
import os
import json
import base64
from werkzeug.utils import secure_filename

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        if current_user.is_authenticated:
            # Join a room specific to this user
            join_room(f'user_{current_user.id}')
            print(f'Client connected: {request.sid}, User: {current_user.id}')
        else:
            print(f'Anonymous client connected: {request.sid}')

    @socketio.on('disconnect')
    def handle_disconnect():
        if current_user.is_authenticated:
            leave_room(f'user_{current_user.id}')
            print(f'Client disconnected: {request.sid}, User: {current_user.id}')
        else:
            print(f'Anonymous client disconnected: {request.sid}')

    @socketio.on('read_notification')
    def handle_read_notification(data):
        if not current_user.is_authenticated:
            return

        notification_id = data.get('notification_id')
        if notification_id:
            notification = Notification.query.get(notification_id)
            if notification and notification.user_id == current_user.id:
                notification.is_read = True
                db.session.commit()
                emit('notification_updated', {'id': notification_id, 'is_read': True}, room=f'user_{current_user.id}')

    @socketio.on('join_room')
    def handle_join_room(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        if room_id:
            print(f"Tentative de rejoindre la salle {room_id} par l'utilisateur {current_user.id}")

            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment:
                is_doctor = current_user.role == 'doctor' and current_user.doctor.id == appointment.doctor_id
                is_patient = current_user.role == 'patient' and current_user.patient.id == appointment.patient_id

                if is_doctor or is_patient:
                    join_room(room_id)
                    print(f'User {current_user.id} joined room {room_id}')

                    # Notifier les autres participants
                    user_name = f"{current_user.first_name} {current_user.last_name}"
                    if is_doctor:
                        user_name = f"Dr. {user_name}"

                    print(f"Notification aux autres participants: {user_name} a rejoint la salle {room_id}")
                    emit('user_joined', {
                        'user_id': current_user.id,
                        'user_name': user_name,
                        'user_role': current_user.role,
                        'timestamp': get_current_time().strftime('%H:%M')
                    }, room=room_id)
                else:
                    print(f"Accès refusé: l'utilisateur {current_user.id} n'est pas autorisé à rejoindre la salle {room_id}")
            else:
                print(f"Salle {room_id} non trouvée")

            # Si l'utilisateur a accès à la salle, charger les messages et fichiers
            if appointment and (is_doctor or is_patient):
                # Charger les messages précédents
                messages = Message.query.filter_by(appointment_id=appointment.id).order_by(Message.created_at).all()
                message_history = []
                for msg in messages:
                    sender = User.query.get(msg.sender_id)
                    sender_name = f"{sender.first_name} {sender.last_name}"
                    if sender.role == 'doctor':
                        sender_name = f"Dr. {sender_name}"

                    message_history.append({
                        'id': msg.id,
                        'sender_id': msg.sender_id,
                        'sender_name': sender_name,
                        'sender_role': sender.role,
                        'content': msg.content,
                        'timestamp': msg.created_at.strftime('%H:%M'),
                        'date': msg.created_at.strftime('%d/%m/%Y')
                    })

                emit('message_history', {'messages': message_history}, room=request.sid)

                # Charger les fichiers partagés
                files = SharedFile.query.filter_by(appointment_id=appointment.id).order_by(SharedFile.created_at).all()
                file_history = []
                for file in files:
                    sender = User.query.get(file.sender_id)
                    sender_name = f"{sender.first_name} {sender.last_name}"
                    if sender.role == 'doctor':
                        sender_name = f"Dr. {sender_name}"

                    file_history.append({
                        'id': file.id,
                        'sender_id': file.sender_id,
                        'sender_name': sender_name,
                        'sender_role': sender.role,
                        'file_name': file.file_name,
                        'file_type': file.file_type,
                        'file_size': file.file_size,
                        'file_path': file.file_path,
                        'timestamp': file.created_at.strftime('%H:%M'),
                        'date': file.created_at.strftime('%d/%m/%Y')
                    })

                emit('file_history', {'files': file_history}, room=request.sid)

                # Si c'est un médecin, charger les notes de consultation
                if is_doctor:
                    notes = ConsultationNote.query.filter_by(
                        appointment_id=appointment.id,
                        doctor_id=current_user.doctor.id
                    ).order_by(ConsultationNote.updated_at.desc()).first()

                    if notes:
                        emit('load_notes', {
                            'id': notes.id,
                            'content': notes.content,
                            'updated_at': notes.updated_at.strftime('%d/%m/%Y %H:%M')
                        }, room=request.sid)

    @socketio.on('leave_room')
    def handle_leave_room(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        end_consultation = data.get('end_consultation', False)  # Nouveau paramètre pour indiquer si la consultation est terminée

        if room_id:
            print(f"Tentative de quitter la salle {room_id} par l'utilisateur {current_user.id}")

            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment:
                is_doctor = current_user.role == 'doctor' and current_user.doctor.id == appointment.doctor_id
                is_patient = current_user.role == 'patient' and current_user.patient.id == appointment.patient_id

                if is_doctor or is_patient:
                    leave_room(room_id)
                    print(f'User {current_user.id} left room {room_id}')

                    # Notifier les autres participants
                    user_name = f"{current_user.first_name} {current_user.last_name}"
                    if current_user.role == 'doctor':
                        user_name = f"Dr. {user_name}"

                    print(f"Notification aux autres participants: {user_name} a quitté la salle {room_id}")
                    emit('user_left', {
                        'user_id': current_user.id,
                        'user_name': user_name,
                        'user_role': current_user.role,
                        'timestamp': get_current_time().strftime('%H:%M')
                    }, room=room_id)

                    # Si l'utilisateur est un médecin et qu'il a indiqué que la consultation est terminée
                    if is_doctor and end_consultation:
                        print(f"Médecin a terminé la consultation pour le rendez-vous {appointment.id}")

                        # Marquer le rendez-vous comme terminé
                        appointment.status = 'completed'
                        db.session.commit()

                        # Récupérer les informations du patient pour la notification
                        patient_user = User.query.get(appointment.patient.user_id)
                        formatted_date = appointment.date_time.strftime('%d/%m/%Y à %H:%M')

                        # Envoyer une notification au patient
                        notification_title = "Consultation terminée"
                        notification_content = f"Votre consultation avec Dr. {current_user.first_name} {current_user.last_name} du {formatted_date} a été marquée comme terminée."

                        send_notification(
                            user_id=patient_user.id,
                            title=notification_title,
                            content=notification_content,
                            notification_type="appointment_completed",
                            related_id=appointment.id
                        )

                        # Envoyer une mise à jour en temps réel du rendez-vous
                        send_appointment_update(appointment.id)

                        print(f"Rendez-vous {appointment.id} marqué comme terminé et notification envoyée au patient")
                else:
                    print(f"Accès refusé: l'utilisateur {current_user.id} n'est pas autorisé à quitter la salle {room_id}")
            else:
                print(f"Salle {room_id} non trouvée")

    @socketio.on('send_message')
    def handle_send_message(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        content = data.get('content')
        is_urgent = data.get('is_urgent', False)

        if room_id and content:
            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment:
                is_doctor = current_user.role == 'doctor' and current_user.doctor.id == appointment.doctor_id
                is_patient = current_user.role == 'patient' and current_user.patient.id == appointment.patient_id

                if is_doctor or is_patient:
                    # Enregistrer le message dans la base de données
                    message = Message(
                        appointment_id=appointment.id,
                        sender_id=current_user.id,
                        content=content,
                        created_at=get_current_time_naive(),
                        is_read=False,
                        is_urgent=is_urgent
                    )
                    db.session.add(message)
                    db.session.commit()

                    # Envoyer le message à tous les participants
                    user_name = f"{current_user.first_name} {current_user.last_name}"
                    if current_user.role == 'doctor':
                        user_name = f"Dr. {user_name}"

                    emit('new_message', {
                        'id': message.id,
                        'sender_id': current_user.id,
                        'sender_name': user_name,
                        'sender_role': current_user.role,
                        'content': content,
                        'is_urgent': is_urgent,
                        'timestamp': message.created_at.strftime('%H:%M'),
                        'date': message.created_at.strftime('%d/%m/%Y')
                    }, room=room_id)

    @socketio.on('save_notes')
    def handle_save_notes(data):
        if not current_user.is_authenticated or current_user.role != 'doctor':
            return

        room_id = data.get('room_id')
        content = data.get('content')

        if room_id and content:
            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment and appointment.doctor_id == current_user.doctor.id:
                # Vérifier si des notes existent déjà
                notes = ConsultationNote.query.filter_by(
                    appointment_id=appointment.id,
                    doctor_id=current_user.doctor.id
                ).first()

                now = get_current_time_naive()

                if notes:
                    # Mettre à jour les notes existantes
                    notes.content = content
                    notes.updated_at = now
                else:
                    # Créer de nouvelles notes
                    notes = ConsultationNote(
                        appointment_id=appointment.id,
                        doctor_id=current_user.doctor.id,
                        content=content,
                        created_at=now,
                        updated_at=now
                    )
                    db.session.add(notes)

                db.session.commit()

                emit('notes_saved', {
                    'id': notes.id,
                    'content': content,
                    'updated_at': notes.updated_at.strftime('%d/%m/%Y %H:%M')
                }, room=request.sid)

    @socketio.on('share_file')
    def handle_share_file(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        file_data = data.get('file_data')
        file_name = data.get('file_name')
        file_type = data.get('file_type')
        file_size = data.get('file_size')

        if room_id and file_data and file_name and file_type:
            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment:
                is_doctor = current_user.role == 'doctor' and current_user.doctor.id == appointment.doctor_id
                is_patient = current_user.role == 'patient' and current_user.patient.id == appointment.patient_id

                if is_doctor or is_patient:
                    try:
                        # Créer le répertoire de stockage si nécessaire
                        upload_dir = os.path.join('static', 'uploads', 'consultation_files', str(appointment.id))
                        os.makedirs(upload_dir, exist_ok=True)

                        # Sécuriser le nom de fichier
                        secure_name = secure_filename(file_name)
                        timestamp = get_current_time().strftime('%Y%m%d%H%M%S')
                        unique_filename = f"{timestamp}_{secure_name}"
                        file_path = os.path.join(upload_dir, unique_filename)

                        # Décoder et enregistrer le fichier
                        file_data = file_data.split(',')[1]  # Supprimer le préfixe data:...;base64,
                        with open(file_path, 'wb') as f:
                            f.write(base64.b64decode(file_data))

                        # Enregistrer les informations du fichier dans la base de données
                        shared_file = SharedFile(
                            appointment_id=appointment.id,
                            sender_id=current_user.id,
                            file_name=file_name,
                            file_path=os.path.join('uploads', 'consultation_files', str(appointment.id), unique_filename),
                            file_type=file_type,
                            file_size=file_size,
                            created_at=get_current_time_naive()
                        )
                        db.session.add(shared_file)
                        db.session.commit()

                        # Envoyer les informations du fichier à tous les participants
                        user_name = f"{current_user.first_name} {current_user.last_name}"
                        if current_user.role == 'doctor':
                            user_name = f"Dr. {user_name}"

                        emit('new_file', {
                            'id': shared_file.id,
                            'sender_id': current_user.id,
                            'sender_name': user_name,
                            'sender_role': current_user.role,
                            'file_name': file_name,
                            'file_type': file_type,
                            'file_size': file_size,
                            'file_path': shared_file.file_path,
                            'timestamp': shared_file.created_at.strftime('%H:%M'),
                            'date': shared_file.created_at.strftime('%d/%m/%Y')
                        }, room=room_id)

                    except Exception as e:
                        print(f"Error sharing file: {str(e)}")
                        emit('error', {'message': f"Erreur lors du partage du fichier: {str(e)}"}, room=request.sid)

    @socketio.on('webrtc_signal')
    def handle_webrtc_signal(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        signal = data.get('signal')
        target_id = data.get('target_id')

        if room_id and signal:
            print(f"Signal WebRTC reçu de {current_user.id} pour la salle {room_id}: {signal['type']}")

            # Vérifier que l'utilisateur a le droit d'accéder à cette salle
            appointment = Appointment.query.filter_by(video_room_id=room_id).first()
            if appointment:
                is_doctor = current_user.role == 'doctor' and current_user.doctor.id == appointment.doctor_id
                is_patient = current_user.role == 'patient' and current_user.patient.id == appointment.patient_id

                if is_doctor or is_patient:
                    # Transmettre le signal à tous les participants de la salle sauf l'émetteur
                    print(f"Transmission du signal {signal['type']} aux autres participants de la salle {room_id}")
                    emit('webrtc_signal', {
                        'signal': signal,
                        'sender_id': current_user.id
                    }, room=room_id, include_self=False)
                else:
                    print(f"Accès refusé: l'utilisateur {current_user.id} n'est pas autorisé à envoyer des signaux dans la salle {room_id}")
            else:
                print(f"Salle {room_id} non trouvée")

    # Gestionnaires pour les anciens événements (pour la compatibilité)
    @socketio.on('offer')
    def handle_offer(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        offer = data.get('offer')

        if room_id and offer:
            print(f"Offre WebRTC reçue de {current_user.id} pour la salle {room_id}")

            # Convertir en format webrtc_signal
            emit('webrtc_signal', {
                'signal': {
                    'type': 'offer',
                    'sdp': offer
                },
                'sender_id': current_user.id
            }, room=room_id, include_self=False)

    @socketio.on('answer')
    def handle_answer(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        answer = data.get('answer')

        if room_id and answer:
            print(f"Réponse WebRTC reçue de {current_user.id} pour la salle {room_id}")

            # Convertir en format webrtc_signal
            emit('webrtc_signal', {
                'signal': {
                    'type': 'answer',
                    'sdp': answer
                },
                'sender_id': current_user.id
            }, room=room_id, include_self=False)

    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        if not current_user.is_authenticated:
            return

        room_id = data.get('room_id')
        candidate = data.get('candidate')

        if room_id and candidate:
            print(f"Candidat ICE reçu de {current_user.id} pour la salle {room_id}")

            # Convertir en format webrtc_signal
            emit('webrtc_signal', {
                'signal': {
                    'type': 'ice-candidate',
                    'candidate': candidate
                },
                'sender_id': current_user.id
            }, room=room_id, include_self=False)

def send_appointment_update(appointment_id):
    """
    Envoie une mise à jour en temps réel pour un rendez-vous spécifique

    Parameters:
    - appointment_id: ID du rendez-vous à mettre à jour
    """
    try:
        # Récupérer le rendez-vous
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            print(f"Rendez-vous {appointment_id} non trouvé")
            return False

        # Récupérer les IDs des utilisateurs concernés
        doctor_user_id = appointment.doctor.user_id
        patient_user_id = appointment.patient.user_id

        # Préparer les données du rendez-vous
        appointment_data = {
            'id': appointment.id,
            'status': appointment.status,
            'date_time': appointment.date_time.strftime('%Y-%m-%d %H:%M:%S'),
            'video_room_id': appointment.video_room_id,
            'video_link': appointment.video_link,
            'doctor_id': appointment.doctor_id,
            'patient_id': appointment.patient_id,
            'doctor_name': f"{appointment.doctor.user.first_name} {appointment.doctor.user.last_name}",
            'patient_name': f"{appointment.patient.user.first_name} {appointment.patient.user.last_name}",
            'doctor_specialty': appointment.doctor.specialty,
            'timestamp': get_current_time().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Envoyer la mise à jour au médecin
        from extensions import socketio
        socketio.emit('appointment_update', appointment_data, room=f'user_{doctor_user_id}')
        print(f"Mise à jour du rendez-vous {appointment_id} envoyée au médecin {doctor_user_id}")

        # Envoyer la mise à jour au patient
        socketio.emit('appointment_update', appointment_data, room=f'user_{patient_user_id}')
        print(f"Mise à jour du rendez-vous {appointment_id} envoyée au patient {patient_user_id}")

        return True
    except Exception as e:
        print(f"Erreur lors de l'envoi de la mise à jour du rendez-vous: {str(e)}")
        return False

def send_notification(user_id, title, content, notification_type, related_id=None, is_urgent=False):
    """
    Send a notification to a specific user

    Parameters:
    - user_id: ID of the user to notify
    - title: Notification title
    - content: Notification content
    - notification_type: Type of notification (appointment, message, etc.)
    - related_id: ID of the related object (optional)
    - is_urgent: Whether this is an urgent notification (for appointment reminders)
    """
    try:
        # Create notification in database
        # Essayer d'abord avec is_urgent
        try:
            notification = Notification(
                user_id=user_id,
                title=title,
                content=content,
                type=notification_type,
                related_id=related_id,
                is_read=False,
                created_at=get_current_time_naive(),
                is_urgent=is_urgent
            )
            db.session.add(notification)
            db.session.commit()
        except Exception as e:
            # Si ça échoue, essayer sans is_urgent (pour le cas où la colonne n'existe pas encore)
            print(f"Erreur lors de la création de la notification avec is_urgent: {str(e)}")
            print("Tentative de création sans le paramètre is_urgent...")

            notification = Notification(
                user_id=user_id,
                title=title,
                content=content,
                type=notification_type,
                related_id=related_id,
                is_read=False,
                created_at=get_current_time_naive()
            )
            db.session.add(notification)
            db.session.commit()

        # Emit socket event to the user
        from extensions import socketio
        notification_data = {
            'id': notification.id,
            'title': notification.title,
            'content': notification.content,
            'type': notification.type,
            'related_id': notification.related_id,
            'is_read': notification.is_read,
            'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'is_urgent': is_urgent  # Utiliser la valeur passée en paramètre
        }
        socketio.emit('new_notification', notification_data, room=f'user_{user_id}')

        # If this is an urgent notification (appointment reminder), also emit a special event
        if is_urgent:
            socketio.emit('appointment_reminder', notification_data, room=f'user_{user_id}')

    except Exception as e:
        print(f"Erreur lors de l'envoi de la notification: {str(e)}")


def check_upcoming_appointments():
    """
    Check for appointments that are about to start (in 5 minutes)
    and send notifications to both doctor and patient
    """
    from models import Appointment
    from datetime import timedelta

    # Get current time
    now = get_current_time_naive()

    # Calculate the time 5 minutes from now
    reminder_time = now + timedelta(minutes=5)

    # Find appointments that start in 5 minutes (with a small buffer of 30 seconds)
    upcoming_appointments = Appointment.query.filter(
        Appointment.status == 'accepted',
        Appointment.date_time > now,
        Appointment.date_time <= reminder_time + timedelta(seconds=30)
    ).all()

    print(f"Checking for upcoming appointments at {now}. Found {len(upcoming_appointments)} appointments starting in 5 minutes.")

    # Send notifications for each upcoming appointment
    for appointment in upcoming_appointments:
        # Get doctor and patient
        doctor = appointment.doctor
        patient = appointment.patient

        # Format appointment time
        formatted_time = appointment.date_time.strftime('%H:%M')

        # Send notification to doctor
        doctor_notification_title = "Rendez-vous imminent"
        doctor_notification_content = f"Votre consultation avec {patient.user.first_name} {patient.user.last_name} commence dans 5 minutes à {formatted_time}."

        send_notification(
            user_id=doctor.user_id,
            title=doctor_notification_title,
            content=doctor_notification_content,
            notification_type="appointment_reminder",
            related_id=appointment.id,
            is_urgent=True
        )

        # Send notification to patient
        patient_notification_title = "Rendez-vous imminent"
        patient_notification_content = f"Votre consultation avec Dr. {doctor.user.first_name} {doctor.user.last_name} commence dans 5 minutes à {formatted_time}."

        send_notification(
            user_id=patient.user_id,
            title=patient_notification_title,
            content=patient_notification_content,
            notification_type="appointment_reminder",
            related_id=appointment.id,
            is_urgent=True
        )

        print(f"Sent reminder notifications for appointment {appointment.id} at {formatted_time}")

    return len(upcoming_appointments)
