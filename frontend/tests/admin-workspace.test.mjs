import test from 'node:test';
import assert from 'node:assert/strict';
import {initAdminWorkspace} from '../static/js/core/admin_workspace.js';
import {resources} from '../static/js/core/admin_resources.js';
import {setAccessToken} from '../static/js/core/api.js';
import {installDom,trigger,tick} from './helpers/admin-dom.mjs';
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const user={user_id:7,full_name:'Nhân viên API <kiểm thử>',email:'staff@example.test',phone:'0902000001',role_name:'NURSE',account_status:'ACTIVE',approval_status:'APPROVED',is_deleted:false};
const doctor={doctor_profile_id:8,user_id:9,department_id:2,full_name:'Bác sĩ API',department_name:'Khoa API',academic_degree:'ThS',specialization:'Nội',experience_years:0,consultation_fee:200000,is_active:true,account_ok:true};
const department={department_id:2,name:'Khoa API',description:'Nội dung API',is_active:true,version:3,group_type:'CLINICAL',doctor_count:1,leadership:{head:null,deputies:[]}};
const room={room_id:4,department_id:2,department_name:'Khoa API',room_name:'Phòng API',is_active:true};
const schedule={schedule_id:3,doctor_profile_id:8,doctor_name:'Bác sĩ API',room_id:4,room_name:'Phòng API',work_date:day,start_time:'08:00:00',end_time:'12:00:00',slot_minutes:30,max_quota:8,booked_count:2,schedule_status:'OPEN'};
const patient={patient_id:5,full_name:'Người bệnh API',phone:'0902000002',dob:'2000-01-01',id_card:null,is_archived:false};
const assignment={assignment_id:6,nurse_id:7,nurse_name:'Nhân viên API',schedule_id:3,work_date:day,start_time:'08:00:00',end_time:'12:00:00',room_name:'Phòng API',revoked_at:null};
const article={article_id:11,title:'Bài viết API',slug:'bai-viet-api',content:'<img src=x onerror=alert(1)>',is_active:false,category:'Tin tức',published_at:null};
const encounter={encounter_id:10,patient_id:5,patient_name:'Người bệnh API',doctor_name:'Bác sĩ API',work_date:day,encounter_status:'COMPLETED',encounter_type:'ONLINE',ticket_code:'API-10',consultation_fee_snapshot:200000,deposit_amount_snapshot:200000};
const payment={payment_id:12,encounter_id:10,payment_type:'DEPOSIT',amount:200000,transaction_status:'SUCCESS',payment_method:'CASH',created_at:`${day}T00:00:00Z`};
const req={request_id:13,staff_name:'Nhân viên xin nghỉ',user_id:7,role_name:'NURSE',from_date:day,to_date:day,period:'MORNING',reason:'Việc gia đình',status:'PENDING'};
const rows={'/admin/users':[user],'/patients':[patient],'/doctors':[doctor],'/departments':[department],'/rooms':[room],'/admin/schedules':[schedule],'/admin/nurse-assignments':[assignment],'/admin/articles':[article],'/encounters':[encounter],'/admin/leave-requests':[req]};
function fixture(page,respond){
  const dom=installDom(page),calls=[];setAccessToken('admin-test-token');
  const paged=(items,params)=>({items,total:items.length,page:Number(params.get('page') || 1),page_size:Number(params.get('page_size') || 12)});
  globalThis.fetch=async(url,options)=>{
    const parsed=new URL(url),path=parsed.pathname,body=typeof options.body==='string'?JSON.parse(options.body):options.body;
    const call={path,params:parsed.searchParams,method:options.method,body,signal:options.signal};calls.push(call);
    const custom=await respond?.(call);if(custom)return custom;
    if(path==='/admin/roles')return Response.json({items:['DOCTOR','NURSE','RECEPTIONIST','ADMIN','USER'].map(role_name=>({role_name}))});
    if(path==='/admin/statistics/encounters')return Response.json({...paged([{group_value:day,total:3,online_count:2,walk_in_count:1}],parsed.searchParams),summary:{total:3,online_count:2,walk_in_count:1},by_status:[{encounter_status:'COMPLETED',count:2}]});
    if(path==='/admin/statistics/payments')return Response.json({...paged([{group_value:day,transaction_count:3,deposit_received:200000,exam_fee_received:100000,refunded_amount:50000,net_received:250000}],parsed.searchParams),summary:{net_received:250000}});
    if(path==='/admin/statistics/reviews')return Response.json({...paged([{group_value:day,review_count:2,average_rating:4.5}],parsed.searchParams),summary:{review_count:2,average_rating:4.5},rating_distribution:[{rating:4,count:1},{rating:5,count:1}]});
    if(path==='/admin/configurations')return Response.json(paged([{config_key:'HOSPITAL_NAME',config_value:'Cơ sở API',effective_value:'Cơ sở API',read_only:false},{config_key:'DEFAULT_DEPOSIT_PERCENT',config_value:'30',effective_value:'100',read_only:true}],parsed.searchParams));
    if(path==='/admin/audit/encounters')return Response.json(paged([{encounter_id:10,encounter_status:'COMPLETED',consultation_fee_snapshot:null,gross_received:200000,refunded_amount:50000,net_received:150000,issues:['PRICE_SNAPSHOT_MISSING'],status_history:[],transfer_history:[],payment_history:[],medical_revision_history:[]}],parsed.searchParams));
    if(path==='/admin/users/7')return Response.json({user});
    if(path==='/patients/5')return Response.json({patient});
    if(path==='/doctors/8')return Response.json({doctor});
    if(path==='/departments/2')return Response.json({department});
    if(path==='/admin/departments/2/leadership')return Response.json({version:3,items:[]});
    if(path==='/payments/12')return Response.json({payment});
    if(path==='/encounters/10/payments')return Response.json(paged([payment],parsed.searchParams));
    if(path==='/admin/leave-requests/13')return Response.json({leave_request:req,affected_schedule_ids:[3],affected_encounters:2});
    if(rows[path]){const items=path==='/admin/users'&&parsed.searchParams.get('role')==='DOCTOR'?[{...user,user_id:9,role_name:'DOCTOR'}]:rows[path];return Response.json(paged(items,parsed.searchParams));}
    throw new Error(`Unexpected request ${options.method} ${path}`);
  };
  return {...dom,calls};
}
for(const [page,config]of Object.entries(resources))test(`${page} loads real API rows and has no preview writes on entry`,async()=>{
  const f=fixture(page);try{await initAdminWorkspace(page);assert.ok(f.calls.some(c=>c.path===({users:'/admin/users',patients:'/patients',doctors:'/doctors',departments:'/departments',rooms:'/rooms',schedule:'/admin/schedules',assignments:'/admin/nurse-assignments',articles:'/admin/articles',encounters:'/encounters'})[page]));assert.ok(f.calls.every(c=>c.method==='GET'));assert.match(f.$('#admin-results').innerHTML,/API/);assert.equal(f.$('#admin-status').hidden,true);if(page==='schedule')assert.match(f.$('#leave-results').innerHTML,/Nhân viên xin nghỉ/);}finally{f.restore();}
});
for(const page of ['home','statistics'])test(`${page} uses backend summaries and passes the selected date range`,async()=>{
  const f=fixture(page);try{await initAdminWorkspace(page);assert.match(f.$('#page-body').innerHTML,/<strong>3<\/strong>/);assert.match(f.$('#page-body').innerHTML,/250\.000/);assert.equal(f.$('select[name="period"]').value,'today');assert.ok(f.calls.filter(c=>c.path.startsWith('/admin/statistics/')).every(c=>c.params.get('from_date')===day&&c.params.get('to_date')===day));const period=f.$('select[name="period"]');period.value='month';await trigger(period,'change');assert.equal(f.calls.filter(c=>c.path==='/admin/statistics/encounters').at(-1).params.get('from_date'),`${day.slice(0,7)}-01`);assert.equal(f.$('#overview-feedback').textContent,'');}finally{f.restore();}
});
test('configuration obeys read_only and displays effective policy values',async()=>{const f=fixture('configuration');try{await initAdminWorkspace('configuration');assert.match(f.$('#page-body').innerHTML,/<strong>100<\/strong>/);assert.equal(f.root.querySelectorAll('[data-form="configuration"]').length,1);const form=f.$('[data-form="configuration"]');form.elements.config_value.value='Cơ sở mới';globalThis.fetch=async(url,opt)=>{f.calls.push({path:new URL(url).pathname,method:opt.method,body:JSON.parse(opt.body)});return Response.json({configuration:{config_key:'HOSPITAL_NAME',config_value:'Cơ sở mới',effective_value:'Cơ sở mới',read_only:false}});};await trigger(form,'submit');assert.deepEqual(f.calls.at(-1).body,{config_value:'Cơ sở mới'});assert.equal(form.querySelector('[role="status"]').textContent,'Đã lưu.');}finally{f.restore();}});
test('payment lookup does not invent a global payments list and keeps refund policy on the backend',async()=>{const f=fixture('payments');try{location.search='?encounter_id=10';await initAdminWorkspace('payments');assert.match(f.$('#payment-results').innerHTML,/200\.000/);assert.ok(f.calls.every(c=>c.path==='/encounters/10/payments'));await trigger(f.$('[data-action="refund"]'),'click');assert.match(f.$('#admin-dialog-body').innerHTML,/Số tiền được hoàn theo chính sách/);const form=f.$('[data-form="refund"]');form.elements.reason.value='Hoàn theo chính sách';globalThis.fetch=async(url,opt)=>{f.calls.push({path:new URL(url).pathname,method:opt.method,body:typeof opt.body==='string'?JSON.parse(opt.body):null});if(opt.method==='POST')return Response.json({amount_refunded:100000});return Response.json({items:[payment],total:1,page:1,page_size:12});};await trigger(form,'submit');const write=f.calls.find(c=>c.method==='POST');assert.equal(write.path,'/admin/payments/12/refund');assert.deepEqual(write.body,{reason:'Hoàn theo chính sách'});}finally{f.restore();}});
test('audit renders backend issues and never replaces missing price snapshots with zero',async()=>{const f=fixture('audit');try{await initAdminWorkspace('audit');assert.match(f.$('#audit-results').innerHTML,/Thiếu giá khám đã chốt/);assert.match(f.$('#audit-results').innerHTML,/Chưa có giá chốt/);assert.ok(f.calls.every(c=>c.method==='GET'));}finally{f.restore();}});

