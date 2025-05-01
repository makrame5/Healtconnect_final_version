import os
import time
from flask_migrate import Migrate


class Config:
    # Secret key for session management
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-for-healthconnect'

    # SQLite database URI
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///healthconnect.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Upload configuration
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}

    # Configuration MQTT
    MQTT_BROKER_URL = os.environ.get('MQTT_BROKER_URL') or 'localhost'
    MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT') or 1883)
    MQTT_USERNAME = os.environ.get('MQTT_USERNAME') or ''
    MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD') or ''
    MQTT_KEEPALIVE = int(os.environ.get('MQTT_KEEPALIVE') or 60)
    MQTT_CLIENT_ID = os.environ.get('MQTT_CLIENT_ID') or f'flask_mqtt_{time.time()}'
