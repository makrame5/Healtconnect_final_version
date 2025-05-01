from datetime import datetime, timedelta, timezone

# Définir le fuseau horaire UTC+1 (Europe/Paris)
UTC_PLUS_1 = timezone(timedelta(hours=1))

def get_current_time():
    """
    Retourne l'heure actuelle en UTC+1
    """
    return datetime.now(UTC_PLUS_1)

def get_current_time_naive():
    """
    Retourne l'heure actuelle en UTC+1 sans information de fuseau horaire
    Utile pour la compatibilité avec SQLite qui ne stocke pas les informations de fuseau horaire
    """
    return datetime.now(UTC_PLUS_1).replace(tzinfo=None)

def localize_datetime(dt):
    """
    Ajoute l'information de fuseau horaire UTC+1 à un objet datetime naïf
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC_PLUS_1)
    return dt

def format_datetime(dt, format_str='%d/%m/%Y %H:%M'):
    """
    Formate un objet datetime pour l'affichage
    """
    if dt.tzinfo is None:
        dt = localize_datetime(dt)
    return dt.strftime(format_str)

def parse_datetime(datetime_str, format_str='%Y-%m-%d %H:%M'):
    """
    Parse une chaîne de caractères en objet datetime avec fuseau horaire UTC+1
    """
    dt = datetime.strptime(datetime_str, format_str)
    return localize_datetime(dt)

def parse_date(date_str, format_str='%Y-%m-%d'):
    """
    Parse une chaîne de caractères en objet date
    """
    return datetime.strptime(date_str, format_str).date()

def parse_time(time_str, format_str='%H:%M'):
    """
    Parse une chaîne de caractères en objet time
    """
    return datetime.strptime(time_str, format_str).time()
