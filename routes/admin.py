from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import User, Doctor, Patient, Appointment, Notification
from functools import wraps

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            flash('Accès non autorisé. Vous devez être administrateur pour accéder à cette page.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
@login_required
@admin_required
def dashboard():
    # Count pending doctors
    pending_doctors_count = Doctor.query.filter_by(status='pending').count()

    return render_template('admin/dashboard.html', pending_doctors_count=pending_doctors_count)

@admin_bp.route('/doctors/pending')
@login_required
@admin_required
def pending_doctors():
    # Get all pending doctors
    pending_doctors = Doctor.query.filter_by(status='pending').all()

    return render_template('admin/pending_doctors.html', doctors=pending_doctors)

@admin_bp.route('/doctors/<int:doctor_id>')
@login_required
@admin_required
def doctor_details(doctor_id):
    # Get doctor details
    doctor = Doctor.query.get_or_404(doctor_id)

    return render_template('admin/doctor_details.html', doctor=doctor)

@admin_bp.route('/api/doctors/<int:doctor_id>/approve', methods=['POST'])
@login_required
@admin_required
def approve_doctor(doctor_id):
    try:
        doctor = Doctor.query.get_or_404(doctor_id)

        # Update doctor status
        doctor.status = 'approved'
        db.session.commit()

        # Send email notification to doctor (would be implemented here)

        return jsonify({
            'success': True,
            'message': 'Le médecin a été approuvé avec succès.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Une erreur est survenue: {str(e)}'
        }), 500

@admin_bp.route('/api/doctors/<int:doctor_id>/reject', methods=['POST'])
@login_required
@admin_required
def reject_doctor(doctor_id):
    try:
        doctor = Doctor.query.get_or_404(doctor_id)
        reason = request.json.get('reason', '')

        # Update doctor status
        doctor.status = 'rejected'
        doctor.rejection_reason = reason
        db.session.commit()

        # Send email notification to doctor (would be implemented here)

        return jsonify({
            'success': True,
            'message': 'Le médecin a été rejeté.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Une erreur est survenue: {str(e)}'
        }), 500

@admin_bp.route('/run-migrations')
@login_required
@admin_required
def run_migrations():
    """Run database migrations"""
    try:
        # Add is_urgent column to notifications table if it doesn't exist
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('notification')]

        if 'is_urgent' not in columns:
            # Add the column
            db.engine.execute('ALTER TABLE notification ADD COLUMN is_urgent BOOLEAN DEFAULT FALSE')
            flash('Migration réussie: Colonne is_urgent ajoutée à la table notification.', 'success')
        else:
            flash('La colonne is_urgent existe déjà dans la table notification.', 'info')

        return redirect(url_for('admin.dashboard'))
    except Exception as e:
        flash(f'Erreur lors de l\'exécution des migrations: {str(e)}', 'danger')
        return redirect(url_for('admin.dashboard'))