test('business codes render in lists and encounter filters send numeric resource ids',async()=>{
  const f=fixture('encounters');
  try {
    await initAdminWorkspace('encounters');
    assert.match(f.$('#admin-results').innerHTML,/LK_010/);
    const form=f.$('#resource-filter');
    form.elements.patient_id.value='BN_005'; form.elements.schedule_id.value='CA_003';
    await trigger(form,'submit');
    const call=f.calls.filter(c=>c.path==='/encounters').at(-1);
    assert.equal(call.params.get('patient_id'),'5'); assert.equal(call.params.get('schedule_id'),'3');
    const count=f.calls.length;form.elements.patient_id.value='BS_005';
    await trigger(form,'submit');
    assert.equal(f.calls.length,count);
    assert.match(f.$('#admin-status').textContent,/Mã không hợp lệ/);
  } finally { f.restore(); }
});

test('payment lookup accepts the displayed TT code and reads the original numeric endpoint',async()=>{
  const f=fixture('payments');
  try {
    await initAdminWorkspace('payments'); const form=f.$('#payment-search');
    form.elements.payment_id.value='TT_012'; await trigger(form,'submit');
    assert.equal(f.calls.at(-1).path,'/payments/12');
    assert.match(f.$('#payment-results').innerHTML,/TT_012/);
  } finally { f.restore(); }
});

