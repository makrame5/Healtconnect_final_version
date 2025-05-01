from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import User, Patient, Appointment, Prescription, Availability
from datetime import datetime, date, timedelta
import os, time
from werkzeug.utils import secure_filename
from utils.datetime_utils import get_current_time, get_current_time_naive, format_datetime

doctor_bp = Blueprint('doctor', __name__, url_prefix='/doctor')

@doctor_bp.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Get pending appointment requests
    pending_appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        status='pending'
    ).order_by(
        Appointment.date_time
    ).all()

    # Get upcoming accepted appointments
    upcoming_appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        status='accepted'
    ).filter(
        Appointment.date_time >= get_current_time_naive()
    ).order_by(
        Appointment.date_time
    ).all()

    return render_template('doctor/dashboard.html',
                          pending_appointments=pending_appointments,
                          upcoming_appointments=upcoming_appointments)

@doctor_bp.route('/appointments')
@login_required
def appointments():
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Marquer automatiquement les rendez-vous passés comme "terminés"
    past_appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        status='accepted'
    ).filter(
        Appointment.date_time < get_current_time_naive() - timedelta(minutes=30)  # 30 minutes après l'heure prévue
    ).all()

    # Mettre à jour le statut des rendez-vous passés
    for appt in past_appointments:
        appt.status = 'completed'
        print(f"Rendez-vous {appt.id} marqué comme terminé")

    if past_appointments:
        db.session.commit()
        print(f"{len(past_appointments)} rendez-vous marqués comme terminés")

    # Récupérer tous les rendez-vous du médecin
    appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id
    ).order_by(
        Appointment.date_time.desc()
    ).all()

    # Compter les rendez-vous par statut
    pending_count = sum(1 for a in appointments if a.status == 'pending')
    accepted_count = sum(1 for a in appointments if a.status == 'accepted')
    completed_count = sum(1 for a in appointments if a.status == 'completed')
    rejected_count = sum(1 for a in appointments if a.status == 'rejected')
    cancelled_count = sum(1 for a in appointments if a.status == 'cancelled')

    # Passer les données au template
    return render_template('doctor/appointments.html',
                          appointments=appointments,
                          pending_count=pending_count,
                          accepted_count=accepted_count,
                          completed_count=completed_count,
                          rejected_count=rejected_count,
                          cancelled_count=cancelled_count)

# Route pour la suppression en masse des rendez-vous
@doctor_bp.route('/appointments/bulk-delete/<string:category>', methods=['GET'])
@login_required
def bulk_delete_appointments(category):
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    try:
        # Définir la requête de base pour les rendez-vous du médecin
        query = Appointment.query.filter_by(doctor_id=current_user.doctor.id)

        # Filtrer selon la catégorie
        if category == 'completed':
            appointments = query.filter_by(status='completed').all()
            category_name = "terminés"
        elif category == 'rejected':
            appointments = query.filter_by(status='rejected').all()
            category_name = "refusés"
        elif category == 'cancelled':
            appointments = query.filter_by(status='cancelled').all()
            category_name = "annulés"
        elif category == 'old':
            # Rendez-vous de plus de 30 jours
            thirty_days_ago = datetime.now() - timedelta(days=30)
            appointments = query.filter(Appointment.date_time < thirty_days_ago).all()
            category_name = "datant de plus de 30 jours"
        else:
            flash('Catégorie de suppression invalide.', 'danger')
            return redirect(url_for('doctor.appointments'))

        if not appointments:
            flash(f'Aucun rendez-vous {category_name} à supprimer.', 'info')
            return redirect(url_for('doctor.appointments'))

        # Importer les modèles nécessaires
        from models import Message, ConsultationNote, SharedFile, Prescription, Notification

        # Compter le nombre de rendez-vous à supprimer
        count = len(appointments)

        # Supprimer les objets liés et les rendez-vous
        for appointment in appointments:
            appointment_id = appointment.id

            # 1. Supprimer les messages liés à ce rendez-vous
            messages = Message.query.filter_by(appointment_id=appointment_id).all()
            for message in messages:
                db.session.delete(message)

            # 2. Supprimer les notes de consultation liées à ce rendez-vous
            notes = ConsultationNote.query.filter_by(appointment_id=appointment_id).all()
            for note in notes:
                db.session.delete(note)

            # 3. Supprimer les fichiers partagés liés à ce rendez-vous
            files = SharedFile.query.filter_by(appointment_id=appointment_id).all()
            for file in files:
                db.session.delete(file)

            # 4. Mettre à jour les prescriptions liées à ce rendez-vous (ne pas les supprimer)
            prescriptions = Prescription.query.filter_by(appointment_id=appointment_id).all()
            for prescription in prescriptions:
                prescription.appointment_id = None
                db.session.add(prescription)

            # 5. Supprimer les notifications liées à ce rendez-vous
            notification_types = ['appointment_created', 'appointment_accepted', 'appointment_rejected', 'appointment_reminder']
            notifications = Notification.query.filter(
                Notification.related_id == appointment_id,
                Notification.type.in_(notification_types)
            ).all()
            for notification in notifications:
                db.session.delete(notification)

            # 6. Libérer la disponibilité si elle existe
            try:
                availability = Availability.query.filter_by(
                    doctor_id=current_user.doctor.id,
                    date=appointment.date_time.date(),
                    start_time=appointment.date_time.time()
                ).first()

                if availability and appointment.status != 'accepted':
                    availability.status = 'available'
                    db.session.add(availability)
            except Exception as e:
                print(f"Erreur lors de la mise à jour de la disponibilité: {str(e)}")

            # 7. Supprimer le rendez-vous
            db.session.delete(appointment)

        # Commit des changements
        db.session.commit()

        flash(f'{count} rendez-vous {category_name} ont été supprimés avec succès.', 'success')

    except Exception as e:
        db.session.rollback()
        print(f"Erreur lors de la suppression en masse des rendez-vous: {str(e)}")
        flash(f'Une erreur est survenue lors de la suppression des rendez-vous: {str(e)}', 'danger')

    return redirect(url_for('doctor.appointments'))

