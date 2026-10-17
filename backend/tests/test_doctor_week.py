import unittest
from datetime import date
from unittest.mock import MagicMock,patch
from backend.app.services import schedule_service
from flask import Flask
from backend.app.routes.schedule_routes import schedule_bp

class DoctorWeekTests(unittest.TestCase):
    def query(self, **extra):
        return {'from_date': date(2026,10,1), 'to_date': date(2026,11,30), 'status': None, 'page':1,'page_size':100,**extra}

    def fetch(self, query, today):
        db=MagicMock()
        with patch.object(schedule_service,'get_db_connection') as connection, patch.object(schedule_service.doctor_model,'get_by_id',return_value={'is_active':True,'account_ok':True}), patch.object(schedule_service.schedule_model,'list_schedules',return_value=([],0)) as listing, patch.object(schedule_service,'today_vn',return_value=today):
            connection.return_value.__enter__.return_value=db
            result=schedule_service.list_doctor_public(9,query)
            return result,listing.call_args.kwargs

    def test_week_is_monday_to_sunday_even_at_year_boundary(self):
        for today,start,end in [(date(2026,10,14),date(2026,10,12),date(2026,10,18)),(date(2027,1,3),date(2026,12,28),date(2027,1,3))]:
            result,args=self.fetch(self.query(current_week=True),today)
            self.assertEqual((args['from_date'],args['to_date']),(start,end))
            self.assertTrue(args['exclude_closed'])
            self.assertEqual(result['items'],[])

    def test_booking_default_still_excludes_past_dates(self):
        _,args=self.fetch(self.query(),date(2026,10,14))
        self.assertEqual(args['from_date'],date(2026,10,14))
        self.assertEqual(args['to_date'],date(2026,11,30))

    def test_public_route_passes_week_flag_without_authentication(self):
        app=Flask(__name__)
        app.register_blueprint(schedule_bp)
        with patch.object(schedule_service,'list_doctor_public',return_value={'items':[],'total':0,'page':1,'page_size':20}) as listing:
            response=app.test_client().get('/doctors/9/schedules?current_week=true')
            self.assertEqual(response.status_code,200)
            self.assertTrue(listing.call_args.args[1]['current_week'])
            self.assertEqual(listing.call_args.args[0],9)

import os
from datetime import datetime,timezone
from backend.tests import test_nurse_assignment
from backend.app.db.database import get_db_connection

@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS')=='1','Requires disposable PostgreSQL schema')
class DoctorProfileIntegrationTests(unittest.TestCase):
    setUp=test_nurse_assignment.NurseAssignmentTests.setUp
    drop_schema=test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers=test_nurse_assignment.NurseAssignmentTests.headers

    def test_week_returns_past_days_without_slots_and_default_booking_excludes_them(self):
        today=date(2026,10,14)
        with get_db_connection() as db:
            db.execute("DELETE FROM work_schedule WHERE doctor_profile_id=1 AND work_date>='2026-10-12'")
            for day in ('2026-10-12','2026-10-15','2026-10-19'):
                db.execute("INSERT INTO work_schedule(doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes,schedule_status) VALUES(1,1,%s,'08:00','11:30',7,30,'OPEN')",(day,))
        with patch.object(schedule_service,'today_vn',return_value=today),patch('backend.app.services.encounter_service.utc_now',return_value=datetime(2026,10,14,0,0,tzinfo=timezone.utc)):
            weekly=self.client.get('/doctors/1/schedules?current_week=true&page_size=100')
            self.assertEqual(weekly.status_code,200,weekly.json)
            self.assertEqual([row['work_date'] for row in weekly.json['items']],['2026-10-12','2026-10-15'])
            self.assertEqual(weekly.json['items'][0]['slots'],[])
            self.assertGreater(len(weekly.json['items'][1]['slots']),0)
            normal=self.client.get('/doctors/1/schedules?page_size=100')
            self.assertEqual([row['work_date'] for row in normal.json['items']],['2026-10-15','2026-10-19'])

    def test_public_reviews_paginate_without_identity_and_writes_require_completed_visible_encounter(self):
        public=self.client.get('/doctors/1/reviews?page_size=1')
        self.assertEqual(public.status_code,200,public.json)
        self.assertEqual(public.json['page_size'],1)
        for row in public.json['items']:
            self.assertEqual(set(row),{'review_id','review_code','rating','comment','created_at'})
        with get_db_connection() as db:
            row=db.execute("SELECT e.encounter_id,m.record_id FROM encounter e JOIN medical_record m USING(encounter_id) WHERE e.encounter_status='COMPLETED' ORDER BY e.encounter_id LIMIT 1").fetchone()
            db.execute('DELETE FROM review WHERE record_id=%s',(row['record_id'],))
            db.execute('UPDATE encounter SET created_by_id=%s WHERE encounter_id=%s',(self.actors['USER']['user_id'],row['encounter_id']))
        path=f"/encounters/{row['encounter_id']}/review"
        payload={'rating':5,'comment':'Kiểm thử trong schema tạm.'}
        visible=self.client.get(f"/encounters/{row['encounter_id']}",headers=self.headers('USER'))
        self.assertFalse(visible.json['encounter']['has_review'])
        self.assertEqual(self.client.post(path,json=payload).status_code,401)
        result=self.client.post(path,headers=self.headers('USER'),json=payload)
        self.assertEqual(result.status_code,201,result.json)
        visible=self.client.get(f"/encounters/{row['encounter_id']}",headers=self.headers('USER'))
        self.assertTrue(visible.json['encounter']['has_review'])
        again=self.client.post(path,headers=self.headers('USER'),json=payload)
        self.assertEqual(again.status_code,201,again.json)
        self.assertNotEqual(result.json['review']['review_id'],again.json['review']['review_id'])
        third=self.client.post(path,headers=self.headers('USER'),json={'rating':4,'comment':'Đánh giá lần tiếp theo.'})
        self.assertEqual(third.status_code,201,third.json)
        published=self.client.get('/doctors/1/reviews')
        self.assertEqual(published.json['total'],3)
        self.assertEqual(published.json['average_rating'],4.67)
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) AS n FROM review WHERE record_id=%s',(row['record_id'],)).fetchone()['n'],3)
            db.execute("UPDATE encounter SET encounter_status='CONFIRMED' WHERE encounter_id=%s",(row['encounter_id'],))
        self.assertEqual(self.client.post(path,headers=self.headers('USER'),json=payload).status_code,409)

if __name__=='__main__': unittest.main()
