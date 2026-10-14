"""Exercise startup failure and cleanup with real disposable child processes."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.utils import server


def command(code):
    return [sys.executable, '-c', code]


class ServerTests(unittest.TestCase):
    def test_startup_failure_does_not_launch_services(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = str(Path(directory) / 'service-started')
            result = server.run([command('raise SystemExit(7)')],
                                [command(f'from pathlib import Path; Path({marker!r}).touch()')])
            self.assertEqual(result, 7)
            self.assertFalse(Path(marker).exists())

    def test_initialization_finishes_before_service_starts(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = str(Path(directory) / 'startup')
            first = command(f'from pathlib import Path; Path({marker!r}).write_text("initialized")')
            second = command(f'from pathlib import Path; '
                             f'assert Path({marker!r}).read_text() == "initialized"; '
                             f'Path({marker!r}).write_text("seeded")')
            service = command(f'from pathlib import Path; '
                              f'raise SystemExit(9 if Path({marker!r}).read_text() == "seeded" else 8)')
            self.assertEqual(server.run([first, second], [service]), 9)

    def check_service_exit(self, failing_index, exit_code):
        processes = []
        real_popen = subprocess.Popen

        def launch(args):
            process = real_popen(args)
            processes.append(process)
            return process

        services = [command('import time; time.sleep(60)') for _ in range(2)]
        services[failing_index] = command(f'import time; time.sleep(0.3); raise SystemExit({exit_code})')
        with patch.object(server.subprocess, 'Popen', side_effect=launch):
            self.assertEqual(server.run([], services), exit_code or 1)
        self.assertEqual(len(processes), 2)
        self.assertTrue(all(process.poll() is not None for process in processes))

    def test_http_failure_stops_worker(self):
        self.check_service_exit(0, 3)

    def test_worker_failure_stops_http(self):
        self.check_service_exit(1, 4)

    def test_unexpected_success_exit_still_stops_other_service(self):
        self.check_service_exit(1, 0)


if __name__ == '__main__':
    unittest.main()
