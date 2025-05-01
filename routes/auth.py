from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from extensions import db
from models import User, Patient, Doctor
import json
import os
from werkzeug.utils import secure_filename

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['GET'])
def register():
    return render_template('auth/register_choice.html')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        # Redirection en fonction du rôle de l'utilisateur connecté
        if current_user.role == 'patient':
            return redirect(url_for('patient.dashboard'))
        elif current_user.role == 'doctor':
            return redirect(url_for('doctor.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            # Vérification du rôle de l'utilisateur
            if user.role == 'admin':
                flash('Ce type de compte n\'est pas autorisé.', 'danger')
                return redirect(url_for('auth.login'))
            elif user.role not in ['patient', 'doctor']:
                flash('Type de compte non reconnu.', 'danger')
                return redirect(url_for('auth.login'))

            # Vérification du statut du médecin (si c'est un médecin)
            if user.role == 'doctor' and hasattr(user, 'doctor') and user.doctor:
                # Assurons-nous que le statut du médecin est 'approved'
                if user.doctor.status != 'approved':
                    user.doctor.status = 'approved'
                    db.session.commit()
                    print(f"Statut du médecin mis à jour: {user.doctor.status}")

            # Connexion de l'utilisateur
            login_user(user)
            flash('Connexion réussie !', 'success')

            # Redirection vers la page demandée ou le tableau de bord approprié
            next_page = request.args.get('next')
            if not next_page or not next_page.startswith('/'):
                # Redirection spécifique en fonction du rôle
                if user.role == 'patient':
                    next_page = url_for('patient.dashboard')
                elif user.role == 'doctor':
                    next_page = url_for('doctor.dashboard')

            print(f"Redirection vers: {next_page}")
            return redirect(next_page)
        else:
            flash('Email ou mot de passe invalide', 'danger')

    return render_template('auth/login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

@auth_bp.route('/register-patient')
def register_patient():
    return render_template('auth/register_patient.html')

@auth_bp.route('/register-doctor')
def register_doctor():
    return render_template('auth/register_doctor.html')

@auth_bp.route('/api/auth/register/patient', methods=['POST'])
def api_register_patient():
    try:
        # Get JSON data from request
        data = request.get_json()

        # Extract basic user information
        email = data.get('email')
        password = data.get('password')
        first_name = data.get('firstName')
        last_name = data.get('lastName')

        # Validate required fields
        if not all([email, password, first_name, last_name]):
            return jsonify({
                'success': False,
                'message': 'Veuillez remplir tous les champs obligatoires.'
            }), 400

        # Check if user already exists
        user = User.query.filter_by(email=email).first()
        if user:
            return jsonify({
                'success': False,
                'message': 'Cette adresse email est déjà utilisée.'
            }), 400

        # Create new user
        new_user = User(email=email, first_name=first_name, last_name=last_name, role='patient')
        new_user.set_password(password)
        db.session.add(new_user)

        # Convert birth_date string to date object if provided
        birth_date = None
        if data.get('birthDate'):
            from datetime import datetime
            try:
                birth_date = datetime.strptime(data.get('birthDate'), '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Format de date de naissance invalide. Utilisez le format YYYY-MM-DD.'
                }), 400

        # Create patient profile with additional information
        patient = Patient(
            user=new_user,
            birth_date=birth_date,
            gender=data.get('gender'),
            phone=data.get('phone'),
            address=data.get('address'),
            id_number=data.get('idNumber'),
            insurance=data.get('insurance'),
            blood_type=data.get('bloodType'),
            allergies=data.get('allergies'),
            chronic_diseases=data.get('chronicDiseases'),
            current_medications=data.get('currentMedications'),
            emergency_contact_name=data.get('emergencyContactName'),
            emergency_contact_phone=data.get('emergencyContactPhone'),
            social_security_number=data.get('socialSecurityNumber')
        )
        db.session.add(patient)

        # Commit changes to database
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Une erreur est survenue lors de l\'inscription: {str(e)}'
        }), 500

