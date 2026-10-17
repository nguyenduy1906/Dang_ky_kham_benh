// Isolated visual QA for the admin UI. No session is created, and writes never reach the backend.
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const test=await readFile(new URL('./admin-workspace.test.mjs',import.meta.url),'utf8');
const data=test.slice(test.indexOf('const day='),test.indexOf('function fixture('));
const setup=`${data}
const paged=(items,params)=>({items,total:items.length,page:Number(params.get('page') || 1),page_size:Number(params.get('page_size') || 12)});
window.fetch=async(url,options={})=>{
 const parsed=new URL(url,location.href),path=parsed.pathname;
 if((options.method || 'GET')!=='GET')return Response.json({error:{code:'TEST_ONLY',message:'Trang kiểm thử không ghi dữ liệu.'}},{status:409});
 if(path==='/admin/roles')return Response.json({items:['DOCTOR','NURSE','RECEPTIONIST','ADMIN','USER'].map(role_name=>({role_name}))});
 if(path==='/admin/statistics/encounters')return Response.json({...paged([{group_value:day,total:3,online_count:2,walk_in_count:1}],parsed.searchParams),summary:{total:3,online_count:2,walk_in_count:1},by_status:[{encounter_status:'COMPLETED',count:2},{encounter_status:'CHECKED_IN',count:1}]});
 if(path==='/admin/statistics/payments')return Response.json({...paged([{group_value:day,transaction_count:3,deposit_received:200000,exam_fee_received:100000,refunded_amount:50000,net_received:250000}],parsed.searchParams),summary:{net_received:250000}});
 if(path==='/admin/statistics/reviews')return Response.json({...paged([{group_value:day,review_count:2,average_rating:4.5}],parsed.searchParams),summary:{review_count:2,average_rating:4.5},rating_distribution:[{rating:4,count:1},{rating:5,count:1}]});
 if(path==='/admin/users/7')return Response.json({user});
 if(path==='/patients/5')return Response.json({patient});
 if(path==='/doctors/8')return Response.json({doctor});
 if(path==='/departments/2')return Response.json({department});
 if(path==='/admin/departments/2/leadership')return Response.json({version:3,items:[]});
 if(path==='/admin/leave-requests/13')return Response.json({leave_request:req,affected_schedule_ids:[3],affected_encounters:2});
 if(rows[path])return Response.json(paged(rows[path],parsed.searchParams));
 return Response.json({error:{code:'TEST_ONLY',message:'Không có dữ liệu kiểm thử cho yêu cầu này.'}},{status:404});
};`;
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(!['GET','HEAD'].includes(req.method)||!/^\/frontend\/(static|templates)\//.test(url.pathname)){res.writeHead(404).end();return;}
  const file=await realpath(resolve(root,decodeURIComponent(url.pathname).replace(/^\/frontend\//,'')));
  const rel=relative(root,file);if(rel==='..'||rel.startsWith('..'+sep)){res.writeHead(404).end();return;}
  let content=await readFile(file);const ext=extname(file);
  if(ext==='.html')content=content.toString().replace('<head>',`<head><script>${setup}</script>`).replace('<main class="staff-content"','<p style="position:fixed;bottom:8px;right:12px;z-index:100;background:#fff8e5;padding:6px 12px;font-size:11px;pointer-events:none">Kiểm tra giao diện · Dữ liệu kiểm thử</p><main class="staff-content"');
  if(rel.endsWith('pages'+sep+'admin.js'))content=content.toString().replace('const administrator = await requireAdmin();','document.body.classList.remove("staff-auth-pending"); document.querySelector("#main-content").inert=false; document.querySelector("#staff-access").hidden=true; const administrator={user_id:1,full_name:"Quản trị viên kiểm thử"};');
  res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'})[ext] || 'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404).end();}
});
server.listen(3104,'127.0.0.1',()=>process.stdout.write('Admin isolated UI check: http://127.0.0.1:3104/frontend/templates/(admin)/home.html\n'));
