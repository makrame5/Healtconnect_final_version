from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import User, Doctor, Appointment, Prescription, Availability, Sensor, VitalSign, VitalSignThreshold
from datetime import datetime, date
from sqlalchemy import func
from utils.datetime_utils import get_current_time, get_current_time_naive, format_datetime

patient_bp = Blueprint('patient', __name__, url_prefix='/patient')

@patient_bp.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Obtenir l'heure actuelle
    current_time = get_current_time_naive()

    # 1. Récupérer le prochain rendez-vous
    next_appointment = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='accepted'
    ).filter(
        Appointment.date_time >= current_time
    ).order_by(
        Appointment.date_time
    ).first()

    # 2. Récupérer les messages récents
    try:
        from models import Message
        # Vérifier si la colonne is_urgent existe
        has_is_urgent = True
        try:
            # Tester avec une requête simple
            Message.query.filter(Message.is_urgent == True).first()
        except Exception as e:
            if 'no such column: message.is_urgent' in str(e):
                has_is_urgent = False
                print("La colonne is_urgent n'existe pas dans la table message")

        # Récupérer les messages récents sans utiliser is_urgent
        recent_messages = Message.query.join(Appointment).filter(
            Appointment.patient_id == current_user.patient.id
        ).order_by(
            Message.created_at.desc()
        ).limit(5).all()

        # Compter les messages non lus
        unread_messages_count = Message.query.join(Appointment).filter(
            Appointment.patient_id == current_user.patient.id,
            Message.is_read == False,
            Message.sender_id != current_user.id
        ).count()
    except Exception as e:
        print(f"Erreur lors de la récupération des messages: {str(e)}")
        recent_messages = []
        unread_messages_count = 0

    # 3. Récupérer la dernière prescription
    from models import Prescription
    latest_prescription = Prescription.query.filter_by(
        patient_id=current_user.patient.id
    ).order_by(
        Prescription.created_at.desc()
    ).first()

    # 4. Récupérer tous les rendez-vous à venir
    upcoming_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='accepted'
    ).filter(
        Appointment.date_time >= current_time
    ).order_by(
        Appointment.date_time
    ).all()

    # 5. Récupérer les rendez-vous passés
    past_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='completed'
    ).order_by(
        Appointment.date_time.desc()
    ).limit(5).all()

    return render_template(
        'patient/dashboard.html',
        current_time=current_time,
        next_appointment=next_appointment,
        recent_messages=recent_messages,
        unread_messages_count=unread_messages_count,
        latest_prescription=latest_prescription,
        upcoming_appointments=upcoming_appointments,
        past_appointments=past_appointments
    )

@patient_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    if request.method == 'POST':
        try:
            # Traitement de la photo de profil
            if 'avatar' in request.files:
                avatar_file = request.files['avatar']
                if avatar_file.filename != '':
                    # S'assurer que le dossier existe
                    import os
                    from werkzeug.utils import secure_filename

                    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    avatar_dir = os.path.join(base_dir, 'static', 'uploads', 'avatars')
                    if not os.path.exists(avatar_dir):
                        os.makedirs(avatar_dir)

                    # Sauvegarder le fichier avec un nom unique basé sur l'horodatage
                    import time
                    timestamp = int(time.time())
                    filename = f"{timestamp}_{secure_filename(avatar_file.filename)}"
                    avatar_path = os.path.join(avatar_dir, filename)
                    avatar_file.save(avatar_path)

                    # Mettre à jour le chemin dans la base de données (chemin relatif)
                    current_user.patient.profile_picture = f"uploads/avatars/{filename}"

                    # Journaliser pour le débogage
                    print(f"Photo de profil enregistrée : {avatar_path}")
                    print(f"Chemin relatif enregistré en base : {current_user.patient.profile_picture}")

                    # Enregistrer les modifications dans la base de données
                    db.session.commit()

                    flash('Photo de profil mise à jour avec succès !', 'success')
                    return redirect(url_for('patient.profile'))

            # Si on arrive ici, c'est qu'il n'y a pas eu d'upload de photo
            flash('Aucune photo sélectionnée.', 'warning')

        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors de la mise à jour de la photo de profil : {str(e)}")
            flash(f'Une erreur est survenue lors de la mise à jour de la photo de profil : {str(e)}', 'danger')

    return render_template('patient/profile.html')

