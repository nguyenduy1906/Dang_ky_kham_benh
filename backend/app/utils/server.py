"""Initialize the database, then run HTTP and one worker in the backend container."""
import logging
import signal
import subprocess
import sys
import time
from threading import Event

logger = logging.getLogger(__name__)


def run(startup_commands, service_commands, shutdown_timeout=8):
    stopping = Event()
    previous_handlers = {}
    processes = []
    try:
        for sig in (signal.SIGTERM, signal.SIGINT):
            previous_handlers[sig] = signal.signal(sig, lambda *_: stopping.set())
        for command in startup_commands:
            if stopping.is_set():
                return 0
            process = subprocess.Popen(command)
            processes.append(process)
            while process.poll() is None and not stopping.wait(0.1):
                pass
            if stopping.is_set():
                return 0
            if process.returncode:
                return process.returncode if process.returncode > 0 else 1
        services = []
        for command in service_commands:
            if stopping.is_set():
                return 0
            process = subprocess.Popen(command)
            processes.append(process)
            services.append(process)
        while not stopping.wait(0.1):
            for process in services:
                code = process.poll()
                if code is not None:
                    logger.error('Backend process exited unexpectedly: pid=%s code=%s', process.pid, code)
                    return code if code > 0 else 1
        return 0
    finally:
        running = [process for process in processes if process.poll() is None]
        for process in running:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + shutdown_timeout
        for process in running:
            try:
                process.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        for sig, handler in previous_handlers.items():
            signal.signal(sig, handler)


def main():
    logging.basicConfig(level=logging.INFO)
    return run(
        [[sys.executable, '-m', 'backend.app.db.init_db'],
         [sys.executable, '-m', 'backend.app.db.seed_db']],
        [['gunicorn', '--bind', '0.0.0.0:5000', '--workers', '2',
          '--graceful-timeout', '5', '--access-logfile', '-', '--error-logfile', '-',
          'backend.app.main:create_app()'],
         [sys.executable, '-m', 'backend.app.utils.worker']],
    )


if __name__ == '__main__':
    sys.exit(main())