@doctor_bp.route('/appointment/<int:appointment_id>/<string:action>', methods=['GET', 'POST'])
@login_required
def appointment_action(appointment_id, action):
    print(f"Fonction appointment_action appelée avec appointment_id={appointment_id}, action={action}, méthode={request.method}")

    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au médecin connecté
    if appointment.doctor_id != current_user.doctor.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('doctor.appointments'))

    patient = appointment.patient
    patient_user = patient.user
    formatted_date = appointment.date_time.strftime('%d/%m/%Y à %H:%M')

    if action == 'accept':
        appointment.status = 'accepted'

        # Générer un identifiant unique pour la salle de visioconférence
        import uuid
        import hashlib

        # Créer un identifiant unique basé sur l'ID du rendez-vous et un timestamp
        unique_id = f"{appointment.id}-{int(get_current_time().timestamp())}"
        # Créer un hash court pour l'identifiant de la salle
        room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

        # Stocker l'identifiant de la salle dans la base de données
        appointment.video_room_id = room_id

        # Créer les liens de visioconférence pour le médecin et le patient
        base_url = request.host_url.rstrip('/')
        video_link = f"{base_url}/video/{room_id}"
        appointment.video_link = video_link

        # Journaliser les détails du rendez-vous accepté
        print(f"Rendez-vous accepté - ID: {appointment.id}, Room ID: {room_id}, Video Link: {video_link}")
        print(f"Statut du rendez-vous: {appointment.status}")
        print(f"Patient ID: {appointment.patient_id}, Médecin ID: {appointment.doctor_id}")
        print(f"Date et heure: {appointment.date_time}")

        # S'assurer que les modifications sont bien enregistrées dans la base de données
        try:
            db.session.commit()
            print(f"Modifications enregistrées avec succès dans la base de données")

            # Vérifier que les modifications ont bien été appliquées
            updated_appointment = Appointment.query.get(appointment.id)
            print(f"Vérification après commit - Statut: {updated_appointment.status}, Room ID: {updated_appointment.video_room_id}")

            flash('Rendez-vous accepté avec succès !', 'success')

            # Envoyer une notification au patient avec le lien de visioconférence
            from socket_events import send_notification, send_appointment_update
            notification_title = "Rendez-vous confirmé"
            notification_content = f"Votre rendez-vous avec Dr. {current_user.first_name} {current_user.last_name} pour le {formatted_date} a été confirmé. Un lien de visioconférence a été généré."

            send_notification(
                user_id=patient_user.id,
                title=notification_title,
                content=notification_content,
                notification_type="appointment_accepted",
                related_id=appointment.id
            )

            # Envoyer une mise à jour en temps réel du rendez-vous
            send_appointment_update(appointment.id)
        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors de l'enregistrement des modifications: {str(e)}")
            flash(f'Une erreur est survenue lors de l\'acceptation du rendez-vous: {str(e)}', 'danger')

    elif action == 'reject':
        appointment.status = 'rejected'

        # Remettre la disponibilité à "available"
        availability = Availability.query.filter_by(
            doctor_id=current_user.doctor.id,
            date=appointment.date_time.date(),
            start_time=appointment.date_time.time()
        ).first()

        if availability:
            availability.status = 'available'

        # Enregistrer les modifications dans la base de données
        try:
            db.session.commit()
            print(f"Rendez-vous {appointment.id} refusé avec succès")

            # Vérifier que les modifications ont bien été appliquées
            updated_appointment = Appointment.query.get(appointment.id)
            print(f"Vérification après commit - Statut: {updated_appointment.status}")

            flash('Rendez-vous refusé.', 'info')

            # Envoyer une notification au patient
            from socket_events import send_notification, send_appointment_update
            notification_title = "Rendez-vous refusé"
            notification_content = f"Votre rendez-vous avec Dr. {current_user.first_name} {current_user.last_name} pour le {formatted_date} a été refusé."

            send_notification(
                user_id=patient_user.id,
                title=notification_title,
                content=notification_content,
                notification_type="appointment_rejected",
                related_id=appointment.id
            )

            # Envoyer une mise à jour en temps réel du rendez-vous
            send_appointment_update(appointment.id)
        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors du refus du rendez-vous: {str(e)}")
            flash(f'Une erreur est survenue lors du refus du rendez-vous: {str(e)}', 'danger')
    elif action == 'complete':
        appointment.status = 'completed'

        # Enregistrer les modifications dans la base de données
        try:
            db.session.commit()
            print(f"Rendez-vous {appointment.id} marqué comme terminé avec succès")

            # Vérifier que les modifications ont bien été appliquées
            updated_appointment = Appointment.query.get(appointment.id)
            print(f"Vérification après commit - Statut: {updated_appointment.status}")

            flash('Rendez-vous marqué comme terminé.', 'success')

            # Envoyer une notification au patient
            from socket_events import send_notification, send_appointment_update
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
        except Exception as e:
            db.session.rollback()
            print(f"Erreur lors du marquage du rendez-vous comme terminé: {str(e)}")
            flash(f'Une erreur est survenue lors du marquage du rendez-vous comme terminé: {str(e)}', 'danger')
    elif action == 'delete':
        print(f"Action 'delete' détectée pour le rendez-vous {appointment_id}")
        try:
            # Vérifier si le rendez-vous peut être supprimé
            print(f"Statut du rendez-vous: {appointment.status}")
            if appointment.status in ['accepted', 'rejected', 'cancelled', 'completed']:
                # Stocker les informations nécessaires avant de supprimer l'objet
                appointment_id = appointment.id
                patient_id = appointment.patient_id if appointment.patient else None
                patient_user_id = patient_user.id if patient_user else None

                # Vérifier et supprimer les objets liés qui pourraient causer des problèmes
                from models import Message, ConsultationNote, SharedFile, Prescription, Notification

                # 1. Supprimer les messages liés à ce rendez-vous
                messages = Message.query.filter_by(appointment_id=appointment_id).all()
                for message in messages:
                    db.session.delete(message)

                # 2. Supprimer les notes de consultation liées à ce rendez-vous
                notes = ConsultationNote.query.filter_by(appointment_id=appointment_id).all()
                for note in notes:
                    db.session.delete(note)

                # 3. Supprimer les fichiers partagés liés à ce rendez-vous
                files = SharedFile.query.filter_by(appointment_id=appointment_id).all()
                for file in files:
                    db.session.delete(file)

                # 4. Mettre à jour les prescriptions liées à ce rendez-vous (ne pas les supprimer)
                prescriptions = Prescription.query.filter_by(appointment_id=appointment_id).all()
                for prescription in prescriptions:
                    prescription.appointment_id = None
                    db.session.add(prescription)

                # 5. Supprimer les notifications liées à ce rendez-vous
                notification_types = ['appointment_created', 'appointment_accepted', 'appointment_rejected', 'appointment_reminder']
                notifications = Notification.query.filter(
                    Notification.related_id == appointment_id,
                    Notification.type.in_(notification_types)
                ).all()
                for notification in notifications:
                    db.session.delete(notification)

                # Faire un commit intermédiaire pour s'assurer que les objets liés sont supprimés
                db.session.commit()

                # Libérer la disponibilité si elle existe
                try:
                    availability = Availability.query.filter_by(
                        doctor_id=current_user.doctor.id,
                        date=appointment.date_time.date(),
                        start_time=appointment.date_time.time()
                    ).first()

                    if availability and appointment.status != 'accepted':
                        availability.status = 'available'
                        db.session.add(availability)
                except Exception as e:
                    print(f"Erreur lors de la mise à jour de la disponibilité: {str(e)}")
                    # Continuer même si la mise à jour de la disponibilité échoue

                # Supprimer le rendez-vous
                db.session.delete(appointment)

                # Commit final pour enregistrer toutes les modifications
                db.session.commit()

                flash('Rendez-vous supprimé avec succès.', 'success')

                # Envoyer une notification au patient seulement si nous avons son ID
                if patient_user_id:
                    try:
                        from socket_events import send_notification
                        notification_title = "Rendez-vous supprimé"
                        notification_content = f"Votre rendez-vous avec Dr. {current_user.first_name} {current_user.last_name} pour le {formatted_date} a été supprimé."

                        send_notification(
                            user_id=patient_user_id,
                            title=notification_title,
                            content=notification_content,
                            notification_type="appointment_deleted",
                            related_id=appointment_id
                        )
                    except Exception as e:
                        print(f"Erreur lors de l'envoi de la notification: {str(e)}")
                        # Ne pas échouer si l'envoi de notification échoue
            else:
                flash('Ce rendez-vous ne peut pas être supprimé.', 'danger')

            # Récupérer le statut du rendez-vous pour la redirection
            tab = 'pending'  # Par défaut
            if appointment.status == 'accepted':
                tab = 'accepted'
            elif appointment.status == 'completed':
                tab = 'completed'
            elif appointment.status in ['rejected', 'cancelled']:
                tab = 'rejected'

            # Retourner immédiatement pour éviter le commit global à la fin de la fonction
            return redirect(url_for('doctor.appointments') + f'#tab={tab}')

        except Exception as e:
            # En cas d'erreur, annuler la transaction
            db.session.rollback()
            print(f"Erreur lors de la suppression du rendez-vous: {str(e)}")
            flash(f'Une erreur est survenue lors de la suppression du rendez-vous: {str(e)}', 'danger')
    else:
        flash('Action invalide !', 'danger')
        return redirect(url_for('doctor.appointments'))

    # Le commit est maintenant géré dans chaque bloc d'action
    # pour éviter les problèmes de transaction

    # Vérifier si le rendez-vous a été correctement enregistré
    if action == 'accept':
        # Vérifier que le rendez-vous a bien été accepté et qu'il a un ID de salle vidéo
        updated_appointment = Appointment.query.get(appointment.id)
        if updated_appointment.status == 'accepted' and not updated_appointment.video_room_id:
            print(f"ANOMALIE DÉTECTÉE: Le rendez-vous {appointment.id} est accepté mais n'a pas d'ID de salle vidéo")
            try:
                # Générer un nouvel ID de salle vidéo
                import hashlib
                unique_id = f"{appointment.id}-{int(get_current_time().timestamp())}"
                room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

                # Stocker l'identifiant de la salle dans la base de données
                updated_appointment.video_room_id = room_id

                # Créer les liens de visioconférence
                base_url = request.host_url.rstrip('/')
                video_link = f"{base_url}/video/{room_id}"
                updated_appointment.video_link = video_link

                # Enregistrer les modifications
                db.session.commit()
                print(f"Réparation automatique du rendez-vous {appointment.id} effectuée avec succès")
                print(f"Nouvel ID de salle: {room_id}, Nouveau lien vidéo: {video_link}")
            except Exception as e:
                db.session.rollback()
                print(f"Erreur lors de la réparation automatique du rendez-vous {appointment.id}: {str(e)}")

    # Rediriger vers la page des rendez-vous
    return redirect(url_for('doctor.appointments'))