const creates={
  users:{full_name:'Nhân viên mới',email:'new@example.test',phone:'0902000003',password:'Pass-with-space-123 ',role:'NURSE',approval_status:'APPROVED'},
  patients:{full_name:'Người bệnh mới',phone:'0902000003',dob:'2001-02-03',gender:'Nữ',confirm_shared_phone:true},
  doctors:{user_id:'9',department_id:'2',academic_degree:'ThS',specialization:'Nội',experience_years:'0',consultation_fee:'300000',introduction:'Giới thiệu',is_active:'true'},
  departments:{name:'Khoa mới',description:'Mô tả',group_type:'CLINICAL',is_active:'true',gallery:'[]',extra_sections:'[]'},
  rooms:{department_id:'2',room_name:'Phòng mới',description:'Mô tả',is_active:'true'},
  schedule:{doctor_profile_id:'8',room_id:'4',work_date:day,start_time:'08:00',end_time:'12:00',slot_minutes:'30',max_quota:'8'},
  assignments:{nurse_id:'7',schedule_id:'3',note:'Phân công mới'},
  articles:{title:'Tin mới',slug:'tin-moi',category:'Tin tức',content:'Nội dung mới',is_active:'false'},
};
const createPaths={users:'/admin/users',patients:'/patients',doctors:'/admin/doctors',departments:'/admin/departments',rooms:'/admin/rooms',schedule:'/admin/schedules',assignments:'/admin/nurse-assignments',articles:'/admin/articles'};
for(const [page,raw]of Object.entries(creates))test(`${page} create sends backend field names and only writes after form submission`,async()=>{
  const f=fixture(page,c=>c.method==='POST'?Response.json({saved:true}):null);
  try{
    await initAdminWorkspace(page);await trigger(f.$('#add-record'),'click');
    const form=f.$('[data-form="resource"]');assert.ok(form);if(page==='users')assert.equal(form.elements.approval_status.value,'APPROVED');
    assert.equal(f.calls.some(c=>c.method!=='GET'),false);
    for(const[key,value]of Object.entries(raw)){if(['gallery','extra_sections'].includes(key))continue;assert.ok(form.elements[key],key);if(form.elements[key].type==='checkbox')form.elements[key].checked=value===true;else form.elements[key].value=value;}
    await trigger(form,'submit');
    const writes=f.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1,form.querySelector('[role="status"]').textContent);assert.equal(writes[0].path,createPaths[page]);
    const expected={
      users:creates.users,
      patients:{full_name:'Người bệnh mới',dob:'2001-02-03',phone:'0902000003',gender:'Nữ',id_card:null,address:null,health_insurance:null,confirm_shared_phone:true},
      doctors:{user_id:9,department_id:2,academic_degree:'ThS',specialization:'Nội',experience_years:0,consultation_fee:300000,introduction:'Giới thiệu',is_active:true},
      departments:{name:'Khoa mới',description:'Mô tả',group_type:'CLINICAL',is_active:true,overview:null,mission:null,cover_image_url:null,specialties:[],clinical_services:[],equipment:[],achievements:[],patient_guide:[],gallery:[],extra_sections:[],content_is_demo:false},
      rooms:{department_id:2,room_name:'Phòng mới',description:'Mô tả',is_active:true},
      schedule:{doctor_profile_id:8,room_id:4,work_date:day,start_time:'08:00',end_time:'12:00',slot_minutes:30,max_quota:8},
      assignments:{nurse_id:7,schedule_id:3,note:'Phân công mới'},
      articles:{title:'Tin mới',slug:'tin-moi',category:'Tin tức',thumbnail_url:null,content:'Nội dung mới',is_active:false},
    };
    assert.deepEqual(writes[0].body,expected[page]);
    assert.equal(f.$('#admin-dialog').open,false);
    if(page==='users')assert.equal(writes[0].body.password,'Pass-with-space-123 ');
    if(page==='articles')assert.equal(writes[0].body.is_active,false);
  }finally{f.restore();}
});
test('booked schedule edits lock room/date/time and send only editable fields',async()=>{
  const f=fixture('schedule',c=>c.method==='PATCH'?Response.json({schedule}):null);
  try{await initAdminWorkspace('schedule');await trigger(f.$('[data-action="edit"]'),'click');const form=f.$('[data-form="resource"]');assert.equal(form.elements.room_id.disabled,true);assert.equal(form.elements.work_date.disabled,true);form.elements.max_quota.value='10';await trigger(form,'submit');const write=f.calls.find(c=>c.method==='PATCH');assert.deepEqual(write.body,{max_quota:10,schedule_status:'OPEN'});assert.equal(write.path,'/admin/schedules/3');}finally{f.restore();}
});
test('department edits preserve the expected version and escape detail/article content',async()=>{
  const f=fixture('departments',c=>c.method==='PATCH'?Response.json({department}):null);
  try{await initAdminWorkspace('departments');await trigger(f.$('[data-action="edit"]'),'click');const form=f.$('[data-form="resource"]');form.elements.name.value='Khoa đổi tên';await trigger(form,'submit');assert.equal(f.calls.find(c=>c.method==='PATCH').body.expected_version,3);}finally{f.restore();}
  const a=fixture('articles');try{await initAdminWorkspace('articles');await trigger(a.$('[data-action="detail"]'),'click');assert.match(a.$('#admin-dialog-body').innerHTML,/&lt;img src=x/);assert.doesNotMatch(a.$('#admin-dialog-body').innerHTML,/<img src=x/);}finally{a.restore();}
});
test('a failed save retains inputs, reenables controls and allows a successful retry',async()=>{
  let fail=true;const f=fixture('rooms',c=>c.method==='POST'?(fail?Response.json({error:{code:'DUPLICATE_ROOM',message:'Phòng đã tồn tại'}},{status:409}):Response.json({room})):null);
  try{await initAdminWorkspace('rooms');await trigger(f.$('#add-record'),'click');const form=f.$('[data-form="resource"]');form.elements.department_id.value='2';form.elements.room_name.value='Phòng đang nhập';await trigger(form,'submit');assert.equal(f.$('#admin-dialog').open,true);assert.equal(form.elements.room_name.value,'Phòng đang nhập');assert.equal(form.querySelector('[role="status"]').textContent,'Phòng đã tồn tại');assert.ok(form.querySelectorAll('button').every(b=>!b.disabled));fail=false;await trigger(form,'submit');assert.equal(f.$('#admin-dialog').open,false);}finally{f.restore();}
});
test('duplicate submission is blocked while a write is pending',async()=>{
  let finish;const f=fixture('rooms',c=>c.method==='POST'?new Promise(resolve=>{finish=resolve;}):null);
  try{await initAdminWorkspace('rooms');await trigger(f.$('#add-record'),'click');const form=f.$('[data-form="resource"]');form.elements.department_id.value='2';form.elements.room_name.value='Phòng mới';await trigger(form,'submit');await trigger(form,'submit');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);finish(Response.json({room}));await tick();assert.equal(f.$('#admin-dialog').open,false);}finally{f.restore();}
});
test('revocation requires confirmation and sends no actor ids or fabricated status',async()=>{
  const f=fixture('assignments',c=>c.method==='POST'?Response.json({assignment:{...assignment,revoked_at:'2026-10-17T01:00:00Z'}}):null);
  try{await initAdminWorkspace('assignments');await trigger(f.$('[data-action="revoke"]'),'click');assert.equal(f.calls.filter(c=>c.method==='POST').length,0);await trigger(f.$('[data-form="confirm"]'),'submit');const write=f.calls.find(c=>c.method==='POST');assert.equal(write.path,'/admin/nurse-assignments/6/revoke');assert.equal(write.body,undefined);}finally{f.restore();}
});
test('leave approval reads affected encounters first and submits decision/note only',async()=>{
  const f=fixture('schedule',c=>c.path.endsWith('/review')?Response.json({leave_request:{...req,status:'APPROVED'}}):null);
  try{await initAdminWorkspace('schedule');await trigger(f.$('[data-action="leave-detail"]'),'click');assert.match(f.$('#admin-dialog-body').innerHTML,/Nhân viên xin nghỉ/);const form=f.$('[data-form="review"]');form.elements.decision.value='APPROVED';form.elements.note.value='Đã bố trí người thay';await trigger(form,'submit');const write=f.calls.find(c=>c.method==='POST');assert.equal(write.path,'/admin/leave-requests/13/review');assert.deepEqual(write.body,{decision:'APPROVED',note:'Đã bố trí người thay'});}finally{f.restore();}
});
test('filtering and pagination preserve server query parameters',async()=>{
  const f=fixture('users',c=>c.path==='/admin/users'?Response.json({items:[user],total:25,page:Number(c.params.get('page')),page_size:12}):null);
  try{await initAdminWorkspace('users');const form=f.$('#resource-filter');form.elements.q.value='Nguyễn';form.elements.role.value='NURSE';await trigger(form,'submit');await trigger(f.$('[data-action="next"]'),'click');const call=f.calls.at(-1);assert.equal(call.params.get('page'),'2');assert.equal(call.params.get('q'),'Nguyễn');assert.equal(call.params.get('role'),'NURSE');}finally{f.restore();}
});
test('admin text searches run while typing, reset pagination, and retain selected filters',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture('users',c=>c.path==='/admin/users'?Response.json({items:[user],total:25,page:Number(c.params.get('page')),page_size:12}):null);
  try {
    await initAdminWorkspace('users');const form=f.$('#resource-filter');
    assert.equal(form.querySelector('button[type="submit"]'),null);
    form.elements.role.value='NURSE';await trigger(form.elements.role,'change');
    await trigger(f.$('[data-action="next"]'),'click');
    const before=f.calls.length;
    form.elements.q.value='Ngu';await trigger(form.elements.q,'input');
    form.elements.q.value='Nguyễn';await trigger(form.elements.q,'input');
    assert.equal(f.calls.length,before);
    assert.equal(f.$('#admin-pager').innerHTML,'');
    t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.length,before+1);
    assert.equal(f.calls.at(-1).params.get('q'),'Nguyễn');
    assert.equal(f.calls.at(-1).params.get('page'),'1');
    assert.equal(f.calls.at(-1).params.get('role'),'NURSE');
    form.elements.q.value='';await trigger(form.elements.q,'input');t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.at(-1).params.has('q'),false);
    assert.equal(f.calls.at(-1).params.get('role'),'NURSE');
    assert.ok(f.calls.every(c=>c.method==='GET'));
  }finally{f.restore();}
});
test('typing in multiple admin fields shares one pending search',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture('patients');
  try {
    await initAdminWorkspace('patients');const form=f.$('#resource-filter'),before=f.calls.length;
    form.elements.q.value='Nguyễn';await trigger(form.elements.q,'input');
    t.mock.timers.tick(100);form.elements.phone.value='0902000002';await trigger(form.elements.phone,'input');
    t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.length,before+1);
    assert.equal(f.calls.at(-1).params.get('q'),'Nguyễn');
    assert.equal(f.calls.at(-1).params.get('phone'),'0902000002');
  }finally{f.restore();}
});
test('admin forms containing only predefined choices keep their filter button',async()=>{
  const f=fixture('schedule');try{await initAdminWorkspace('schedule');assert.ok(f.$('#resource-filter').querySelector('button[type="submit"]'));assert.equal(f.$('#leave-filter').querySelector('button[type="submit"]'),null);}finally{f.restore();}
});
test('payment lookup searches on input and clears old results when ids are erased or ambiguous',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture('payments');
  try {
    await initAdminWorkspace('payments');const form=f.$('#payment-search');
    assert.equal(form.querySelector('button[type="submit"]'),null);
    form.elements.payment_id.value='12';await trigger(form.elements.payment_id,'input');t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.at(-1).path,'/payments/12');assert.match(f.$('#payment-results').innerHTML,/200\.000/);
    const count=f.calls.length;
    form.elements.encounter_id.value='10';await trigger(form.elements.encounter_id,'input');t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.length,count);assert.match(f.$('#payment-results').innerHTML,/Nhập một mã/);
    form.elements.payment_id.value='';await trigger(form.elements.payment_id,'input');t.mock.timers.tick(251);await tick();
    assert.equal(f.calls.at(-1).path,'/encounters/10/payments');
    form.elements.encounter_id.value='';await trigger(form.elements.encounter_id,'input');t.mock.timers.tick(251);await tick();
    assert.match(f.$('#payment-results').innerHTML,/Nhập mã để xem/);assert.equal(f.$('#payment-pager').innerHTML,'');
  }finally{f.restore();}
});
test('typing invalidates an admin response before the next debounced request begins',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let finish;
  const f=fixture('patients',c=>c.params.get('q')==='old'?new Promise(resolve=>{finish=resolve;}):null);
  try {
    await initAdminWorkspace('patients');const input=f.$('#resource-filter').elements.q;
    input.value='old';await trigger(input,'input');t.mock.timers.tick(251);await tick();
    input.value='new';await trigger(input,'input');
    finish(Response.json({items:[{...patient,full_name:'Old response'}],total:1,page:1,page_size:12}));await tick();
    assert.doesNotMatch(f.$('#admin-results').innerHTML,/Old response/);
    t.mock.timers.tick(251);await tick();assert.equal(f.calls.at(-1).params.get('q'),'new');
  }finally{f.restore();}
});
test('offline list errors never fall back to sample rows',async()=>{
  const f=fixture('patients',c=>c.path==='/patients'?Promise.reject(new Error('offline')):null);
  try{await initAdminWorkspace('patients');assert.match(f.$('#admin-status').textContent,/Không thể kết nối/);assert.equal(f.$('#admin-results').innerHTML,'');assert.doesNotMatch(f.$('#page-body').innerHTML,/Nguyễn Minh Anh|EC-1028/);}finally{f.restore();}
});
test('a late response after navigation cannot restore private records',async()=>{
  let finish;const f=fixture('patients',c=>c.path==='/patients'?new Promise(resolve=>{finish=resolve;}):null);
  try{const pending=initAdminWorkspace('patients');await tick();window.dispatchEvent(new Event('pagehide'));finish(Response.json({items:[patient],total:1,page:1,page_size:12}));await pending;assert.equal(f.$('#page-body').innerHTML,'');}finally{f.restore();}
});
test('session expiration clears private data and stops subsequent loads',async()=>{
  let expired=false;const f=fixture('patients',c=>c.path==='/patients'&&expired?Response.json({error:{code:'UNAUTHORIZED',message:'Phiên đã hết hạn'}},{status:401}):null);
  try{const ctx=await initAdminWorkspace('patients');expired=true;await trigger(f.$('#resource-filter'),'submit');assert.equal(ctx.active,false);assert.equal(f.$('#page-body').innerHTML,'');assert.equal(f.$('#main-content').inert,true);}finally{f.restore();}
});