@patient_bp.route('/edit-profile', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    patient = current_user.patient

    if request.method == 'POST':
        try:
            # Récupérer les données du formulaire
            current_user.first_name = request.form.get('first_name')
            current_user.last_name = request.form.get('last_name')
            current_user.email = request.form.get('email')

            # Informations personnelles
            if request.form.get('birth_date'):
                from datetime import datetime
                patient.birth_date = datetime.strptime(request.form.get('birth_date'), '%Y-%m-%d').date()
            patient.gender = request.form.get('gender')
            patient.phone = request.form.get('phone')
            patient.address = request.form.get('address')
            patient.id_number = request.form.get('id_number')
            patient.insurance = request.form.get('insurance')

            # Informations médicales
            patient.blood_type = request.form.get('blood_type')
            patient.allergies = request.form.get('allergies')
            patient.chronic_diseases = request.form.get('chronic_diseases')
            patient.current_medications = request.form.get('current_medications')

            # Contact d'urgence
            patient.emergency_contact_name = request.form.get('emergency_contact_name')
            patient.emergency_contact_phone = request.form.get('emergency_contact_phone')
            patient.social_security_number = request.form.get('social_security_number')

            # Enregistrer les modifications
            db.session.commit()

            flash('Profil mis à jour avec succès !', 'success')
            return redirect(url_for('patient.profile'))

        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors de la mise à jour du profil : {str(e)}")
            flash(f'Une erreur est survenue lors de la mise à jour du profil : {str(e)}', 'danger')

    return render_template('patient/edit_profile.html', patient=patient)

@patient_bp.route('/find-doctor')
@login_required
def find_doctor():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer les médecins qui ont des disponibilités
    today = date.today()

    # Journaliser la date actuelle pour le débogage
    print(f"Recherche de médecins disponibles à partir de la date: {today}")

    # Vérifier d'abord s'il y a des disponibilités dans la base de données
    availability_count = Availability.query.filter(
        Availability.date >= today,
        Availability.status == 'available'
    ).count()
    print(f"Nombre total de créneaux disponibles dans la base de données: {availability_count}")

    # Sous-requête pour trouver les médecins avec des disponibilités futures
    # Utiliser une jointure externe pour inclure également les médecins qui ont des jours disponibles
    # mais pas encore de créneaux spécifiques dans la table Availability
    doctors_query = db.session.query(Doctor).outerjoin(
        Availability, Doctor.id == Availability.doctor_id
    ).filter(
        db.or_(
            db.and_(Availability.date >= today, Availability.status == 'available'),
            Doctor.available_days != None  # Inclure les médecins qui ont des jours disponibles
        )
    ).group_by(Doctor.id)

    # Récupérer les spécialités uniques pour le filtre
    specialities = db.session.query(Doctor.speciality).distinct().all()
    specialities = [s[0] for s in specialities if s[0]]  # Filtrer les valeurs None

    # Appliquer les filtres
    # 1. Filtre par spécialité
    speciality = request.args.get('speciality')
    if speciality:
        doctors_query = doctors_query.filter(Doctor.speciality == speciality)

    # 2. Filtre par tarif maximum
    max_fee = request.args.get('max_fee')
    if max_fee and max_fee.isdigit():
        doctors_query = doctors_query.filter(Doctor.consultation_fee <= int(max_fee))

    # 3. Filtre par disponibilité
    availability_filter = request.args.get('availability')
    if availability_filter:
        from datetime import timedelta

        if availability_filter == 'today':
            doctors_query = doctors_query.filter(
                db.or_(
                    Availability.date == today,
                    Doctor.available_days.contains(str(today.weekday() + 1))
                )
            )
        elif availability_filter == 'tomorrow':
            tomorrow = today + timedelta(days=1)
            doctors_query = doctors_query.filter(
                db.or_(
                    Availability.date == tomorrow,
                    Doctor.available_days.contains(str(tomorrow.weekday() + 1))
                )
            )
        elif availability_filter == 'this_week':
            # Calculer le début et la fin de la semaine actuelle
            start_of_week = today - timedelta(days=today.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            doctors_query = doctors_query.filter(
                db.or_(
                    db.and_(Availability.date >= start_of_week, Availability.date <= end_of_week),
                    Doctor.available_days != None  # Tous les médecins avec des jours disponibles
                )
            )
        elif availability_filter == 'next_week':
            # Calculer le début et la fin de la semaine prochaine
            start_of_week = today - timedelta(days=today.weekday()) + timedelta(days=7)
            end_of_week = start_of_week + timedelta(days=6)
            doctors_query = doctors_query.filter(
                db.or_(
                    db.and_(Availability.date >= start_of_week, Availability.date <= end_of_week),
                    Doctor.available_days != None  # Tous les médecins avec des jours disponibles
                )
            )

    # 4. Recherche par nom
    search_query = request.args.get('search')
    if search_query:
        search_term = f"%{search_query}%"
        doctors_query = doctors_query.join(User, Doctor.user_id == User.id).filter(
            db.or_(
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
                db.func.concat(User.first_name, ' ', User.last_name).ilike(search_term)
            )
        )

    # Exécuter la requête
    doctors = doctors_query.all()

    # Journaliser les résultats pour le débogage
    print(f"Nombre de médecins trouvés: {len(doctors)}")
    for doctor in doctors:
        print(f"- Dr. {doctor.user.first_name} {doctor.user.last_name} (ID: {doctor.id})")
        print(f"  - Jours disponibles: {doctor.available_days}")
        print(f"  - Heures disponibles: {doctor.available_hours}")

        # Compter les disponibilités pour ce médecin
        avail_count = Availability.query.filter(
            Availability.doctor_id == doctor.id,
            Availability.date >= today,
            Availability.status == 'available'
        ).count()
        print(f"  - Nombre de créneaux disponibles: {avail_count}")

    return render_template('patient/find_doctor.html',
                          doctors=doctors,
                          specialities=specialities,
                          selected_speciality=speciality)

@patient_bp.route('/doctor-availability/<int:doctor_id>')
@login_required
def doctor_availability(doctor_id):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    doctor = Doctor.query.get_or_404(doctor_id)

    # Log pour le débogage
    print(f"Récupération des disponibilités pour le médecin {doctor_id} (Dr. {doctor.user.first_name} {doctor.user.last_name})")
    print(f"- Jours disponibles: {doctor.available_days}")
    print(f"- Heures disponibles: {doctor.available_hours}")

    # Récupérer les disponibilités futures du médecin
    today = date.today()
    print(f"- Date d'aujourd'hui: {today}")

    # Compter toutes les disponibilités (pour le débogage)
    all_availabilities_count = Availability.query.filter(
        Availability.doctor_id == doctor_id,
        Availability.date >= today
    ).count()
    print(f"- Nombre total de créneaux (tous statuts): {all_availabilities_count}")

    # Récupérer uniquement les disponibilités avec statut 'available'
    availabilities = Availability.query.filter(
        Availability.doctor_id == doctor_id,
        Availability.date >= today,
        Availability.status == 'available'
    ).order_by(Availability.date, Availability.start_time).all()

    print(f"- Nombre de créneaux disponibles: {len(availabilities)}")

    # Nous ne générons plus de disponibilités temporaires
    # Nous n'affichons que les disponibilités explicitement définies par le médecin
    if len(availabilities) == 0:
        print("Aucune disponibilité trouvée pour ce médecin")
        flash("Ce médecin n'a pas encore défini de disponibilités. Veuillez réessayer ultérieurement.", "info")

    # Organiser les disponibilités par date
    availability_by_date = {}
    for avail in availabilities:
        date_str = avail.date.strftime('%Y-%m-%d')
        if date_str not in availability_by_date:
            availability_by_date[date_str] = []
        availability_by_date[date_str].append(avail)
        print(f"  - Créneau disponible: {date_str} {avail.start_time.strftime('%H:%M')}-{avail.end_time.strftime('%H:%M')}")

    return render_template('patient/doctor_availability.html',
                          doctor=doctor,
                          availability_by_date=availability_by_date)

@patient_bp.route('/book-appointment/<int:availability_id>', methods=['GET', 'POST'])
@login_required
def book_appointment(availability_id):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer la disponibilité normale depuis la base de données
    availability = Availability.query.get_or_404(availability_id)
    doctor = Doctor.query.get_or_404(availability.doctor_id)

    # Vérifier que la disponibilité est toujours disponible
    if availability.status != 'available':
        flash('Ce créneau n\'est plus disponible.', 'danger')
        return redirect(url_for('patient.doctor_availability', doctor_id=doctor.id))

    if request.method == 'POST':
        try:
            # Créer un rendez-vous à partir de la disponibilité
            appointment_datetime = datetime.combine(availability.date, availability.start_time)

            # Créer le rendez-vous
            appointment = Appointment(
                patient_id=current_user.patient.id,
                doctor_id=doctor.id,
                date_time=appointment_datetime,
                status='pending',
                notes=request.form.get('notes', '')
            )

            # Mettre à jour le statut de la disponibilité
            availability.status = 'booked'

            db.session.add(appointment)
            db.session.commit()

            # Envoyer une notification au médecin
            from socket_events import send_notification, send_appointment_update
            doctor_user_id = doctor.user_id
            formatted_date = appointment_datetime.strftime('%d/%m/%Y à %H:%M')
            notification_title = "Nouvelle demande de rendez-vous"
            notification_content = f"Nouveau rendez-vous de la part de {current_user.first_name} {current_user.last_name} pour le {formatted_date}"

            send_notification(
                user_id=doctor_user_id,
                title=notification_title,
                content=notification_content,
                notification_type="appointment",
                related_id=appointment.id
            )

            # Envoyer une mise à jour en temps réel du rendez-vous
            send_appointment_update(appointment.id)

            flash('Votre rendez-vous a été réservé avec succès ! Le médecin doit maintenant confirmer.', 'success')
            return redirect(url_for('patient.appointments'))

        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors de la réservation du rendez-vous: {str(e)}")
            flash(f'Une erreur est survenue lors de la réservation: {str(e)}', 'danger')
            return redirect(url_for('patient.doctor_availability', doctor_id=doctor.id))

    return render_template('patient/book_appointment.html',
                          doctor=doctor,
                          availability=availability)

@patient_bp.route('/book-temp-appointment/<int:doctor_id>/<string:date_str>/<int:start_hour>', methods=['GET', 'POST'])
@login_required
def book_temp_appointment(doctor_id, date_str, start_hour):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    try:
        # Reconstruire la date et l'heure
        date_obj = datetime.strptime(date_str, '%Y%m%d').date()
        start_time = datetime.strptime(f"{start_hour}:00", '%H:%M').time()
        end_time = datetime.strptime(f"{start_hour+1}:00", '%H:%M').time()

        # Récupérer le médecin
        doctor = Doctor.query.get_or_404(doctor_id)

        # Vérifier si une disponibilité existe déjà pour ce créneau
        existing_availability = Availability.query.filter_by(
            doctor_id=doctor.id,
            date=date_obj,
            start_time=start_time,
            end_time=end_time
        ).first()

        if existing_availability:
            # Utiliser la disponibilité existante
            if existing_availability.status != 'available':
                flash('Ce créneau n\'est plus disponible.', 'danger')
                return redirect(url_for('patient.doctor_availability', doctor_id=doctor.id))

            # Rediriger vers la route normale avec l'ID de la disponibilité existante
            return redirect(url_for('patient.book_appointment', availability_id=existing_availability.id))

        # Créer une disponibilité temporaire
        availability = Availability(
            doctor_id=doctor_id,
            date=date_obj,
            start_time=start_time,
            end_time=end_time,
            status='available'
        )

        # Sauvegarder la nouvelle disponibilité
        db.session.add(availability)
        db.session.commit()

        # Rediriger vers la route normale avec l'ID de la nouvelle disponibilité
        return redirect(url_for('patient.book_appointment', availability_id=availability.id))

    except Exception as e:
        print(f"Erreur lors de la reconstruction de la disponibilité temporaire: {str(e)}")
        flash('Disponibilité invalide.', 'danger')
        return redirect(url_for('patient.find_doctor'))

@patient_bp.route('/sensor-guide')
@login_required
def sensor_guide():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer les capteurs du patient
    sensors = Sensor.query.filter_by(patient_id=current_user.patient.id).all()

    # Récupérer les dernières mesures de signaux vitaux
    latest_vitals = {}
    vital_types = ['heartrate', 'blood_pressure', 'temperature', 'oxygen']

    for vital_type in vital_types:
        latest_vital = VitalSign.query.filter_by(
            patient_id=current_user.patient.id,
            type=vital_type
        ).order_by(VitalSign.timestamp.desc()).first()

        if latest_vital:
            latest_vitals[vital_type] = latest_vital

    # Récupérer les seuils personnalisés
    thresholds = VitalSignThreshold.query.filter_by(
        patient_id=current_user.patient.id
    ).all()

    # Convertir les seuils en dictionnaire pour un accès facile
    thresholds_dict = {threshold.type: threshold for threshold in thresholds}

    return render_template(
        'patient/sensor_guide.html',
        sensors=sensors,
        latest_vitals=latest_vitals,
        thresholds=thresholds_dict
    )

@patient_bp.route('/request_appointment/<int:doctor_id>', methods=['GET', 'POST'])
@login_required
def request_appointment(doctor_id):
    if current_user.role != 'patient':
        flash('Access denied. You must be a patient to view this page.', 'danger')
        return redirect(url_for('index'))

    doctor = Doctor.query.get_or_404(doctor_id)

    if request.method == 'POST':
        # Get form data
        date_str = request.form.get('date')
        time_str = request.form.get('time')

        # Convert to datetime
        date_time_str = f"{date_str} {time_str}"
        date_time = datetime.strptime(date_time_str, '%Y-%m-%d %H:%M')

        # Create new appointment
        appointment = Appointment(
            patient_id=current_user.patient.id,
            doctor_id=doctor.id,
            date_time=date_time,
            status='pending'
        )

        db.session.add(appointment)
        db.session.commit()

        flash('Appointment request sent successfully!', 'success')
        return redirect(url_for('patient.dashboard'))

    return render_template('patient/request_appointment.html', doctor=doctor)

@patient_bp.route('/appointments')
@login_required
def appointments():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    print("\n" + "="*80)
    print("DÉBUT DE LA FONCTION appointments")
    print("="*80)

    # Requête SQL brute pour vérifier tous les rendez-vous
    from sqlalchemy import text
    sql_query = text("""
        SELECT id, date_time, status, video_room_id, video_link
        FROM appointment
        WHERE patient_id = :patient_id
        ORDER BY date_time DESC
    """)
    result = db.session.execute(sql_query, {"patient_id": current_user.patient.id})
    print("\nRésultat de la requête SQL brute pour tous les rendez-vous:")
    for row in result:
        print(f"- ID: {row.id}, Date: {row.date_time}, Statut: {row.status}, Room ID: {row.video_room_id}")

    # Get all appointments using ORM
    appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id
    ).order_by(
        Appointment.date_time.desc()
    ).all()

    # Debug: afficher tous les rendez-vous et leur statut
    print(f"\nRendez-vous trouvés pour le patient {current_user.patient.id} (total: {len(appointments)}):")
    for appt in appointments:
        print(f"- ID: {appt.id}, Date: {appt.date_time}, Statut: {appt.status}, Médecin: {appt.doctor.user.first_name} {appt.doctor.user.last_name}")
        print(f"  Video Room ID: {appt.video_room_id}, Video Link: {appt.video_link}")

    # Vérifier les rendez-vous par statut
    pending_count = sum(1 for a in appointments if a.status == 'pending')
    accepted_count = sum(1 for a in appointments if a.status == 'accepted')
    completed_count = sum(1 for a in appointments if a.status == 'completed')
    rejected_count = sum(1 for a in appointments if a.status == 'rejected')
    cancelled_count = sum(1 for a in appointments if a.status == 'cancelled')

    print(f"\nStatistiques des rendez-vous:")
    print(f"- En attente: {pending_count}")
    print(f"- Acceptés: {accepted_count}")
    print(f"- Terminés: {completed_count}")
    print(f"- Refusés: {rejected_count}")
    print(f"- Annulés: {cancelled_count}")

    # Vérifier si la base de données est cohérente
    print("\nVérification de la cohérence de la base de données")
    anomalies_detected = False
    for appt in appointments:
        if appt.status == 'accepted' and not appt.video_room_id:
            print(f"ANOMALIE: Le rendez-vous {appt.id} est accepté mais n'a pas d'ID de salle vidéo")
            anomalies_detected = True

            # Réparation automatique
            try:
                print(f"Tentative de réparation automatique du rendez-vous {appt.id}...")

                # Générer un identifiant unique pour la salle de visioconférence
                import hashlib

                # Créer un identifiant unique basé sur l'ID du rendez-vous et un timestamp
                unique_id = f"{appt.id}-{int(get_current_time().timestamp())}"
                # Créer un hash court pour l'identifiant de la salle
                room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

                # Stocker l'identifiant de la salle dans la base de données
                appt.video_room_id = room_id

                # Créer les liens de visioconférence
                base_url = request.host_url.rstrip('/')
                video_link = f"{base_url}/video/{room_id}"
                appt.video_link = video_link

                print(f"ID de salle généré: {room_id}")
                print(f"Lien vidéo généré: {video_link}")

                # Enregistrer les modifications
                db.session.commit()
                print(f"Rendez-vous {appt.id} réparé avec succès")

            except Exception as e:
                db.session.rollback()
                print(f"Erreur lors de la réparation du rendez-vous {appt.id}: {str(e)}")

        if appt.status != 'accepted' and appt.video_room_id:
            print(f"ANOMALIE: Le rendez-vous {appt.id} n'est pas accepté mais a un ID de salle vidéo")
            anomalies_detected = True

    if anomalies_detected:
        print("Des anomalies ont été détectées et des tentatives de réparation ont été effectuées.")
        # Rafraîchir la liste des rendez-vous après les réparations
        appointments = Appointment.query.filter_by(
            patient_id=current_user.patient.id
        ).order_by(
            Appointment.date_time.desc()
        ).all()

        # Informer l'utilisateur que des réparations ont été effectuées
        flash('Des problèmes ont été détectés avec certains de vos rendez-vous et ont été automatiquement réparés. Si vous rencontrez encore des problèmes, veuillez cliquer sur le bouton "Réparer les rendez-vous" en haut de la page.', 'info')

    # Pass current datetime to template for comparison
    now = get_current_time_naive()
    print(f"\nHeure actuelle: {now}")

    print("\nFIN DE LA FONCTION appointments")
    print("="*80 + "\n")

    return render_template('patient/appointments.html', appointments=appointments, now=now)

@patient_bp.route('/cancel-appointment/<int:appointment_id>')
@login_required
def cancel_appointment(appointment_id):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient à l'utilisateur connecté
    if appointment.patient_id != current_user.patient.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('patient.appointments'))

    # Vérifier que le rendez-vous est en attente
    if appointment.status != 'pending':
        flash('Vous ne pouvez annuler que les rendez-vous en attente de confirmation.', 'warning')
        return redirect(url_for('patient.appointments'))

    # Mettre à jour le statut du rendez-vous
    appointment.status = 'cancelled'

    # Remettre la disponibilité à "available"
    availability = Availability.query.filter_by(
        doctor_id=appointment.doctor_id,
        date=appointment.date_time.date(),
        start_time=appointment.date_time.time()
    ).first()

    if availability:
        availability.status = 'available'

    db.session.commit()

    # Envoyer une notification au médecin
    from socket_events import send_notification, send_appointment_update
    doctor_user_id = appointment.doctor.user_id
    formatted_date = appointment.date_time.strftime('%d/%m/%Y à %H:%M')
    notification_title = "Rendez-vous annulé"
    notification_content = f"Le rendez-vous avec {current_user.first_name} {current_user.last_name} pour le {formatted_date} a été annulé par le patient."

    send_notification(
        user_id=doctor_user_id,
        title=notification_title,
        content=notification_content,
        notification_type="appointment_cancelled",
        related_id=appointment.id
    )

    # Envoyer une mise à jour en temps réel du rendez-vous
    send_appointment_update(appointment.id)

    flash('Votre rendez-vous a été annulé avec succès.', 'success')
    return redirect(url_for('patient.appointments'))

