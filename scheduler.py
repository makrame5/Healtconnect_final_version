"""
Scheduler for HealthConnect
This script sets up a scheduler to run periodic tasks
"""
import time
import threading
import schedule
from app import app
from socket_events import check_upcoming_appointments

def run_scheduler():
    """Run the scheduler in a separate thread"""
    def run_threaded(job_func):
        job_thread = threading.Thread(target=job_func)
        job_thread.start()
    
    # Schedule the check_upcoming_appointments function to run every minute
    schedule.every(1).minutes.do(run_threaded, check_upcoming_appointments_with_context)
    
    # Run the scheduler
    while True:
        schedule.run_pending()
        time.sleep(1)

def check_upcoming_appointments_with_context():
    """Run check_upcoming_appointments within the application context"""
    with app.app_context():
        check_upcoming_appointments()

if __name__ == '__main__':
    print("Starting HealthConnect scheduler...")
    print("Press Ctrl+C to exit")
    
    try:
        run_scheduler()
    except KeyboardInterrupt:
        print("Scheduler stopped")