test('leadership saves only selected doctor ids and the current department version',async()=>{
 const f=fixture('departments',c=>c.method==='PUT'?Response.json({department}):null);
 try{await initAdminWorkspace('departments');await trigger(f.$('[data-action="detail"]'),'click');await trigger(f.$('[data-action="leadership"]'),'click');const form=f.$('[data-form="leadership"]');form.elements.head_doctor_id.value='8';await trigger(form,'submit');const write=f.calls.find(c=>c.method==='PUT');assert.equal(write.path,'/admin/departments/2/leadership');assert.deepEqual(write.body,{head_doctor_id:8,deputy_doctor_ids:[],expected_version:3});}finally{f.restore();}
});
test('gallery and extra sections use structured fields and serialize only their allowed keys',async()=>{
 const f=fixture('departments',c=>c.method==='POST'?Response.json({department}):null);
 try{await initAdminWorkspace('departments');await trigger(f.$('#add-record'),'click');const form=f.$('[data-form="resource"]');form.elements.name.value='Khoa mới';const gallery=form.querySelector('[data-collection="gallery"]');await trigger(gallery.querySelector('[data-action="collection-add"]'),'click');const item=gallery.querySelector('[data-item]');item.querySelector('[data-field="url"]').value='https://example.test/anh-khoa.png';item.querySelector('[data-field="caption"]').value='Khu tiếp nhận';await trigger(form,'submit');const write=f.calls.find(c=>c.method==='POST');assert.deepEqual(write.body.gallery,[{url:'https://example.test/anh-khoa.png',caption:'Khu tiếp nhận'}]);assert.deepEqual(write.body.extra_sections,[]);}finally{f.restore();}
});
test('changing user contact information does not resend role or approval, including own admin contact edits',async()=>{
 const f=fixture('users',c=>c.method==='PATCH'?Response.json({user}):null);
 try{await initAdminWorkspace('users');await trigger(f.$('[data-action="edit"]'),'click');const form=f.$('[data-form="resource"]');form.elements.email.value='changed@example.test';await trigger(form,'submit');assert.deepEqual(f.calls.find(c=>c.method==='PATCH').body,{email:'changed@example.test'});}finally{f.restore();}
});
test('doctor image upload uses multipart file and invalid images never send a write',async()=>{
 const f=fixture('doctors',c=>c.method==='POST'?Response.json({doctor:{...doctor,avatar_url:'/uploads/avatars/'+ 'a'.repeat(32)+'.png'}}):null);
 try{await initAdminWorkspace('doctors');await trigger(f.$('[data-action="detail"]'),'click');await trigger(f.$('[data-action="doctor-avatar"]'),'click');const form=f.$('[data-form="upload"]');form.elements.file.files=[new File(['x'],'bad.svg',{type:'image/svg+xml'})];await trigger(form,'submit');assert.equal(f.calls.some(c=>c.method==='POST'),false);assert.match(form.querySelector('[role="status"]').textContent,/JPEG/);form.elements.file.files=[new File(['png'],'valid.png',{type:'image/png'})];await trigger(form,'submit');const write=f.calls.find(c=>c.method==='POST');assert.equal(write.path,'/admin/doctors/8/avatar');assert.equal(write.body.get('file').name,'valid.png');}finally{f.restore();}
});
test('an older filter result cannot overwrite newer results even if cancellation is ignored',async()=>{
 const pending=[];let defer=false;const f=fixture('patients',c=>c.path==='/patients'&&defer?new Promise(resolve=>pending.push(resolve)):null);
 try{await initAdminWorkspace('patients');defer=true;const form=f.$('#resource-filter');form.elements.q.value='cũ';await trigger(form,'submit');form.elements.q.value='mới';await trigger(form,'submit');pending[1](Response.json({items:[{...patient,full_name:'Kết quả mới'}],total:1,page:1,page_size:12}));await tick();pending[0](Response.json({items:[{...patient,full_name:'Kết quả cũ'}],total:1,page:1,page_size:12}));await tick();assert.match(f.$('#admin-results').innerHTML,/Kết quả mới/);assert.doesNotMatch(f.$('#admin-results').innerHTML,/Kết quả cũ/);}finally{f.restore();}
});