@doctor_bp.route('/consultation/<int:appointment_id>')
@login_required
def consultation(appointment_id):
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au médecin connecté
    if appointment.doctor_id != current_user.doctor.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    # Vérifier que le rendez-vous est accepté
    if appointment.status != 'accepted':
        flash('Ce rendez-vous n\'a pas encore été accepté.', 'warning')
        return redirect(url_for('doctor.dashboard'))

    # Si le lien de visioconférence n'existe pas encore, le générer
    if not appointment.video_link or not appointment.video_room_id:
        import hashlib

        # Créer un identifiant unique basé sur l'ID du rendez-vous et un timestamp
        unique_id = f"{appointment.id}-{int(get_current_time().timestamp())}"
        # Créer un hash court pour l'identifiant de la salle
        room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

        # Stocker l'identifiant de la salle dans la base de données
        appointment.video_room_id = room_id

        # Créer le lien de visioconférence
        base_url = request.host_url.rstrip('/')
        video_link = f"{base_url}/video/{room_id}"
        appointment.video_link = video_link

        db.session.commit()

    return render_template('doctor/consultation.html', appointment=appointment)

@doctor_bp.route('/prescription/<int:appointment_id>', methods=['GET', 'POST'])
@login_required
def prescription(appointment_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Check if the appointment belongs to the current user
    if appointment.doctor_id != current_user.doctor.id:
        flash('Access denied. This appointment does not belong to you.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    if request.method == 'POST':
        # Get form data
        content = request.form.get('content')

        # Create new prescription
        prescription = Prescription(
            patient_id=appointment.patient_id,
            doctor_id=current_user.doctor.id,
            appointment_id=appointment.id,
            content=content
        )

        db.session.add(prescription)
        db.session.commit()

        flash('Prescription created successfully!', 'success')
        return redirect(url_for('doctor.consultation', appointment_id=appointment.id))

    return render_template('doctor/prescription.html', appointment=appointment)

@doctor_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    doctor = current_user.doctor

    if request.method == 'POST':
        # Déterminer quelle section du formulaire a été soumise
        form_type = request.form.get('form_type')

        if form_type == 'professional':
            # Mise à jour des informations professionnelles
            current_user.first_name = request.form.get('first_name')
            current_user.last_name = request.form.get('last_name')
            doctor.speciality = request.form.get('primary_specialty')
            doctor.secondary_speciality = request.form.get('secondary_specialty')
            doctor.license_number = request.form.get('registration_number')
            doctor.practice_location = request.form.get('practice_location')
            doctor.years_experience = request.form.get('experience_years')
            doctor.previous_positions = request.form.get('previous_positions')

        elif form_type == 'biography':
            # Mise à jour de la biographie et des langues
            doctor.bio = request.form.get('biography')
            doctor.languages = request.form.get('languages')

        elif form_type == 'contact':
            # Mise à jour des coordonnées
            current_user.email = request.form.get('email')
            doctor.phone = request.form.get('phone')
            doctor.linkedin = request.form.get('linkedin')
            doctor.website = request.form.get('website')

        elif form_type == 'availability':
            # Mise à jour des disponibilités
            old_available_days = doctor.available_days
            old_available_hours = doctor.available_hours

            doctor.available_days = request.form.get('available_days')
            doctor.available_hours = request.form.get('available_hours')
            doctor.video_consultation = request.form.get('video_consultation') == 'on'

            # Log pour le débogage
            print(f"Mise à jour des disponibilités du médecin {doctor.id}:")
            print(f"- Anciens jours disponibles: {old_available_days}")
            print(f"- Nouveaux jours disponibles: {doctor.available_days}")
            print(f"- Anciens heures disponibles: {old_available_hours}")
            print(f"- Nouvelles heures disponibles: {doctor.available_hours}")
            print(f"- Video consultation: {doctor.video_consultation}")

            # Synchroniser avec la table Availability si demandé
            sync_availabilities = request.form.get('sync_availabilities') == 'on'
            if sync_availabilities:
                try:
                    # Utiliser une transaction explicite pour éviter les problèmes de verrouillage
                    today = date.today()

                    # Récupérer les anciennes disponibilités à supprimer
                    to_delete = Availability.query.filter(
                        Availability.doctor_id == doctor.id,
                        Availability.date >= today,
                        Availability.status == 'available'
                    ).all()

                    # Supprimer les disponibilités une par une au lieu d'utiliser delete()
                    for avail in to_delete:
                        db.session.delete(avail)

                    # Créer de nouvelles disponibilités basées sur les jours et heures sélectionnés
                    days = [int(day) for day in doctor.available_days.split(',') if day]
                    hours_ranges = [hr.split('-') for hr in doctor.available_hours.split(',') if hr]

                    # Préparer toutes les nouvelles disponibilités
                    new_availabilities = []

                    # Générer des disponibilités pour les 4 prochaines semaines
                    for i in range(28):  # 4 semaines
                        current_date = today + timedelta(days=i)
                        weekday = current_date.weekday() + 1  # 1 = Lundi, 7 = Dimanche

                        # Vérifier si ce jour de la semaine est disponible
                        if weekday in days:
                            for hour_range in hours_ranges:
                                if len(hour_range) == 2:
                                    start_hour, end_hour = int(hour_range[0]), int(hour_range[1])

                                    # Créer des créneaux d'une heure
                                    for hour in range(start_hour, end_hour):
                                        start_time = time(hour, 0)
                                        end_time = time(hour + 1, 0)

                                        # Vérifier si ce créneau existe déjà (en mémoire pour éviter trop de requêtes)
                                        # Nous ne vérifions que les créneaux réservés, car nous voulons remplacer les créneaux disponibles
                                        exists = False
                                        for existing_avail in Availability.query.filter_by(
                                            doctor_id=doctor.id,
                                            date=current_date
                                        ).all():
                                            if (existing_avail.start_time == start_time and
                                                existing_avail.end_time == end_time):
                                                if existing_avail.status != 'available':
                                                    # Si le créneau existe et n'est pas disponible (réservé), on ne le remplace pas
                                                    exists = True
                                                    break
                                                else:
                                                    # Si le créneau existe mais est disponible, on le supprime pour le remplacer
                                                    db.session.delete(existing_avail)
                                                    # Pas besoin de break, car on veut supprimer tous les doublons potentiels

                                        if not exists:
                                            new_availability = Availability(
                                                doctor_id=doctor.id,
                                                date=current_date,
                                                start_time=start_time,
                                                end_time=end_time,
                                                status='available'
                                            )
                                            new_availabilities.append(new_availability)

                    # Ajouter toutes les nouvelles disponibilités en une seule fois
                    if new_availabilities:
                        db.session.add_all(new_availabilities)

                    # Commit des changements
                    db.session.commit()

                    # Log pour le débogage
                    print(f"Synchronisation des disponibilités pour le médecin {doctor.id}:")
                    print(f"- Jours disponibles: {doctor.available_days}")
                    print(f"- Heures disponibles: {doctor.available_hours}")
                    print(f"- Nombre de créneaux supprimés: {len(to_delete)}")
                    print(f"- Nombre de nouveaux créneaux créés: {len(new_availabilities)}")

                    # Vérifier les disponibilités après la synchronisation
                    availabilities_after = Availability.query.filter(
                        Availability.doctor_id == doctor.id,
                        Availability.date >= today,
                        Availability.status == 'available'
                    ).count()
                    print(f"- Nombre total de créneaux disponibles après synchronisation: {availabilities_after}")

                    # Informer le médecin que ses disponibilités ont été synchronisées
                    flash(f'Vos disponibilités ont été synchronisées avec succès. {len(new_availabilities)} créneaux ont été créés. Les patients peuvent maintenant réserver ces créneaux.', 'success')

                    # Ajouter un lien vers la page de débogage
                    flash(f'Vous pouvez vérifier vos disponibilités en détail sur la <a href="{url_for("debug.doctor_availability_html")}">page de débogage</a>.', 'info')

                except Exception as e:
                    # En cas d'erreur, annuler la transaction et afficher un message d'erreur
                    db.session.rollback()
                    flash(f'Une erreur est survenue lors de la synchronisation des disponibilités : {str(e)}', 'danger')
                    print(f"Erreur de synchronisation des disponibilités : {str(e)}")
                    # Continuer avec les autres mises à jour du profil

        elif form_type == 'preferences':
            # Mise à jour des préférences
            doctor.email_notifications = request.form.get('email_notifications') == 'on'
            doctor.sms_notifications = request.form.get('sms_notifications') == 'on'
            doctor.do_not_disturb = request.form.get('do_not_disturb') == 'on'

            # Changement de mot de passe
            current_password = request.form.get('current_password')
            new_password = request.form.get('new_password')
            confirm_password = request.form.get('confirm_password')

            if current_password and new_password and confirm_password:
                if not current_user.check_password(current_password):
                    flash('Le mot de passe actuel est incorrect.', 'danger')
                    return redirect(url_for('doctor.profile'))

                if new_password != confirm_password:
                    flash('Les nouveaux mots de passe ne correspondent pas.', 'danger')
                    return redirect(url_for('doctor.profile'))

                current_user.set_password(new_password)
                flash('Mot de passe mis à jour avec succès.', 'success')

        # Traitement de la photo de profil
        if 'avatar' in request.files:
            avatar_file = request.files['avatar']
            if avatar_file.filename != '':
                try:
                    # S'assurer que le dossier existe
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
                    doctor.profile_picture = f"uploads/avatars/{filename}"

                    # Afficher un message de succès
                    flash('Photo de profil mise à jour avec succès !', 'success')
                    print(f"Photo de profil enregistrée : {avatar_path}")
                except Exception as e:
                    # Afficher l'erreur pour le débogage
                    print(f"Erreur lors de l'upload de la photo : {str(e)}")
                    flash(f"Erreur lors de l'upload de la photo : {str(e)}", 'danger')

        try:
            # Enregistrer les modifications dans la base de données
            db.session.commit()
            flash('Profil mis à jour avec succès !', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Une erreur est survenue lors de la mise à jour du profil : {str(e)}', 'danger')
            print(f"Erreur de mise à jour du profil : {str(e)}")

        return redirect(url_for('doctor.profile'))

    return render_template('doctor/Profile_Doctor.html')

@doctor_bp.route('/patients')
@login_required
def patients():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    from sqlalchemy import func, and_

    # Get active patients (patients with at least one completed or accepted appointment)
    # For each patient, get only the first appointment they had with this doctor
    active_patients_with_first_appointment = db.session.query(
        Patient,
        func.min(Appointment.date_time).label('first_appointment_date')
    ).join(
        Appointment,
        and_(
            Appointment.patient_id == Patient.id,
            Appointment.doctor_id == current_user.doctor.id,
            Appointment.status.in_(['accepted', 'completed'])
        )
    ).group_by(Patient.id).all()

    # Get the last appointment date for each patient
    active_patients = []
    for patient, first_appointment_date in active_patients_with_first_appointment:
        # Get the last appointment for this patient with this doctor
        last_appointment = Appointment.query.filter(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == current_user.doctor.id,
            Appointment.status.in_(['accepted', 'completed'])
        ).order_by(Appointment.date_time.desc()).first()

        # Add the first and last appointment dates as attributes to the patient object
        patient.first_visit = first_appointment_date
        patient.last_visit = last_appointment.date_time if last_appointment else None

        active_patients.append(patient)

    # Get pending patients (patients with pending appointments)
    pending_patients = Patient.query.join(Appointment).filter(
        Appointment.doctor_id == current_user.doctor.id,
        Appointment.status == 'pending'
    ).distinct().all()

    # Add request date to pending patients
    for patient in pending_patients:
        # Get the earliest pending appointment for this patient
        earliest_pending = Appointment.query.filter(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == current_user.doctor.id,
            Appointment.status == 'pending'
        ).order_by(Appointment.created_at).first()

        patient.request_date = earliest_pending.created_at if earliest_pending else None

    return render_template('doctor/patients.html',
                          active_patients=active_patients,
                          pending_patients=pending_patients)

@doctor_bp.route('/patients/export-csv')
@login_required
def export_patients_csv():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to access this feature.', 'danger')
        return redirect(url_for('index'))

    from sqlalchemy import func, and_
    import csv
    from io import StringIO
    from flask import Response
    from datetime import datetime

    # Get active patients with their first and last appointment dates
    active_patients_with_dates = db.session.query(
        Patient,
        func.min(Appointment.date_time).label('first_appointment_date'),
        func.max(Appointment.date_time).label('last_appointment_date')
    ).join(
        Appointment,
        and_(
            Appointment.patient_id == Patient.id,
            Appointment.doctor_id == current_user.doctor.id,
            Appointment.status.in_(['accepted', 'completed'])
        )
    ).group_by(Patient.id).all()

    # Create a CSV file in memory
    output = StringIO()
    writer = csv.writer(output)

    # Write header row
    writer.writerow(['Nom', 'Prénom', 'Email', 'Numéro de téléphone', 'Date de première consultation', 'Date de dernière consultation'])

    # Write data rows
    for patient, first_date, last_date in active_patients_with_dates:
        writer.writerow([
            patient.user.last_name,
            patient.user.first_name,
            patient.user.email,
            patient.phone or '',
            first_date.strftime('%d/%m/%Y %H:%M') if first_date else '',
            last_date.strftime('%d/%m/%Y %H:%M') if last_date else ''
        ])

    # Create response with CSV file
    output.seek(0)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return Response(
        output,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename=patients_{timestamp}.csv'}
    )

@doctor_bp.route('/patient/<int:patient_id>')
@login_required
def patient_details(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    patient = Patient.query.get_or_404(patient_id)

    # Check if the patient has appointments with the current doctor
    appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).all()

    if not appointments:
        flash('Access denied. This patient does not have appointments with you.', 'danger')
        return redirect(url_for('doctor.patients'))

    # Calculate patient's age if birth_date is available
    from datetime import date
    age = None
    if patient.birth_date:
        today = date.today()
        age = today.year - patient.birth_date.year - ((today.month, today.day) < (patient.birth_date.month, patient.birth_date.day))

    # Get vital signs data for this patient
    vital_signs = {}
    try:
        # Get the most recent vital signs for each type
        from models import VitalSign
        vital_sign_types = ['temperature', 'heart_rate', 'blood_pressure', 'spo2', 'respiratory_rate', 'weight', 'height']

        for vs_type in vital_sign_types:
            latest_sign = VitalSign.query.filter_by(
                patient_id=patient.id,
                type=vs_type
            ).order_by(VitalSign.timestamp.desc()).first()

            if latest_sign:
                vital_signs[vs_type] = {
                    'value': latest_sign.value,
                    'unit': latest_sign.unit,
                    'timestamp': latest_sign.timestamp
                }
    except Exception as e:
        print(f"Error fetching vital signs: {str(e)}")

    # Get vital signs history for charts
    vital_signs_history = {}
    try:
        from models import VitalSign
        for vs_type in vital_sign_types:
            history = VitalSign.query.filter_by(
                patient_id=patient.id,
                type=vs_type
            ).order_by(VitalSign.timestamp.desc()).limit(20).all()

            if history:
                vital_signs_history[vs_type] = [{
                    'value': vs.value,
                    'timestamp': vs.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    'is_abnormal': vs.is_abnormal
                } for vs in history]
    except Exception as e:
        print(f"Error fetching vital signs history: {str(e)}")

    return render_template('doctor/patient_details.html',
                          patient=patient,
                          appointments=appointments,
                          age=age,
                          vital_signs=vital_signs,
                          vital_signs_history=vital_signs_history)

@doctor_bp.route('/patient/<int:patient_id>/download/vital-signs/<string:type>')
@login_required
def download_vital_signs(patient_id, type):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to access this feature.', 'danger')
        return redirect(url_for('index'))

    patient = Patient.query.get_or_404(patient_id)

    # Check if the patient has appointments with the current doctor
    appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).all()

    if not appointments:
        flash('Access denied. This patient does not have appointments with you.', 'danger')
        return redirect(url_for('doctor.patients'))

    import csv
    from io import StringIO
    from flask import Response
    from datetime import datetime

    try:
        from models import VitalSign

        # Get all vital signs of the specified type for this patient
        if type == 'all':
            vital_signs = VitalSign.query.filter_by(
                patient_id=patient.id
            ).order_by(VitalSign.timestamp.desc()).all()
            filename = f"vital_signs_all_{patient.user.last_name}_{patient.user.first_name}.csv"
            header = ['Type', 'Valeur', 'Unité', 'Date et heure', 'Statut']
        else:
            vital_signs = VitalSign.query.filter_by(
                patient_id=patient.id,
                type=type
            ).order_by(VitalSign.timestamp.desc()).all()

            # Map type to French name
            type_names = {
                'temperature': 'Température',
                'heart_rate': 'Fréquence cardiaque',
                'blood_pressure': 'Tension artérielle',
                'spo2': 'SpO2',
                'respiratory_rate': 'Fréquence respiratoire',
                'weight': 'Poids',
                'height': 'Taille'
            }
            type_name = type_names.get(type, type)
            filename = f"vital_signs_{type}_{patient.user.last_name}_{patient.user.first_name}.csv"
            header = ['Valeur', 'Unité', 'Date et heure', 'Statut']

        # Create a CSV file in memory
        output = StringIO()
        writer = csv.writer(output)

        # Write header row
        writer.writerow(header)

        # Write data rows
        for vs in vital_signs:
            status = "Anormal" if vs.is_abnormal else "Normal"
            if type == 'all':
                # Map type to French name
                type_names = {
                    'temperature': 'Température',
                    'heart_rate': 'Fréquence cardiaque',
                    'blood_pressure': 'Tension artérielle',
                    'spo2': 'SpO2',
                    'respiratory_rate': 'Fréquence respiratoire',
                    'weight': 'Poids',
                    'height': 'Taille'
                }
                type_name = type_names.get(vs.type, vs.type)
                writer.writerow([
                    type_name,
                    vs.value,
                    vs.unit,
                    vs.timestamp.strftime('%d/%m/%Y %H:%M:%S'),
                    status
                ])
            else:
                writer.writerow([
                    vs.value,
                    vs.unit,
                    vs.timestamp.strftime('%d/%m/%Y %H:%M:%S'),
                    status
                ])

        # Create response with CSV file
        output.seek(0)
        return Response(
            output,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment;filename={filename}'}
        )
    except Exception as e:
        flash(f'Erreur lors du téléchargement des données: {str(e)}', 'danger')
        return redirect(url_for('doctor.patient_details', patient_id=patient_id))

@doctor_bp.route('/patient/<int:patient_id>/prescriptions')
@login_required
def patient_prescriptions(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    patient = Patient.query.get_or_404(patient_id)

    # Check if the patient has appointments with the current doctor
    appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).all()

    if not appointments:
        flash('Access denied. This patient does not have appointments with you.', 'danger')
        return redirect(url_for('doctor.patients'))

    # Get all prescriptions for this patient from this doctor
    prescriptions = Prescription.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).order_by(Prescription.created_at.desc()).all()

    # Get all appointments with notes
    appointments_with_notes = Appointment.query.filter(
        Appointment.doctor_id == current_user.doctor.id,
        Appointment.patient_id == patient.id,
        Appointment.notes != None,
        Appointment.notes != ''
    ).order_by(Appointment.date_time.desc()).all()

    return render_template('doctor/patient_prescriptions.html',
                          patient=patient,
                          prescriptions=prescriptions,
                          appointments_with_notes=appointments_with_notes)

@doctor_bp.route('/new_prescription/<int:patient_id>', methods=['GET', 'POST'])
@login_required
def new_prescription(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    patient = Patient.query.get_or_404(patient_id)

    # Check if the patient has appointments with the current doctor
    appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).all()

    if not appointments:
        flash('Access denied. This patient does not have appointments with you.', 'danger')
        return redirect(url_for('doctor.patients'))

    # Get the most recent appointment for this patient
    latest_appointment = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        patient_id=patient.id
    ).order_by(Appointment.date_time.desc()).first()

    if request.method == 'POST':
        content = request.form.get('content')

        if not content:
            flash('Le contenu de la prescription ne peut pas être vide.', 'danger')
            return render_template('doctor/edit_prescription.html', patient=patient, prescription=None, is_new=True)

        # Create new prescription
        prescription = Prescription(
            patient_id=patient.id,
            doctor_id=current_user.doctor.id,
            appointment_id=latest_appointment.id if latest_appointment else None,
            content=content
        )

        db.session.add(prescription)
        db.session.commit()

        flash('Prescription créée avec succès.', 'success')
        return redirect(url_for('doctor.patient_prescriptions', patient_id=patient.id))

    return render_template('doctor/edit_prescription.html', patient=patient, prescription=None, is_new=True)

