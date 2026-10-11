"""python -m backend.app.utils.worker [--once]; chạy ở process riêng."""
from backend.app.services.encounter_job_service import system_actor, expire_holds
import argparse
import logging
import signal
from threading import Event


logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    stopping = Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    while not stopping.is_set():
        try:
            logger.info('Expired holds: %s', expire_holds())
            from backend.app.utils.reminder_worker import enqueue_reminders
            logger.info('Appointment reminders: %s', enqueue_reminders())
        except Exception:
            logger.exception('Expiry cycle failed; transaction rolled back')
            if args.once:
                raise
        if args.once:
            break
        stopping.wait(30)


if __name__ == '__main__':
    main()
