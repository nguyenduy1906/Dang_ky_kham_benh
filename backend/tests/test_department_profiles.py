"""Department content, leadership permissions, history and concurrency in isolated schemas."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch
from PIL import Image
import psycopg
from backend.tests import test_nurse_assignment
from backend.app.db.database import get_db_connection


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS')=='1','Requires PostgreSQL disposable schema')
class DepartmentProfileTests(unittest.TestCase):
    setUp=test_nurse_assignment.NurseAssignmentTests.setUp
    drop_schema=test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers=test_nurse_assignment.NurseAssignmentTests.headers

    def payload(self,**extra):
        version=self.client.get('/departments/1',headers=self.headers('ADMIN')).json['department']['version']
        return {'head_doctor_id':1,'deputy_doctor_ids':[11],'expected_version':version,**extra}

    def test_public_profiles_and_admin_content_management(self):
        preflight=self.client.options('/admin/departments/1/leadership',headers={
            'Origin':'http://127.0.0.1:3000','Access-Control-Request-Method':'PUT',
            'Access-Control-Request-Headers':'Authorization, Content-Type'})
        self.assertIn('PUT',preflight.headers['Access-Control-Allow-Methods'])
        result=self.client.get('/departments/1').json
        self.assertEqual(result['department']['leadership']['head']['doctor_profile_id'],1)
        self.assertEqual(result['department']['leadership']['deputies'][0]['doctor_profile_id'],11)
        self.assertEqual(len(result['doctors']),2)
        self.assertTrue(result['department']['overview'])
        self.assertNotIn('appointed_by_id',result['department']['leadership']['head'])
        self.assertNotIn('email',result['doctors'][0])
        fields={'name':'Khoa kiểm thử hồ sơ','group_type':'PARACLINICAL','overview':'Tổng quan riêng','specialties':['Chuyên môn riêng'],
                'extra_sections':[{'title':'Mục do admin tạo','content':'Nội dung riêng'}]}
        for headers,status in [({},401),(self.headers('USER'),403),(self.headers('NURSE'),403)]:
            self.assertEqual(self.client.post('/admin/departments',headers=headers,json=fields).status_code,status)
        created=self.client.post('/admin/departments',headers=self.headers('ADMIN'),json=fields)
        self.assertEqual(created.status_code,201,created.json)
        did=created.json['department']['department_id']
        profile=self.client.get(f'/departments/{did}').json['department']
        self.assertEqual(profile['specialties'],fields['specialties'])
        self.assertEqual(profile['leadership'],{'head':None,'deputies':[]})
        updated=self.client.patch(f'/admin/departments/{did}',headers=self.headers('ADMIN'),json={'overview':'Đổi nội dung','expected_version':profile['version']})
        self.assertEqual(updated.status_code,200,updated.json)
        self.assertEqual(self.client.patch(f'/admin/departments/{did}',headers=self.headers('ADMIN'),json={'overview':'Cũ','expected_version':profile['version']}).status_code,409)
        self.assertEqual(self.client.patch(f'/admin/departments/{did}',headers=self.headers('ADMIN'),json={'is_active':False}).status_code,200)
        self.assertEqual(self.client.get(f'/departments/{did}').status_code,404)
        self.assertEqual(self.client.get(f'/departments/{did}',headers=self.headers('ADMIN')).status_code,200)
        self.assertNotIn(did,[d['department_id'] for d in self.client.get('/departments').json['items']])
        self.assertEqual(self.client.get('/apispec_1.json').status_code,200)

    def test_leadership_history_role_swap_and_validation_rollback(self):
        url='/admin/departments/1/leadership'; admin=self.headers('ADMIN')
        self.assertEqual(self.client.put(url,json=self.payload()).status_code,401)
        self.assertEqual(self.client.get(url,headers=self.headers('USER')).status_code,403)
        for values in ({'head_doctor_id':2},{'deputy_doctor_ids':[1]},{'deputy_doctor_ids':[11,11]},{'deputy_doctor_ids':[True]}):
            response=self.client.put(url,headers=admin,json=self.payload(**values))
            self.assertEqual(response.status_code,400,response.json)
        before=self.client.get(url,headers=admin).json['items']
        swapped=self.client.put(url,headers=admin,json=self.payload(head_doctor_id=11,deputy_doctor_ids=[1]))
        self.assertEqual(swapped.status_code,200,swapped.json)
        self.assertEqual(swapped.json['department']['leadership']['head']['doctor_profile_id'],11)
        history=self.client.get(url,headers=admin).json['items']
        self.assertEqual(len(history),len(before)+2)
        self.assertEqual(sum(item['ended_at'] is not None for item in history),2)
        self.assertTrue(all(item['ended_by_id'] for item in history if item['ended_at']))
        self.assertEqual(self.client.put(url,headers=admin,json=self.payload(head_doctor_id=11,deputy_doctor_ids=[1])).status_code,200)
        self.assertEqual(len(self.client.get(url,headers=admin).json['items']),len(history))
        cleared=self.client.put(url,headers=admin,json=self.payload(head_doctor_id=None,deputy_doctor_ids=[]))
        self.assertEqual(cleared.status_code,200)
        self.assertEqual(cleared.json['department']['leadership'],{'head':None,'deputies':[]})
        self.assertEqual(self.client.patch('/admin/doctors/11',headers=admin,json={'department_id':2}).status_code,200)

    def test_active_leader_cannot_transfer_and_database_constraints_hold(self):
        response=self.client.patch('/admin/doctors/1',headers=self.headers('ADMIN'),json={'department_id':2})
        self.assertEqual(response.status_code,409,response.json)
        with get_db_connection() as db:
            for values in ((1,11,'HEAD'),(1,2,'DEPUTY')):
                with self.assertRaises(psycopg.IntegrityError),db.transaction():
                    db.execute('INSERT INTO department_leadership(department_id,doctor_profile_id,position,appointed_by_id) VALUES(%s,%s,%s,1)',values)
            with self.assertRaises(psycopg.IntegrityError),db.transaction():
                db.execute('UPDATE doctor_profile SET department_id=2 WHERE doctor_profile_id=1')
            self.assertEqual(db.execute('SELECT department_id FROM doctor_profile WHERE doctor_profile_id=1').fetchone()['department_id'],1)

    def test_simultaneous_leadership_edits_have_one_winner(self):
        body=self.payload(head_doctor_id=11,deputy_doctor_ids=[1]); headers=self.headers('ADMIN')
        def replace():
            return self.client.application.test_client().put('/admin/departments/1/leadership',headers=headers,json=body).status_code
        with ThreadPoolExecutor(max_workers=2) as pool: statuses=list(pool.map(lambda _:replace(),range(2)))
        self.assertEqual(sorted(statuses),[200,409])
        self.assertEqual(sum(row['ended_at'] is None and row['position']=='HEAD' for row in self.client.get('/admin/departments/1/leadership',headers=headers).json['items']),1)

    def test_invalid_profile_fields_and_image_upload(self):
        headers=self.headers('ADMIN')
        for values in ({'specialties':'bad'},{'gallery':[{'url':'javascript:alert(1)'}]},{'extra_sections':[{'title':'Missing'}]},{'group_type':'wrong'},{'extra_unknown':1}):
            self.assertEqual(self.client.patch('/admin/departments/1',headers=headers,json=values).status_code,400)
        with TemporaryDirectory() as folder,patch.dict(os.environ,{'UPLOAD_DIR':folder}):
            data=BytesIO(); Image.new('RGB',(20,20),'green').save(data,'PNG'); data.seek(0)
            response=self.client.post('/admin/departments/1/images',headers=headers,data={'file':(data,'image.png')})
            self.assertEqual(response.status_code,201,response.json)
            image=self.client.get(response.json['url']); self.assertEqual(image.status_code,200); image.close(); response.close()
        with get_db_connection() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM encounter').fetchone()['n'],10)