@patient_bp.route('/consultation/<int:appointment_id>')
@login_required
def consultation(appointment_id):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au patient connecté
    if appointment.patient_id != current_user.patient.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('patient.dashboard'))

    # Vérifier que le rendez-vous est accepté
    if appointment.status != 'accepted':
        flash('Ce rendez-vous n\'a pas encore été accepté par le médecin.', 'warning')
        return redirect(url_for('patient.dashboard'))

    # Vérifier que le lien de visioconférence existe
    if not appointment.video_link:
        flash('Le lien de visioconférence n\'a pas encore été généré par le médecin.', 'warning')
        return redirect(url_for('patient.appointments'))

    return render_template('patient/consultation.html', appointment=appointment)

@patient_bp.route('/doctor-patient-space')
@login_required
def doctor_patient_space():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    print("\n" + "="*80)
    print("DÉBUT DE LA FONCTION doctor_patient_space")
    print("="*80)

    # Récupérer les paramètres d'URL pour la consultation vidéo
    appointment_id = request.args.get('appointment_id')
    room_id = request.args.get('room_id')

    print(f"Paramètres d'URL: appointment_id={appointment_id}, room_id={room_id}")

    # Vérifier si nous avons un rendez-vous spécifique à afficher pour la vidéo
    current_appointment = None
    if appointment_id:
        print(f"Recherche du rendez-vous avec ID={appointment_id} pour le patient {current_user.patient.id}")
        current_appointment = Appointment.query.filter_by(
            id=appointment_id,
            patient_id=current_user.patient.id
        ).first()

        if current_appointment:
            print(f"Rendez-vous trouvé: ID={current_appointment.id}, Statut={current_appointment.status}, Room ID={current_appointment.video_room_id}")

            # Si l'ID de salle est fourni dans l'URL mais manquant ou différent dans la base de données
            if room_id:
                if not current_appointment.video_room_id:
                    # Si l'ID de salle est manquant dans la base de données, l'ajouter
                    print(f"Ajout de l'ID de salle manquant: {room_id}")
                    current_appointment.video_room_id = room_id

                    # Créer également le lien vidéo s'il est manquant
                    if not current_appointment.video_link:
                        base_url = request.host_url.rstrip('/')
                        video_link = f"{base_url}/video/{room_id}"
                        current_appointment.video_link = video_link
                        print(f"Ajout du lien vidéo manquant: {video_link}")

                    db.session.commit()
                    print(f"ID de salle et lien vidéo ajoutés pour le rendez-vous {appointment_id}")
                elif current_appointment.video_room_id != room_id:
                    # Si l'ID de salle ne correspond pas, mettre à jour l'ID de salle
                    print(f"Mise à jour de l'ID de salle: {current_appointment.video_room_id} -> {room_id}")
                    current_appointment.video_room_id = room_id

                    # Mettre à jour également le lien vidéo
                    base_url = request.host_url.rstrip('/')
                    video_link = f"{base_url}/video/{room_id}"
                    current_appointment.video_link = video_link
                    print(f"Mise à jour du lien vidéo: {video_link}")

                    db.session.commit()
                    print(f"ID de salle et lien vidéo mis à jour pour le rendez-vous {appointment_id}")
        else:
            print(f"Aucun rendez-vous trouvé avec ID={appointment_id}")
            flash('Rendez-vous non trouvé. Veuillez sélectionner un rendez-vous valide.', 'danger')
            return redirect(url_for('patient.appointments'))

    # Récupérer tous les rendez-vous du patient pour le débogage
    print("\nRécupération de tous les rendez-vous du patient")
    all_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id
    ).all()

    print(f"Tous les rendez-vous du patient {current_user.patient.id} (total: {len(all_appointments)}):")
    for appt in all_appointments:
        print(f"- ID: {appt.id}, Date: {appt.date_time}, Statut: {appt.status}, Médecin: {appt.doctor.user.first_name} {appt.doctor.user.last_name}")
        print(f"  Video Room ID: {appt.video_room_id}, Video Link: {appt.video_link}")

    # Récupérer les rendez-vous acceptés à venir
    print("\nRécupération des rendez-vous acceptés à venir")
    current_time = get_current_time_naive()
    print(f"Heure actuelle: {current_time}")

    # Requête SQL brute pour vérifier les rendez-vous acceptés
    from sqlalchemy import text
    sql_query = text("""
        SELECT id, date_time, status, video_room_id, video_link
        FROM appointment
        WHERE patient_id = :patient_id AND status = 'accepted'
    """)
    result = db.session.execute(sql_query, {"patient_id": current_user.patient.id})
    print("\nRésultat de la requête SQL brute pour les rendez-vous acceptés:")
    for row in result:
        print(f"- ID: {row.id}, Date: {row.date_time}, Statut: {row.status}, Room ID: {row.video_room_id}")

    # Requête ORM normale - Récupérer tous les rendez-vous acceptés, peu importe la date
    upcoming_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='accepted'
    ).order_by(
        Appointment.date_time
    ).all()

    print(f"\nRendez-vous acceptés à venir pour le patient {current_user.patient.id} (total: {len(upcoming_appointments)}):")
    for appt in upcoming_appointments:
        print(f"- ID: {appt.id}, Date: {appt.date_time}, Médecin: {appt.doctor.user.first_name} {appt.doctor.user.last_name}")
        print(f"  Video Room ID: {appt.video_room_id}, Video Link: {appt.video_link}")

    # Récupérer les rendez-vous passés (uniquement ceux marqués comme terminés)
    print("\nRécupération des rendez-vous passés")
    past_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='completed'
    ).order_by(
        Appointment.date_time.desc()
    ).all()

    print(f"Rendez-vous passés pour le patient {current_user.patient.id} (total: {len(past_appointments)}):")
    for appt in past_appointments:
        print(f"- ID: {appt.id}, Date: {appt.date_time}, Statut: {appt.status}, Médecin: {appt.doctor.user.first_name} {appt.doctor.user.last_name}")

    # Vérifier si la base de données est cohérente
    print("\nVérification de la cohérence de la base de données")
    anomalies_detected = False
    for appt in all_appointments:
        if appt.status == 'accepted' and not appt.video_room_id:
            print(f"ANOMALIE: Le rendez-vous {appt.id} est accepté mais n'a pas d'ID de salle vidéo")
            anomalies_detected = True

            # Réparation automatique
            try:
                print(f"Tentative de réparation automatique du rendez-vous {appt.id}...")

                # Générer un identifiant unique pour la salle de visioconférence
                import hashlib

                # Créer un identifiant unique basé sur l'ID du rendez-vous et un timestamp
                unique_id = f"{appt.id}-{int(get_current_time().timestamp())}"
                # Créer un hash court pour l'identifiant de la salle
                room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

                # Stocker l'identifiant de la salle dans la base de données
                appt.video_room_id = room_id

                # Créer les liens de visioconférence
                base_url = request.host_url.rstrip('/')
                video_link = f"{base_url}/video/{room_id}"
                appt.video_link = video_link

                print(f"ID de salle généré: {room_id}")
                print(f"Lien vidéo généré: {video_link}")

                # Enregistrer les modifications
                db.session.commit()
                print(f"Rendez-vous {appt.id} réparé avec succès")

                # Mettre à jour la liste des rendez-vous à venir
                if appt.date_time >= current_time:
                    upcoming_appointments.append(appt)

            except Exception as e:
                db.session.rollback()
                print(f"Erreur lors de la réparation du rendez-vous {appt.id}: {str(e)}")

        if appt.status != 'accepted' and appt.video_room_id:
            print(f"ANOMALIE: Le rendez-vous {appt.id} n'est pas accepté mais a un ID de salle vidéo")
            anomalies_detected = True

    if anomalies_detected:
        print("Des anomalies ont été détectées et des tentatives de réparation ont été effectuées.")
        # Rafraîchir la liste des rendez-vous à venir après les réparations
        upcoming_appointments = Appointment.query.filter_by(
            patient_id=current_user.patient.id,
            status='accepted'
        ).order_by(
            Appointment.date_time
        ).all()

        # Informer l'utilisateur que des réparations ont été effectuées
        flash('Des problèmes ont été détectés avec certains de vos rendez-vous et ont été automatiquement réparés. Si vous rencontrez encore des problèmes, veuillez cliquer sur le bouton "Réparer les rendez-vous" dans la page des rendez-vous.', 'info')

    print("\nFIN DE LA FONCTION doctor_patient_space")
    print("="*80 + "\n")

    return render_template('patient/doctor_patient_space.html',
                          upcoming_appointments=upcoming_appointments,
                          past_appointments=past_appointments,
                          current_appointment=current_appointment,
                          room_id=room_id,
                          now=current_time)

@patient_bp.route('/view-prescription/<int:appointment_id>')
@login_required
def view_prescription(appointment_id):
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer le rendez-vous
    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au patient connecté
    if appointment.patient_id != current_user.patient.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('patient.doctor_patient_space'))

    # Récupérer la prescription associée au rendez-vous
    prescription = Prescription.query.filter_by(appointment_id=appointment_id).first()

    # Récupérer les notes de consultation
    notes = appointment.notes

    return render_template('patient/view_prescription.html',
                          appointment=appointment,
                          prescription=prescription,
                          notes=notes)

@patient_bp.route('/itinerary')
@login_required
def itinerary():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    return render_template('patient/itinerary.html')

@patient_bp.route('/test-notification')
@login_required
def test_notification():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Envoyer une notification de test
    from socket_events import send_notification

    notification_title = "Notification de test"
    notification_content = "Ceci est une notification de test pour vérifier le système de notifications."

    send_notification(
        user_id=current_user.id,
        title=notification_title,
        content=notification_content,
        notification_type="test",
        related_id=None
    )

    flash('Notification de test envoyée avec succès !', 'success')
    return redirect(url_for('patient.dashboard'))

@patient_bp.route('/test-notification-appointment')
@login_required
def test_notification_appointment():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Envoyer une notification de test pour un rendez-vous
    from socket_events import send_notification

    notification_title = "Nouvelle demande de rendez-vous"
    notification_content = "Votre demande de rendez-vous avec Dr. Martin pour le 15/06/2023 à 14:30 a été envoyée."

    send_notification(
        user_id=current_user.id,
        title=notification_title,
        content=notification_content,
        notification_type="appointment",
        related_id=1  # ID fictif pour le test
    )

    flash('Notification de test pour un rendez-vous envoyée avec succès !', 'success')
    return redirect(url_for('patient.dashboard'))

