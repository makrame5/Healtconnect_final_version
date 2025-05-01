from app import app
from extensions import db, migrate
from models import User, Patient, Doctor, Appointment, Prescription

def init_db():
    """Initialiser la base de données avec Flask-Migrate"""
    with app.app_context():
        # Créer le répertoire de migrations
        print("Initialisation de Flask-Migrate...")
        from flask_migrate import init, migrate as migrate_command, upgrade
        
        # Initialiser le répertoire de migrations
        init()
        
        # Créer une migration initiale
        migrate_command()
        
        # Appliquer la migration
        upgrade()
        
        print("Base de données initialisée avec succès !")

if __name__ == "__main__":
    init_db()