@auth_bp.route('/api/auth/register/doctor', methods=['POST'])
def api_register_doctor():
    try:
        # Handle form data for file uploads
        data = {}
        for key in request.form:
            data[key] = request.form[key]

        # Extract basic user information
        email = data.get('email')
        password = data.get('password')
        first_name = data.get('firstName')
        last_name = data.get('lastName')

        # Validate required fields
        if not all([email, password, first_name, last_name]):
            return jsonify({
                'success': False,
                'message': 'Veuillez remplir tous les champs obligatoires.'
            }), 400

        # Check if user already exists
        user = User.query.filter_by(email=email).first()
        if user:
            return jsonify({
                'success': False,
                'message': 'Cette adresse email est déjà utilisée.'
            }), 400

        # Create new user
        new_user = User(email=email, first_name=first_name, last_name=last_name, role='doctor')
        new_user.set_password(password)
        db.session.add(new_user)

        # Convert years_experience to integer if provided
        years_experience = None
        if data.get('yearsExperience'):
            try:
                years_experience = int(data.get('yearsExperience'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Le nombre d\'années d\'expérience doit être un nombre entier.'
                }), 400

        # Convert consultation_fee to float if provided
        consultation_fee = None
        if data.get('consultationFee'):
            try:
                consultation_fee = float(data.get('consultationFee'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Le tarif de consultation doit être un nombre.'
                }), 400

        # Create doctor profile with additional information
        doctor = Doctor(
            user=new_user,
            speciality=data.get('speciality'),
            license_number=data.get('licenseNumber'),
            years_experience=years_experience,
            education=data.get('education'),
            bio=data.get('bio'),
            consultation_fee=consultation_fee,
            phone=data.get('phone'),
            address=data.get('address'),
            languages=data.get('languages'),
            status='approved'  # Automatically approve doctors
        )
        db.session.add(doctor)

        # Handle file uploads
        import os
        from werkzeug.utils import secure_filename

        UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'uploads')
        # Create uploads directory if it doesn't exist
        os.makedirs(os.path.join(UPLOAD_FOLDER, 'documents'), exist_ok=True)
        os.makedirs(os.path.join(UPLOAD_FOLDER, 'profile_pictures'), exist_ok=True)

        # Check if required files are provided
        if 'document' not in request.files or request.files['document'].filename == '':
            return jsonify({
                'success': False,
                'message': 'Veuillez télécharger une pièce justificative.'
            }), 400

        if 'profilePicture' not in request.files or request.files['profilePicture'].filename == '':
            return jsonify({
                'success': False,
                'message': 'Veuillez télécharger une photo de profil.'
            }), 400

        try:
            # Process document file
            document_file = request.files['document']
            document_filename = secure_filename(document_file.filename)
            # Add user ID to filename to make it unique
            unique_document_filename = f"{new_user.id}_{document_filename}"
            document_path = os.path.join(UPLOAD_FOLDER, 'documents', unique_document_filename)
            document_file.save(document_path)
            # Save relative path to database
            doctor.document_path = os.path.join('uploads', 'documents', unique_document_filename)

            # Process profile picture
            profile_picture = request.files['profilePicture']
            profile_filename = secure_filename(profile_picture.filename)
            # Add user ID to filename to make it unique
            unique_profile_filename = f"{new_user.id}_{profile_filename}"
            profile_path = os.path.join(UPLOAD_FOLDER, 'profile_pictures', unique_profile_filename)
            profile_picture.save(profile_path)
            # Save relative path to database
            doctor.profile_picture = os.path.join('uploads', 'profile_pictures', unique_profile_filename)
        except Exception as e:
            # En cas d'erreur lors du téléchargement des fichiers
            db.session.rollback()
            print(f"Erreur lors du téléchargement des fichiers: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Erreur lors du téléchargement des fichiers: {str(e)}'
            }), 500

        # Commit changes to database
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.'
        })
    except Exception as e:
        db.session.rollback()
        print(f"Erreur lors de l'inscription du médecin: {str(e)}")  # Log l'erreur pour le débogage
        return jsonify({
            'success': False,
            'message': f'Une erreur est survenue lors de l\'inscription: {str(e)}'
        }), 500