@patient_bp.route('/test-notification-accepted')
@login_required
def test_notification_accepted():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Envoyer une notification de test pour un rendez-vous accepté
    from socket_events import send_notification

    notification_title = "Rendez-vous confirmé"
    notification_content = "Votre rendez-vous avec Dr. Martin pour le 15/06/2023 à 14:30 a été confirmé."

    send_notification(
        user_id=current_user.id,
        title=notification_title,
        content=notification_content,
        notification_type="appointment_accepted",
        related_id=1  # ID fictif pour le test
    )

    flash('Notification de test pour un rendez-vous accepté envoyée avec succès !', 'success')
    return redirect(url_for('patient.dashboard'))

@patient_bp.route('/test-notification-rejected')
@login_required
def test_notification_rejected():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Envoyer une notification de test pour un rendez-vous refusé
    from socket_events import send_notification

    notification_title = "Rendez-vous refusé"
    notification_content = "Votre rendez-vous avec Dr. Martin pour le 15/06/2023 à 14:30 a été refusé."

    send_notification(
        user_id=current_user.id,
        title=notification_title,
        content=notification_content,
        notification_type="appointment_rejected",
        related_id=1  # ID fictif pour le test
    )

    flash('Notification de test pour un rendez-vous refusé envoyée avec succès !', 'success')
    return redirect(url_for('patient.dashboard'))

