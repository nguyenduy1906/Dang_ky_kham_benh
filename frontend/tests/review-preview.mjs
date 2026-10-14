// Optional isolated browser fixture: node tests/review-preview.mjs
// Serves the real review page/controller with in-memory responses, never the live database.
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const setup = `
const draftKey = '11111111-1111-4111-8111-111111111111';
sessionStorage.setItem('neu-medical.auth', JSON.stringify({token:'test-only', expiresAt:Date.now()+3600000}));
sessionStorage.setItem('neu:booking-review:'+draftKey, JSON.stringify({user_id:1,patient_id:1,doctor_profile_id:7,schedule_id:1,work_date:'2030-01-15',appointment_time:'08:00',symptoms:'Dữ liệu kiểm thử giao diện.',updatedAt:Date.now()}));
const patient={patient_id:1,user_id:1,full_name:'Người khám kiểm thử',phone:'0912345678',dob:'2000-01-01',gender:'Nam',address:'Địa chỉ kiểm thử'};
const doctor={doctor_profile_id:7,full_name:'Bác sĩ kiểm thử',department_name:'Mắt',consultation_fee:260000};
const schedule={schedule_id:1,work_date:'2030-01-15',start_time:'08:00',schedule_status:'OPEN',room_name:'Phòng kiểm thử',slots:[{appointment_time:'08:00',starts_at:'2030-01-15T08:00:00+07:00',ends_at:'2030-01-15T08:15:00+07:00'}]};
let payment,encounter;
window.fetch=async (url,options={})=>{
const p=new URL(url,location.href).pathname;let data;
if(p==='/me')data={user:{user_id:1,role_name:'USER'}};
else if(p==='/doctors')data={items:[doctor],total:1};
else if(p==='/patients')data={items:[patient],total:1};
else if(p==='/patients/1'){Object.assign(patient,JSON.parse(options.body));data={patient};}
else if(p==='/doctors/7/schedules')data={items:[schedule],total:1};
else if(p==='/contact-info')data={hospital_name:'NEU Medical — Kiểm thử',support_phone:'19001234',support_email:null,exam_hours:'Sáng: 07:00–12:00\\nChiều: 13:30–16:30'};
else if(p==='/encounters/online'){encounter={encounter_id:1,patient_id:1,doctor_profile_id:7,schedule_id:1,patient_name:patient.full_name,doctor_name:doctor.full_name,department_name:'Mắt',room_name:schedule.room_name,work_date:schedule.work_date,estimated_exam_at:schedule.slots[0].starts_at,appointment_end_at:schedule.slots[0].ends_at,consultation_fee_snapshot:260000,deposit_amount_snapshot:260000,symptoms:JSON.parse(options.body).symptoms,encounter_status:'HOLDING',hold_expires_at:new Date(Date.now()+600000).toISOString()};data={encounter};}
else if(p==='/encounters/1')data={encounter};
else if(p==='/encounters/1/payment-intents'){payment={payment_id:1,payment_type:'DEPOSIT',transaction_status:'PENDING',transaction_code:'DEMO-'+'a'.repeat(32),amount:260000,payment_method:'BANK'};data={payment};}
else if(p==='/encounters/1/payments')data={items:payment?[payment]:[],total:payment?1:0};
else if(p==='/demo/payments/1/result'){payment.transaction_status=JSON.parse(options.body).result; if(payment.transaction_status==='SUCCESS'){encounter.encounter_status='CONFIRMED';encounter.ticket_code='TEST-ONLY';}data={payment};}
else if(p==='/encounters/1/ticket')data={ticket:{ticket_code:'TEST-ONLY'}};
else return Response.json({error:{message:'Fixture không hỗ trợ '+p}}, {status:404});
return Response.json(data);};
`;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
createServer(async (req, res) => {
  try {
    if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/frontend\//, "/");
    if (!/^\/(static|templates)\//.test(path) || path.includes("\\")) throw new Error("Invalid path");
    const target = await realpath(resolve(root, "." + path));
    const rel = relative(root, target);
    if (rel.startsWith(".." + sep) || rel === "..") throw new Error("Outside fixture");
    let content = await readFile(target);
    if (path === "/templates/(patient)/booking-review.html") {
      content = content.toString().replace("<head>", "<head><script>" + setup + "</script>")
        .replace("<main id=\"main\"", "<p style=\"padding:12px;text-align:center;background:#fff4d4;margin:0\">Kiểm thử giao diện — dữ liệu tạm, không ghi database</p><main id=\"main\"");
    }
    res.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
}).listen(3101, "127.0.0.1", () => console.log("Isolated review fixture: http://127.0.0.1:3101/frontend/templates/(patient)/booking-review.html?draft=11111111-1111-4111-8111-111111111111"));
