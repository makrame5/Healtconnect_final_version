from extensions import db
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from utils.datetime_utils import get_current_time_naive

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # 'patient' or 'doctor'
    created_at = db.Column(db.DateTime, default=get_current_time_naive)

    # Relationships
    patient = db.relationship('Patient', backref='user', uselist=False, cascade='all, delete-orphan')
    doctor = db.relationship('Doctor', backref='user', uselist=False, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.email}>'

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    birth_date = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(10), nullable=True)  # male, female, other
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    id_number = db.Column(db.String(50), nullable=True)  # National ID or patient ID
    insurance = db.Column(db.String(100), nullable=True)
    blood_type = db.Column(db.String(5), nullable=True)  # A+, B-, etc.
    allergies = db.Column(db.Text, nullable=True)
    chronic_diseases = db.Column(db.Text, nullable=True)
    current_medications = db.Column(db.Text, nullable=True)
    emergency_contact_name = db.Column(db.String(100), nullable=True)
    emergency_contact_phone = db.Column(db.String(20), nullable=True)
    social_security_number = db.Column(db.String(50), nullable=True)
    profile_picture = db.Column(db.String(200), nullable=True)  # Path to profile picture

    # Relationships
    appointments = db.relationship('Appointment', backref='patient', lazy='dynamic',
                                  foreign_keys='Appointment.patient_id', cascade='all, delete-orphan')
    prescriptions = db.relationship('Prescription', backref='patient', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Patient {self.user.first_name} {self.user.last_name}>'

class Doctor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    speciality = db.Column(db.String(100), nullable=True)
    secondary_speciality = db.Column(db.String(100), nullable=True)
    license_number = db.Column(db.String(50), nullable=True)
    years_experience = db.Column(db.Integer, nullable=True)
    education = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    consultation_fee = db.Column(db.Float, nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    languages = db.Column(db.String(200), nullable=True)  # Comma-separated list of languages
    profile_picture = db.Column(db.String(200), nullable=True)  # Path to profile picture
    document_path = db.Column(db.String(200), nullable=True)  # Path to uploaded documents
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    rejection_reason = db.Column(db.Text, nullable=True)  # Reason for rejection if status is 'rejected'
    verified_at = db.Column(db.DateTime, nullable=True)  # When the doctor was verified

    # Nouveaux champs pour le profil médecin
    practice_location = db.Column(db.String(200), nullable=True)
    previous_positions = db.Column(db.Text, nullable=True)
    linkedin = db.Column(db.String(200), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    available_days = db.Column(db.String(100), nullable=True)  # Jours disponibles (format: "1,2,3,4,5")
    available_hours = db.Column(db.String(200), nullable=True)  # Heures disponibles (format: "9-12,14-17")
    video_consultation = db.Column(db.Boolean, default=True)
    email_notifications = db.Column(db.Boolean, default=True)
    sms_notifications = db.Column(db.Boolean, default=False)
    do_not_disturb = db.Column(db.Boolean, default=False)

    # Relationships
    appointments = db.relationship('Appointment', backref='doctor', lazy='dynamic',
                                  foreign_keys='Appointment.doctor_id', cascade='all, delete-orphan')
    prescriptions = db.relationship('Prescription', backref='doctor', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Doctor {self.user.first_name} {self.user.last_name}>'

class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    date_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected, completed
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=get_current_time_naive)
    video_link = db.Column(db.String(255), nullable=True)  # Lien de visioconférence
    video_room_id = db.Column(db.String(100), nullable=True)  # ID unique de la salle de visioconférence

    def __repr__(self):
        return f'<Appointment {self.id}>'

class Prescription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=get_current_time_naive)

    # Relationship with appointment
    appointment = db.relationship('Appointment', backref='prescriptions')

    def __repr__(self):
        return f'<Prescription {self.id}>'

class Availability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), default='available')  # available, booked, unavailable
    created_at = db.Column(db.DateTime, default=get_current_time_naive)

    # Relationship with doctor
    doctor = db.relationship('Doctor', backref='availabilities')

    def __repr__(self):
        return f'<Availability {self.id}: {self.date} {self.start_time}-{self.end_time}>'


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # appointment, message, system, etc.
    related_id = db.Column(db.Integer, nullable=True)  # ID of related object (appointment, message, etc.)
    is_read = db.Column(db.Boolean, default=False)
    is_urgent = db.Column(db.Boolean, default=False)  # Pour les notifications de rappel de rendez-vous
    created_at = db.Column(db.DateTime, default=get_current_time_naive)

    # Relationship with user
    user = db.relationship('User', backref='notifications')

    def __repr__(self):
        return f'<Notification {self.id}: {self.title}>'


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=get_current_time_naive)
    is_read = db.Column(db.Boolean, default=False)
    is_urgent = db.Column(db.Boolean, default=False)

    # Relationships
    appointment = db.relationship('Appointment', backref='messages')
    sender = db.relationship('User', backref='sent_messages')

    def __repr__(self):
        return f'<Message {self.id}: {self.content[:20]}...>'


class ConsultationNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=get_current_time_naive)
    updated_at = db.Column(db.DateTime, default=get_current_time_naive, onupdate=get_current_time_naive)

    # Relationships
    appointment = db.relationship('Appointment', backref='consultation_notes')
    doctor = db.relationship('Doctor', backref='consultation_notes')

    def __repr__(self):
        return f'<ConsultationNote {self.id}: {self.content[:20]}...>'


class SharedFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)  # pdf, image, etc.
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    created_at = db.Column(db.DateTime, default=get_current_time_naive)

    # Relationships
    appointment = db.relationship('Appointment', backref='shared_files')
    sender = db.relationship('User', backref='shared_files')

    def __repr__(self):
        return f'<SharedFile {self.id}: {self.file_name}>'


class Sensor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # heartrate, blood_pressure, temperature, etc.
    description = db.Column(db.Text, nullable=True)
    manufacturer = db.Column(db.String(100), nullable=True)
    model = db.Column(db.String(100), nullable=True)
    serial_number = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='active')  # active, inactive, maintenance
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=get_current_time_naive)
    last_connected_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    patient = db.relationship('Patient', backref='sensors')
    vital_signs = db.relationship('VitalSign', backref='sensor', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Sensor {self.id}: {self.name} ({self.type})>'


class VitalSign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sensor_id = db.Column(db.Integer, db.ForeignKey('sensor.id'), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # heartrate, blood_pressure, temperature, etc.
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # bpm, mmHg, °C, etc.
    timestamp = db.Column(db.DateTime, default=get_current_time_naive)
    is_abnormal = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=True)  # Si la mesure est prise pendant une consultation

    # Relationships
    patient = db.relationship('Patient', backref='vital_signs')
    appointment = db.relationship('Appointment', backref='vital_signs')

    def __repr__(self):
        return f'<VitalSign {self.id}: {self.type} - {self.value} {self.unit}>'


class VitalSignThreshold(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # heartrate, blood_pressure, temperature, etc.
    min_value = db.Column(db.Float, nullable=True)
    max_value = db.Column(db.Float, nullable=True)
    unit = db.Column(db.String(20), nullable=False)  # bpm, mmHg, °C, etc.
    created_at = db.Column(db.DateTime, default=get_current_time_naive)
    updated_at = db.Column(db.DateTime, default=get_current_time_naive, onupdate=get_current_time_naive)

    # Relationships
    patient = db.relationship('Patient', backref='vital_sign_thresholds')

    def __repr__(self):
        return f'<VitalSignThreshold {self.id}: {self.type} - Min: {self.min_value}, Max: {self.max_value} {self.unit}>'