@doctor_bp.route('/edit_prescription/<int:prescription_id>', methods=['GET', 'POST'])
@login_required
def edit_prescription(prescription_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    prescription = Prescription.query.get_or_404(prescription_id)

    # Check if the prescription belongs to the current doctor
    if prescription.doctor_id != current_user.doctor.id:
        flash('Access denied. This prescription does not belong to you.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    patient = Patient.query.get_or_404(prescription.patient_id)

    if request.method == 'POST':
        content = request.form.get('content')

        if not content:
            flash('Le contenu de la prescription ne peut pas être vide.', 'danger')
            return render_template('doctor/edit_prescription.html', patient=patient, prescription=prescription, is_new=False)

        # Update prescription
        prescription.content = content
        db.session.commit()

        flash('Prescription mise à jour avec succès.', 'success')
        return redirect(url_for('doctor.patient_prescriptions', patient_id=patient.id))

    return render_template('doctor/edit_prescription.html', patient=patient, prescription=prescription, is_new=False)

@doctor_bp.route('/delete_prescription/<int:prescription_id>', methods=['GET', 'POST'])
@login_required
def delete_prescription(prescription_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    prescription = Prescription.query.get_or_404(prescription_id)

    # Check if the prescription belongs to the current doctor
    if prescription.doctor_id != current_user.doctor.id:
        flash('Access denied. This prescription does not belong to you.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    patient_id = prescription.patient_id

    # Delete prescription
    db.session.delete(prescription)
    db.session.commit()

    flash('Prescription supprimée avec succès.', 'success')
    return redirect(url_for('doctor.patient_prescriptions', patient_id=patient_id))

@doctor_bp.route('/edit_notes/<int:appointment_id>', methods=['GET', 'POST'])
@login_required
def edit_notes(appointment_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    appointment = Appointment.query.get_or_404(appointment_id)

    # Check if the appointment belongs to the current doctor
    if appointment.doctor_id != current_user.doctor.id:
        flash('Access denied. This appointment does not belong to you.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    patient = Patient.query.get_or_404(appointment.patient_id)

    if request.method == 'POST':
        notes = request.form.get('notes')

        # Update appointment notes
        appointment.notes = notes
        db.session.commit()

        flash('Notes de consultation mises à jour avec succès.', 'success')
        return redirect(url_for('doctor.patient_prescriptions', patient_id=patient.id))

    return render_template('doctor/edit_notes.html', patient=patient, appointment=appointment)

@doctor_bp.route('/virtual_office')
@doctor_bp.route('/virtual_office/<int:appointment_id>')
@login_required
def virtual_office(appointment_id=None):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Get today's appointments
    today = get_current_time_naive().date()

    # Marquer automatiquement les rendez-vous passés comme "terminés"
    past_appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        status='accepted'
    ).filter(
        Appointment.date_time < get_current_time_naive() - timedelta(minutes=30)  # 30 minutes après l'heure prévue
    ).all()

    # Mettre à jour le statut des rendez-vous passés
    for appt in past_appointments:
        appt.status = 'completed'
        print(f"Rendez-vous {appt.id} marqué comme terminé")

    if past_appointments:
        db.session.commit()
        print(f"{len(past_appointments)} rendez-vous marqués comme terminés")

    # Get today's appointments
    today_appointments = Appointment.query.filter_by(
        doctor_id=current_user.doctor.id,
        status='accepted'
    ).filter(
        Appointment.date_time >= datetime.combine(today, datetime.min.time()),
        Appointment.date_time <= datetime.combine(today, datetime.max.time())
    ).order_by(
        Appointment.date_time
    ).all()

    # Get the current appointment if an ID is provided
    current_appointment = None
    patient_history = None

    if appointment_id:
        current_appointment = Appointment.query.get_or_404(appointment_id)

        # Verify that the appointment belongs to the logged-in doctor
        if current_appointment.doctor_id != current_user.doctor.id:
            flash('Access denied. This appointment does not belong to you.', 'danger')
            return redirect(url_for('doctor.virtual_office'))

        # Ensure the appointment has a video room ID if it's accepted
        if current_appointment.status == 'accepted' and not current_appointment.video_room_id:
            import hashlib
            unique_id = f"{current_appointment.id}-{int(get_current_time().timestamp())}"
            room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

            # Stocker l'identifiant de la salle dans la base de données
            current_appointment.video_room_id = room_id

            # Créer les liens de visioconférence
            base_url = request.host_url.rstrip('/')
            video_link = f"{base_url}/video/{room_id}"
            current_appointment.video_link = video_link

            print(f"ID de salle généré dans virtual_office - ID: {current_appointment.id}, Room ID: {room_id}")

            db.session.commit()

        # Get patient history (past appointments)
        patient_history = Appointment.query.filter_by(
            doctor_id=current_user.doctor.id,
            patient_id=current_appointment.patient_id,
            status='completed'
        ).order_by(
            Appointment.date_time.desc()
        ).all()

        # Convert appointments to a format suitable for the history table
        formatted_history = []
        for appt in patient_history:
            history_item = {
                'appointment_date': appt.date_time,
                'appointment_type': appt.appointment_type if hasattr(appt, 'appointment_type') else 'Consultation',
                'procedures': appt.procedures if hasattr(appt, 'procedures') else '-',
                'diagnosis': appt.diagnosis if hasattr(appt, 'diagnosis') else '-',
                'prescriptions': appt.prescription if hasattr(appt, 'prescription') else '-',
                'next_appointment': appt.next_appointment_date if hasattr(appt, 'next_appointment_date') else None,
                'doctor_notes': appt.doctor_notes if hasattr(appt, 'doctor_notes') else '-'
            }
            formatted_history.append(history_item)

        patient_history = formatted_history

    # Get current time for enabling/disabling consultation buttons
    current_time = get_current_time_naive()

    return render_template('doctor/virtual_office.html',
                          today_appointments=today_appointments,
                          today_date=today.strftime('%d/%m/%Y'),
                          current_appointment=current_appointment,
                          patient_history=patient_history,
                          current_time=current_time)

@doctor_bp.route('/get_appointment_data/<int:appointment_id>')
@login_required
def get_appointment_data(appointment_id):
    if current_user.role != 'doctor':
        return jsonify({'error': 'Access denied'}), 403

    # Get the appointment
    appointment = Appointment.query.get_or_404(appointment_id)

    # Verify that the appointment belongs to the logged-in doctor
    if appointment.doctor_id != current_user.doctor.id:
        return jsonify({'error': 'This appointment does not belong to you'}), 403

    # Ensure the appointment has a video room ID
    if not appointment.video_room_id and appointment.status == 'accepted':
        # Generate a unique room ID if not already set
        import hashlib
        unique_id = f"{appointment.id}-{int(get_current_time().timestamp())}"
        room_id = hashlib.md5(unique_id.encode()).hexdigest()[:12]

        # Stocker l'identifiant de la salle dans la base de données
        appointment.video_room_id = room_id

        # Créer les liens de visioconférence
        base_url = request.host_url.rstrip('/')
        video_link = f"{base_url}/video/{room_id}"
        appointment.video_link = video_link

        print(f"ID de salle généré dans get_appointment_data - ID: {appointment.id}, Room ID: {room_id}")

        db.session.commit()

    # Récupérer la prescription associée au rendez-vous
    prescription = Prescription.query.filter_by(appointment_id=appointment.id).first()

    # Préparer les données de réponse
    data = {
        'appointment_id': appointment.id,
        'patient_id': appointment.patient.id,
        'patient_name': f"{appointment.patient.user.first_name} {appointment.patient.user.last_name}",
        'gender': appointment.patient.gender,
        'blood_type': appointment.patient.blood_type,
        'age': appointment.patient.age,
        'specialty': appointment.doctor.speciality,
        'appointment_date': appointment.date_time.strftime('%d/%m/%Y'),
        'appointment_time': appointment.date_time.strftime('%H:%M'),
        'status': appointment.status,
        'video_room_id': appointment.video_room_id,
        'notes': appointment.notes or '',
        'prescription': prescription.content if prescription else ''
    }

    return jsonify(data)

@doctor_bp.route('/smart_agenda')
@login_required
def smart_agenda():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette page sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.dashboard'))

@doctor_bp.route('/waiting_room')
@login_required
def waiting_room():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette page sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.dashboard'))

@doctor_bp.route('/medical_network')
@login_required
def medical_network():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette page sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.dashboard'))

@doctor_bp.route('/hospital_references')
@login_required
def hospital_references():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette page sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.dashboard'))

@doctor_bp.route('/settings')
@login_required
def settings():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette page sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.dashboard'))

@doctor_bp.route('/availability', methods=['GET', 'POST'])
@login_required
def availability():
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    doctor = current_user.doctor

    if request.method == 'POST':
        # Traitement du formulaire d'ajout de disponibilité
        try:
            date_str = request.form.get('date')
            start_time_str = request.form.get('start_time')
            end_time_str = request.form.get('end_time')

            # Validation des données
            if not all([date_str, start_time_str, end_time_str]):
                flash('Tous les champs sont obligatoires.', 'danger')
                return redirect(url_for('doctor.availability'))

            # Conversion des chaînes en objets date et time
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
            end_time_obj = datetime.strptime(end_time_str, '%H:%M').time()

            # Vérification que l'heure de fin est après l'heure de début
            if start_time_obj >= end_time_obj:
                flash('L\'heure de fin doit être après l\'heure de début.', 'danger')
                return redirect(url_for('doctor.availability'))

            # Vérification des chevauchements et des doublons
            existing_availabilities = Availability.query.filter_by(
                doctor_id=doctor.id,
                date=date_obj
            ).all()

            for avail in existing_availabilities:
                # Vérifier si c'est exactement le même créneau
                if (start_time_obj == avail.start_time and end_time_obj == avail.end_time):
                    flash(f'Ce créneau ({start_time_obj.strftime("%H:%M")} - {end_time_obj.strftime("%H:%M")}) est déjà disponible pour cette date.', 'info')
                    return redirect(url_for('doctor.availability'))

                # Vérifier s'il y a chevauchement
                if (start_time_obj < avail.end_time and end_time_obj > avail.start_time):
                    flash(f'Ce créneau chevauche un créneau existant ({avail.start_time.strftime("%H:%M")} - {avail.end_time.strftime("%H:%M")}).', 'danger')
                    return redirect(url_for('doctor.availability'))

            # Création de la nouvelle disponibilité
            new_availability = Availability(
                doctor_id=doctor.id,
                date=date_obj,
                start_time=start_time_obj,
                end_time=end_time_obj,
                status='available'
            )

            # Mettre à jour les champs available_days et available_hours du médecin
            # pour assurer la cohérence avec la table Availability
            weekday = date_obj.weekday() + 1  # 1 = Lundi, 7 = Dimanche

            # Mettre à jour available_days
            available_days = doctor.available_days or ""
            days_list = [int(day) for day in available_days.split(',') if day]
            if weekday not in days_list:
                days_list.append(weekday)
                days_list.sort()
                doctor.available_days = ','.join(str(day) for day in days_list)

            # Mettre à jour available_hours
            start_hour = start_time_obj.hour
            end_hour = end_time_obj.hour
            hour_range = f"{start_hour}-{end_hour}"

            available_hours = doctor.available_hours or ""
            hours_list = [hr for hr in available_hours.split(',') if hr]
            if hour_range not in hours_list:
                hours_list.append(hour_range)
                doctor.available_hours = ','.join(hours_list)

            # Journaliser les modifications
            print(f"Mise à jour des disponibilités du médecin {doctor.id}:")
            print(f"- Jours disponibles: {doctor.available_days}")
            print(f"- Heures disponibles: {doctor.available_hours}")
            print(f"- Nouvelle disponibilité: {date_obj} {start_time_obj}-{end_time_obj}")

            db.session.add(new_availability)
            db.session.commit()

            flash('Créneau de disponibilité ajouté avec succès.', 'success')
            return redirect(url_for('doctor.availability'))

        except Exception as e:
            db.session.rollback()
            flash(f'Une erreur est survenue: {str(e)}', 'danger')
            print(f"Erreur lors de l'ajout de disponibilité: {str(e)}")
            return redirect(url_for('doctor.availability'))

    # Récupération des disponibilités existantes
    today = get_current_time_naive().date()
    availabilities = Availability.query.filter(
        Availability.doctor_id == doctor.id,
        Availability.date >= today
    ).order_by(Availability.date, Availability.start_time).all()

    # Obtenir la date d'aujourd'hui au format YYYY-MM-DD pour le champ date
    today_str = get_current_time().strftime('%Y-%m-%d')

    # Journaliser les disponibilités existantes
    print(f"Disponibilités existantes pour le médecin {doctor.id}:")
    print(f"- Nombre de créneaux: {len(availabilities)}")
    for avail in availabilities:
        print(f"  - {avail.date} {avail.start_time}-{avail.end_time} ({avail.status})")

    return render_template('doctor/availability.html', availabilities=availabilities, today=today_str)

@doctor_bp.route('/accept_patient/<int:patient_id>')
@login_required
def accept_patient(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette fonctionnalité sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.patients'))

@doctor_bp.route('/reject_patient/<int:patient_id>')
@login_required
def reject_patient(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette fonctionnalité sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.patients'))

@doctor_bp.route('/schedule_appointment/<int:patient_id>')
@login_required
def schedule_appointment(patient_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    # Cette fonctionnalité sera développée ultérieurement
    flash('Fonctionnalité en cours de développement', 'info')
    return redirect(url_for('doctor.patients'))

@doctor_bp.route('/delete_appointment/<int:appointment_id>')
@login_required
def delete_appointment(appointment_id):
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    print(f"Fonction delete_appointment appelée avec appointment_id={appointment_id}")

    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au médecin connecté
    if appointment.doctor_id != current_user.doctor.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('doctor.appointments'))

    # Vérifier si le rendez-vous peut être supprimé
    if appointment.status not in ['accepted', 'rejected', 'cancelled', 'completed']:
        flash('Ce rendez-vous ne peut pas être supprimé.', 'danger')
        return redirect(url_for('doctor.appointments'))

    try:
        # Stocker les informations nécessaires avant de supprimer l'objet
        appointment_id = appointment.id
        patient_user = appointment.patient.user if appointment.patient else None
        patient_user_id = patient_user.id if patient_user else None
        formatted_date = appointment.date_time.strftime('%d/%m/%Y à %H:%M')

        # Vérifier et supprimer les objets liés qui pourraient causer des problèmes
        from models import Message, ConsultationNote, SharedFile, Prescription, Notification

        # 1. Supprimer les messages liés à ce rendez-vous
        messages = Message.query.filter_by(appointment_id=appointment_id).all()
        for message in messages:
            db.session.delete(message)

        # 2. Supprimer les notes de consultation liées à ce rendez-vous
        notes = ConsultationNote.query.filter_by(appointment_id=appointment_id).all()
        for note in notes:
            db.session.delete(note)

        # 3. Supprimer les fichiers partagés liés à ce rendez-vous
        files = SharedFile.query.filter_by(appointment_id=appointment_id).all()
        for file in files:
            db.session.delete(file)

        # 4. Mettre à jour les prescriptions liées à ce rendez-vous (ne pas les supprimer)
        prescriptions = Prescription.query.filter_by(appointment_id=appointment_id).all()
        for prescription in prescriptions:
            prescription.appointment_id = None
            db.session.add(prescription)

        # 5. Supprimer les notifications liées à ce rendez-vous
        notification_types = ['appointment_created', 'appointment_accepted', 'appointment_rejected', 'appointment_reminder']
        notifications = Notification.query.filter(
            Notification.related_id == appointment_id,
            Notification.type.in_(notification_types)
        ).all()
        for notification in notifications:
            db.session.delete(notification)

        # 6. Libérer la disponibilité si elle existe
        try:
            availability = Availability.query.filter_by(
                doctor_id=current_user.doctor.id,
                date=appointment.date_time.date(),
                start_time=appointment.date_time.time()
            ).first()

            if availability and appointment.status != 'accepted':
                availability.status = 'available'
                db.session.add(availability)
        except Exception as e:
            print(f"Erreur lors de la mise à jour de la disponibilité: {str(e)}")

        # 7. Supprimer le rendez-vous
        db.session.delete(appointment)

        # Commit final pour enregistrer toutes les modifications
        db.session.commit()

        flash('Rendez-vous supprimé avec succès.', 'success')

        # Envoyer une notification au patient seulement si nous avons son ID
        if patient_user_id:
            try:
                from socket_events import send_notification
                notification_title = "Rendez-vous supprimé"
                notification_content = f"Votre rendez-vous avec Dr. {current_user.first_name} {current_user.last_name} pour le {formatted_date} a été supprimé."

                send_notification(
                    user_id=patient_user_id,
                    title=notification_title,
                    content=notification_content,
                    notification_type="appointment_deleted",
                    related_id=appointment_id
                )
            except Exception as e:
                print(f"Erreur lors de l'envoi de la notification: {str(e)}")
                # Ne pas échouer si l'envoi de notification échoue

        # Récupérer le statut du rendez-vous pour la redirection
        tab = 'pending'  # Par défaut
        if appointment.status == 'accepted':
            tab = 'accepted'
        elif appointment.status == 'completed':
            tab = 'completed'
        elif appointment.status in ['rejected', 'cancelled']:
            tab = 'rejected'

        return redirect(url_for('doctor.appointments') + f'#tab={tab}')

    except Exception as e:
        # En cas d'erreur, annuler la transaction
        db.session.rollback()
        print(f"Erreur lors de la suppression du rendez-vous: {str(e)}")
        flash(f'Une erreur est survenue lors de la suppression du rendez-vous: {str(e)}', 'danger')
        return redirect(url_for('doctor.appointments'))

@doctor_bp.route('/delete_availability/<int:availability_id>')
@login_required
def delete_availability(availability_id):
    if current_user.role != 'doctor':
        flash('Access denied. You must be a doctor to view this page.', 'danger')
        return redirect(url_for('index'))

    availability = Availability.query.get_or_404(availability_id)

    # Vérifier que la disponibilité appartient au médecin connecté
    if availability.doctor_id != current_user.doctor.id:
        flash('Vous n\'êtes pas autorisé à supprimer cette disponibilité.', 'danger')
        return redirect(url_for('doctor.availability'))

    # Vérifier que la disponibilité n'est pas déjà réservée
    if availability.status != 'available':
        flash('Vous ne pouvez pas supprimer un créneau déjà réservé.', 'danger')
        return redirect(url_for('doctor.availability'))

    try:
        db.session.delete(availability)
        db.session.commit()
        flash('Créneau de disponibilité supprimé avec succès.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Une erreur est survenue: {str(e)}', 'danger')

    return redirect(url_for('doctor.availability'))

@doctor_bp.route('/save_notes/<int:appointment_id>', methods=['POST'])
@login_required
def save_notes(appointment_id):
    # Vérifier que l'utilisateur est un médecin
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer le rendez-vous
    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au médecin connecté
    if appointment.doctor_id != current_user.doctor.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    # Récupérer les notes du formulaire
    notes = request.form.get('notes', '')

    # Enregistrer les notes
    appointment.notes = notes
    db.session.commit()

    # Si la requête est AJAX, renvoyer une réponse JSON
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': 'Notes enregistrées avec succès.'})

    # Sinon, rediriger avec un message flash
    flash('Notes enregistrées avec succès.', 'success')
    return redirect(url_for('doctor.consultation', appointment_id=appointment_id))

@doctor_bp.route('/save_prescription/<int:appointment_id>', methods=['POST'])
@login_required
def save_prescription(appointment_id):
    # Vérifier que l'utilisateur est un médecin
    if current_user.role != 'doctor':
        flash('Accès refusé. Vous devez être un médecin pour voir cette page.', 'danger')
        return redirect(url_for('index'))

    # Récupérer le rendez-vous
    appointment = Appointment.query.get_or_404(appointment_id)

    # Vérifier que le rendez-vous appartient au médecin connecté
    if appointment.doctor_id != current_user.doctor.id:
        flash('Accès refusé. Ce rendez-vous ne vous appartient pas.', 'danger')
        return redirect(url_for('doctor.dashboard'))

    # Récupérer le contenu de la prescription
    content = request.form.get('content', '')

    if not content:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': 'Le contenu de la prescription ne peut pas être vide.'}), 400
        flash('Le contenu de la prescription ne peut pas être vide.', 'danger')
        return redirect(url_for('doctor.virtual_office', appointment_id=appointment_id))

    # Vérifier si une prescription existe déjà pour ce rendez-vous
    prescription = Prescription.query.filter_by(appointment_id=appointment_id).first()

    if prescription:
        # Mettre à jour la prescription existante
        prescription.content = content
    else:
        # Créer une nouvelle prescription
        prescription = Prescription(
            patient_id=appointment.patient_id,
            doctor_id=current_user.doctor.id,
            appointment_id=appointment.id,
            content=content
        )
        db.session.add(prescription)

    db.session.commit()

    # Si la requête est AJAX, renvoyer une réponse JSON
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': 'Prescription enregistrée avec succès.'})

    # Sinon, rediriger avec un message flash
    flash('Prescription enregistrée avec succès.', 'success')
    return redirect(url_for('doctor.virtual_office', appointment_id=appointment_id))
