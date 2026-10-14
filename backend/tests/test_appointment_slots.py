import unittest
from datetime import date, time, datetime, timezone
from unittest.mock import Mock

from backend.app.core.errors import AppError
from backend.app.schemas.encounter_schema import validate_online
from backend.app.services.appointment_slot_service import intervals, reserve_interval


class AppointmentSlotTests(unittest.TestCase):
    def schedule(self, minutes=30):
        return dict(schedule_id=1, work_date=date(2035, 1, 1), start_time=time(8),
                    end_time=time(9), slot_minutes=minutes)

    def database(self, occupied=()):
        db = Mock()
        db.execute.return_value.fetchall.return_value = [
            {'estimated_exam_at': start} for start in occupied]
        return db

    def test_intervals_have_start_end_and_stay_inside_shift(self):
        for minutes, count in ((15, 4), (30, 2)):
            slots = list(intervals(self.schedule(minutes)))
            self.assertEqual(len(slots), count)
            self.assertEqual(slots[-1][1].hour, 9)
            self.assertEqual((slots[0][1] - slots[0][0]).total_seconds(), minutes * 60)

    def test_hold_blocks_same_slot_but_adjacent_slot_remains_available(self):
        schedule = self.schedule()
        start, end = list(intervals(schedule))[0]
        db = self.database([start.astimezone(timezone.utc)])
        with self.assertRaises(AppError) as caught:
            reserve_interval(db, schedule, time(8))
        self.assertEqual(caught.exception.code, 'SLOT_UNAVAILABLE')
        self.assertEqual(reserve_interval(db, schedule, time(8, 30))[0], end)

    def test_reject_off_grid_and_shift_end(self):
        for value in (time(8, 15), time(9)):
            with self.assertRaises(AppError) as caught:
                reserve_interval(self.database(), self.schedule(), value)
            self.assertEqual(caught.exception.code, 'INVALID_APPOINTMENT_TIME')

    def test_walk_in_uses_next_free_future_interval(self):
        now = datetime(2035, 1, 1, 1, 10, tzinfo=timezone.utc)
        start, _ = reserve_interval(self.database(), self.schedule(), now=now)
        self.assertEqual(start.strftime('%H:%M'), '08:30')

    def test_schema_requires_time_and_rejects_seconds_or_client_ticket(self):
        body = dict(patient_id=1, schedule_id=1, appointment_time='08:30')
        self.assertEqual(validate_online(body)['appointment_time'], time(8, 30))
        for invalid in ({'patient_id': 1, 'schedule_id': 1},
                        {**body, 'appointment_time': '08:30:59'},
                        {**body, 'ticket_code': 'FAKE'}):
            with self.assertRaises(AppError):
                validate_online(invalid)
