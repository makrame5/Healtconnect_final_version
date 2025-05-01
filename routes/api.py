from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from extensions import db
from models import Notification
from datetime import datetime

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/notifications')
@login_required
def get_notifications():
    """Récupère les notifications de l'utilisateur connecté"""
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(
        Notification.created_at.desc()
    ).limit(10).all()
    
    notifications_data = []
    for notification in notifications:
        notifications_data.append({
            'id': notification.id,
            'title': notification.title,
            'content': notification.content,
            'type': notification.type,
            'related_id': notification.related_id,
            'is_read': notification.is_read,
            'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return jsonify({
        'success': True,
        'notifications': notifications_data
    })

@api_bp.route('/notifications/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    """Marque une notification comme lue"""
    notification = Notification.query.get_or_404(notification_id)
    
    # Vérifier que la notification appartient à l'utilisateur connecté
    if notification.user_id != current_user.id:
        return jsonify({
            'success': False,
            'message': 'Accès refusé. Cette notification ne vous appartient pas.'
        }), 403
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Notification marquée comme lue'
    })

@api_bp.route('/notifications/mark-all-read', methods=['POST'])
@login_required
def mark_all_notifications_read():
    """Marque toutes les notifications de l'utilisateur comme lues"""
    Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).update({
        'is_read': True
    })
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Toutes les notifications ont été marquées comme lues'
    })

@api_bp.route('/notifications/unread-count')
@login_required
def get_unread_count():
    """Récupère le nombre de notifications non lues"""
    count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()
    
    return jsonify({
        'success': True,
        'count': count
    })