@patient_bp.route('/test-notification-reminder')
@login_required
def test_notification_reminder():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Envoyer une notification de test pour un rappel de rendez-vous
    from socket_events import send_notification

    notification_title = "Rendez-vous imminent"
    notification_content = "Votre rendez-vous avec Dr. Martin commence dans 5 minutes à 14:30."

    send_notification(
        user_id=current_user.id,
        title=notification_title,
        content=notification_content,
        notification_type="appointment_reminder",
        related_id=1,  # ID fictif pour le test
        is_urgent=True
    )

    flash('Notification de test pour un rappel de rendez-vous envoyée avec succès !', 'success')
    return redirect(url_for('patient.dashboard'))

@patient_bp.route('/all-notifications')
@login_required
def all_notifications():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer toutes les notifications de l'utilisateur
    from models import Notification

    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(
        Notification.created_at.desc()
    ).all()

    return render_template('patient/all_notifications.html', notifications=notifications)

@patient_bp.route('/test-notifications')
@login_required
def test_notifications():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    return render_template('patient/test_notifications.html')

@patient_bp.route('/repair-appointments')
@login_required
def repair_appointments():
    if current_user.role != 'patient':
        flash('Accès refusé. Vous devez être un patient pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    print("\n" + "="*80)
    print("DÉBUT DE LA FONCTION repair_appointments")
    print("="*80)

    # Récupérer tous les rendez-vous acceptés sans ID de salle vidéo
    problematic_appointments = Appointment.query.filter_by(
        patient_id=current_user.patient.id,
        status='accepted'
    ).filter(
        Appointment.video_room_id == None
    ).all()

    print(f"Rendez-vous problématiques trouvés: {len(problematic_appointments)}")

    # Réparer les rendez-vous problématiques
    repaired_count = 0
    for appt in problematic_appointments:
        try:
            print(f"Réparation du rendez-vous {appt.id}...")

            # Générer un identifiant unique pour la salle de visioconférence
            import hashlib

            # Créer un identifiant unique basé sur l'ID du rendez-vous et un timestamp
            unique_id = f"{appt.id}-{int(get_current_time().timestamp())}"
            # Créer un hash court pour l'identifiant de la salle
            room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

            # Stocker l'identifiant de la salle dans la base de données
            appt.video_room_id = room_id

            # Créer les liens de visioconférence
            base_url = request.host_url.rstrip('/')
            video_link = f"{base_url}/video/{room_id}"
            appt.video_link = video_link

            print(f"ID de salle généré: {room_id}")
            print(f"Lien vidéo généré: {video_link}")

            # Enregistrer les modifications
            db.session.commit()
            repaired_count += 1
            print(f"Rendez-vous {appt.id} réparé avec succès")

        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors de la réparation du rendez-vous {appt.id}: {str(e)}")

    print(f"Réparation terminée. {repaired_count} rendez-vous réparés sur {len(problematic_appointments)}")
    print("\nFIN DE LA FONCTION repair_appointments")
    print("="*80 + "\n")

    if repaired_count > 0:
        flash(f'{repaired_count} rendez-vous ont été réparés avec succès.', 'success')
    else:
        flash('Aucun rendez-vous à réparer.', 'info')

    return redirect(url_for('patient.appointments'))
