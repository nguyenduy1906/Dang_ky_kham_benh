from backend.app.core.errors import bad_request
from backend.app.utils.validation import ensure_object, text_field, flag_field, int_field
from urllib.parse import urlparse
import re

PROFILE_TEXT = {'overview': 12000,'mission': 4000,'cover_image_url': 2000}
PROFILE_LISTS = {'specialties','clinical_services','equipment','achievements','patient_guide'}


def _image_url(value):
    if value is None: return None
    if not isinstance(value,str) or len(value)>2000: raise bad_request('Đường dẫn ảnh không hợp lệ')
    parsed=urlparse(value)
    if re.fullmatch(r'/uploads/(articles|avatars)/[a-f0-9]{32}\.(jpg|png|webp)',value) or (parsed.scheme=='https' and parsed.netloc and not parsed.username and not parsed.password): return value
    raise bad_request('Ảnh phải dùng URL /uploads/ hợp lệ hoặc HTTPS')


def _department_profile(data, fields):
    allowed={'name','description','is_active','expected_version','content_is_demo','group_type','gallery','extra_sections'} | set(PROFILE_TEXT) | PROFILE_LISTS
    if set(data)-allowed: raise bad_request('Có trường chuyên khoa không được phép')
    for key,maximum in PROFILE_TEXT.items():
        if key in data:
            fields[key]=text_field(data,key,max_len=maximum)
            if key=='cover_image_url': fields[key]=_image_url(fields[key])
    if 'group_type' in data:
        if data['group_type'] not in ('CLINICAL','PARACLINICAL'): raise bad_request('Khối chuyên khoa không hợp lệ')
        fields['group_type']=data['group_type']
    if 'content_is_demo' in data: fields['content_is_demo']=flag_field(data,'content_is_demo')
    if 'expected_version' in data: fields['expected_version']=int_field(data,'expected_version',required=True,minimum=1)
    for key in PROFILE_LISTS:
        if key in data:
            values=data[key]
            if not isinstance(values,list) or len(values)>30: raise bad_request(f'{key} phải là danh sách tối đa 30 mục')
            fields[key]=[text_field({'item':v},'item',required=True,max_len=1000) for v in values]
    for key in ('gallery','extra_sections'):
        if key in data:
            values=data[key]
            if not isinstance(values,list) or len(values)>20: raise bad_request(f'{key} phải là danh sách tối đa 20 mục')
            fields[key]=[]
            for value in values:
                value=ensure_object(value)
                if key=='gallery':
                    if set(value)-{'url','caption'} or 'url' not in value: raise bad_request('Ảnh khoa cần url và caption')
                    url=_image_url(value['url'])
                    if not url: raise bad_request('Ảnh khoa cần URL')
                    fields[key].append({'url':url,'caption':text_field(value,'caption',max_len=500) or ''})
                else:
                    if set(value)-{'title','content'}: raise bad_request('Mục nội dung khoa chỉ nhận title và content')
                    fields[key].append({'title':text_field(value,'title',required=True,max_len=200),'content':text_field(value,'content',required=True,max_len=12000)})
    return fields


def validate_leadership(data):
    data=ensure_object(data)
    if set(data)-{'head_doctor_id','deputy_doctor_ids','expected_version'} or 'head_doctor_id' not in data or 'deputy_doctor_ids' not in data:
        raise bad_request('Cần head_doctor_id, deputy_doctor_ids và expected_version')
    head=int_field(data,'head_doctor_id',minimum=1) if data['head_doctor_id'] is not None else None
    deputies=data['deputy_doctor_ids']
    if not isinstance(deputies,list) or len(deputies)>20: raise bad_request('Danh sách phó khoa tối đa 20 người')
    deputies=[int_field({'id':value},'id',required=True,minimum=1) for value in deputies]
    if len(set(deputies))!=len(deputies) or head in deputies: raise bad_request('Bác sĩ không được giữ hai chức vụ lãnh đạo cùng lúc')
    return {'head_doctor_id':head,'deputy_doctor_ids':deputies,'expected_version':int_field(data,'expected_version',required=True,minimum=1)}


def validate_department_create(data):
    data = ensure_object(data)
    if 'expected_version' in data:
        raise bad_request('expected_version chỉ dùng khi cập nhật khoa')
    return _department_profile(data, {'name': text_field(data, 'name', required=True, max_len=150),
            'description': text_field(data, 'description', max_len=1000),
            'is_active': flag_field(data, 'is_active') if 'is_active' in data else 1})


def validate_department_update(data):
    data = ensure_object(data)
    fields = {}
    if 'name' in data:
        fields['name'] = text_field(data, 'name', required=True, max_len=150)
    if 'description' in data:
        fields['description'] = text_field(data, 'description', max_len=1000)
    if 'is_active' in data:
        fields['is_active'] = flag_field(data, 'is_active')
    _department_profile(data,fields)
    if not set(fields)-{'expected_version'}:
        raise bad_request('Không có trường nào để cập nhật')
    return fields


def validate_room_create(data):
    data = ensure_object(data)
    return {'department_id': int_field(data, 'department_id', required=True, minimum=1),
            'room_name': text_field(data, 'room_name', required=True, max_len=100),
            'description': text_field(data, 'description', max_len=1000),
            'is_active': flag_field(data, 'is_active') if 'is_active' in data else 1}


def validate_room_update(data):
    data = ensure_object(data)
    fields = {}
    if 'department_id' in data:
        fields['department_id'] = int_field(data, 'department_id', required=True, minimum=1)
    if 'room_name' in data:
        fields['room_name'] = text_field(data, 'room_name', required=True, max_len=100)
    if 'description' in data:
        fields['description'] = text_field(data, 'description', max_len=1000)
    if 'is_active' in data:
        fields['is_active'] = flag_field(data, 'is_active')
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields
