import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './database.js';
import {createERP} from './erp.js';
import {assert} from './finance.js';
import {seedDemo,seedTaxes} from './seed.js';
import {schemas,roles,dateToday} from '../shared/schema.js';
const spec=JSON.parse(readFileSync(new URL('../shared/requirements.json',import.meta.url),'utf8'));
export function createServer({dbPath=process.env.ERP_DB}={}){
 const store=openDatabase(dbPath),erp=createERP(store);seedTaxes(store);
 const attempts=new Map();
 const safeUser=row=>row?{id:row.id,username:row.username,name:row.name,role:row.role,scope:JSON.parse(row.scope)}:null;
 function userFrom(req){const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('erp_session='))?.slice(12);if(!cookie)return null;const row=store.db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires_at>?').get(cookie,Date.now());return safeUser(row);}
 function createUser(body){assert(typeof body.username==='string'&&/^[a-zA-Z0-9_.@-]{3,80}$/.test(body.username),'Tên đăng nhập phải có 3–80 ký tự hợp lệ.');assert(typeof body.password==='string'&&body.password.length>=12&&body.password.length<=128,'Mật khẩu phải có 12–128 ký tự.');assert(typeof body.name==='string'&&body.name.trim().length>0&&body.name.length<=100,'Vui lòng nhập tên.');assert(roles[body.role],'Vai trò không hợp lệ.');const scope=body.scope||{};assert(typeof scope==='object'&&!Array.isArray(scope),'Phạm vi quyền không hợp lệ.');
  for(const [key,collection] of Object.entries({legalEntityId:'legalEntities',tenantId:'tenants',employeeId:'employees'}))if(scope[key])assert(store.get(collection,scope[key]),'Phạm vi không tồn tại.');
  if(body.role==='tenant')assert(scope.tenantId,'Khách thuê cần gắn mã khách.');if(['staff','technician'].includes(body.role))assert(scope.employeeId,'Nhân viên/kỹ thuật cần gắn hồ sơ nhân sự.');
  const salt=randomBytes(16).toString('hex'),hash=scryptSync(body.password,salt,64).toString('hex'),id=randomUUID();assert(!store.db.prepare('SELECT id FROM users WHERE username=?').get(body.username),'Tên đăng nhập đã tồn tại.',409);store.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,body.username,body.name.trim(),body.role,hash,salt,JSON.stringify(scope));return safeUser(store.db.prepare('SELECT * FROM users WHERE id=?').get(id));
 }
 function session(user,res){const token=randomBytes(32).toString('hex');store.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,Date.now()+8*3600000);res.setHeader('Set-Cookie',`erp_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.SESSION_SECURE==='1'?'; Secure':''}`);}
 async function body(req){assert(req.headers['content-type']?.startsWith('application/json'),'Yêu cầu phải là JSON.',415);assert(req.headers['x-erp-request']==='1','Thiếu header bảo vệ yêu cầu.',403);if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{}assert(host===req.headers.host,'Nguồn yêu cầu không hợp lệ.',403);}let text='';for await(const chunk of req){text+=chunk;assert(Buffer.byteLength(text)<=1024*1024,'Dữ liệu quá lớn.',413);}try{return JSON.parse(text||'{}');}catch{assert(false,'JSON không hợp lệ.');}}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean);const method=req.method;
   if(url.pathname==='/api/health')return send({ok:true,service:'Gems Office ERP',date:dateToday()});
   if(url.pathname==='/api/auth/status')return send({initialized:!!store.db.prepare('SELECT id FROM users LIMIT 1').get(),user:userFrom(req),demo:store.setting('demo')==='true'});
   if(url.pathname==='/api/auth/bootstrap'&&method==='POST'){
    assert(!store.db.prepare('SELECT id FROM users LIMIT 1').get(),'Hệ thống đã được khởi tạo.',409);const input=await body(req);const user=store.transaction(()=>{const created=createUser({...input,role:'admin',scope:{}});if(input.demo===true)seedDemo(store,erp,created);return created;});
    store.audit(user,'bootstrap','users',user.id,null,{name:user.name,role:user.role});session(user,res);return send({user},201);
   }
   if(url.pathname==='/api/auth/login'&&method==='POST'){
    const input=await body(req),key=req.socket.remoteAddress+'|'+String(input.username).slice(0,80);const entry=attempts.get(key)||{count:0,start:Date.now()};if(Date.now()-entry.start>900000){entry.count=0;entry.start=Date.now();}assert(entry.count<10,'Đã thử đăng nhập nhiều lần. Thử lại sau 15 phút.',429);entry.count++;attempts.set(key,entry);
    assert(typeof input.password==='string'&&input.password.length<=128,'Thông tin đăng nhập không hợp lệ.',401);const row=store.db.prepare('SELECT * FROM users WHERE username=?').get(String(input.username));const salt=row?.salt||'dummy';const actual=scryptSync(input.password,salt,64);const expected=row?Buffer.from(row.password_hash,'hex'):Buffer.alloc(64);assert(row&&timingSafeEqual(actual,expected),'Tên đăng nhập hoặc mật khẩu không đúng.',401);attempts.delete(key);const user=safeUser(row);session(user,res);store.audit(user,'login','users',user.id,null,null);return send({user});
   }
   const user=userFrom(req);
   if(parts[0]==='api'){
    assert(user,'Vui lòng đăng nhập.',401);const input=['POST','PUT','DELETE'].includes(method)?await body(req):{};
    if(url.pathname==='/api/auth/logout'&&method==='POST'){const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('erp_session='))?.slice(12);store.db.prepare('DELETE FROM sessions WHERE token=?').run(cookie||'');res.setHeader('Set-Cookie','erp_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send({ok:true});}
    if(url.pathname==='/api/meta')return send({schemas:Object.fromEntries(Object.entries(schemas).filter(([name])=>erp.readable(name,user))),roles,spec,demo:store.setting('demo')==='true',user});
    if(url.pathname==='/api/reports'&&method==='GET')return send(erp.reports(user,url.searchParams.get('period')||undefined,{legalEntityId:url.searchParams.get('legalEntityId'),buildingId:url.searchParams.get('buildingId')}));
    if(url.pathname==='/api/ledger'&&method==='GET')return send(erp.ledger(url.searchParams.get('period')||dateToday().slice(0,7),user,{legalEntityId:url.searchParams.get('legalEntityId')}));
    if(url.pathname==='/api/payroll'&&method==='GET')return send({items:erp.payroll(url.searchParams.get('period')||dateToday().slice(0,7),user),notice:'Chạy thử song song, không phải quyết định trả lương chính thức.'});
    if(url.pathname==='/api/periods'){assert(user.role==='admin','Chỉ quản trị viên xem/chốt kỳ.',403);return method==='GET'?send({items:store.list('periods')}):method==='POST'?send(erp.lockPeriod(input.period,user),201):send({error:'Thao tác không hỗ trợ'},405);}
    if(url.pathname==='/api/audit'){assert(user.role==='admin','Chỉ quản trị viên đọc nhật ký.',403);const limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit'))||100));return send({items:store.db.prepare('SELECT id,actor_name AS actor,action,collection,record_id AS recordId,created_at AS date,before_json AS before,after_json AS after FROM audit ORDER BY created_at DESC LIMIT ?').all(limit)});}
    if(url.pathname==='/api/users'){
     assert(user.role==='admin','Chỉ quản trị viên quản lý tài khoản.',403);if(method==='GET')return send({items:store.db.prepare('SELECT * FROM users').all().map(safeUser)});if(method==='POST'){const created=createUser(input);store.audit(user,'create-user','users',created.id,null,created);return send(created,201);}assert(false,'Thao tác không hỗ trợ.',405);
    }
    if(url.pathname==='/api/export'){
     assert(user.role==='admin','Chỉ quản trị viên được xuất toàn bộ dữ liệu.',403);const data={exportedAt:new Date().toISOString(),source:'GEMS-ERP',demo:store.setting('demo')==='true',collections:Object.fromEntries(Object.keys(schemas).map(name=>[name,erp.rows(name,user)])),periods:store.list('periods')};res.setHeader('Content-Disposition','attachment; filename="gems-erp-export.json"');store.audit(user,'export','system','all',null,null);return send(data);
    }
    if(parts[1]==='import'&&method==='POST'){assert(user.role==='admin','Chỉ quản trị viên được nhập dữ liệu.',403);assert(schemas[parts[2]],'Phân hệ không hợp lệ.');assert(Array.isArray(input.items)&&input.items.length>0&&input.items.length<=100,'Nhập từ 1 đến 100 bản ghi mỗi lần.');const items=store.transaction(()=>input.items.map(row=>erp.create(parts[2],row,user)));return send({items,count:items.length},201);}
    if(parts[1]==='appraisals'&&parts[3]==='calculate')return send({scenarios:erp.appraisal(parts[2],user)});
    if(parts[1]==='invoices'&&parts[2]==='generate'&&method==='POST')return send(erp.issue(input.contractId,input.period,user),201);
    if(parts[1]==='records'){
     const collection=parts[2],id=parts[3];assert(schemas[collection],'Phân hệ không tồn tại.',404);
     if(parts[4]==='actions'&&method==='POST')return send(erp.action(collection,id,input.action,input,user));
     if(method==='GET'){
      if(id)return send(erp.accessible(collection,id,user));const filters={legalEntityId:url.searchParams.get('legalEntityId'),buildingId:url.searchParams.get('buildingId')};if(filters.legalEntityId)erp.accessible('legalEntities',filters.legalEntityId,user);if(filters.buildingId)erp.accessible('buildings',filters.buildingId,user);let items=erp.rows(collection,user,filters);const since=url.searchParams.get('cap_nhat_tu');if(since){assert(!isNaN(Date.parse(since)),'Mốc cập nhật không hợp lệ.');items=items.filter(r=>r.updatedAt>=since);}
      const term=url.searchParams.get('q')?.toLowerCase();if(term)items=items.filter(r=>JSON.stringify(r).toLowerCase().includes(term));const page=Math.max(1,Number(url.searchParams.get('page'))||1),limit=Math.max(1,Math.min(500,Number(url.searchParams.get('limit'))||100));const total=items.length;return send({items:items.slice((page-1)*limit,page*limit),total,page,limit});
     }
     if(method==='POST'&&!id)return send(erp.create(collection,input,user),201);if(method==='PUT'&&id)return send(erp.update(collection,id,input,user));if(method==='DELETE'&&id)return send(erp.remove(collection,id,user));assert(false,'Thao tác không hỗ trợ.',405);
    }
    assert(false,'API không tồn tại.',404);
   }
   const root=resolve('dist');const requested=resolve(root,'.'+url.pathname);assert(requested.startsWith(root+'/')||requested===root,'Đường dẫn không hợp lệ.',400);const target=existsSync(requested)&&extname(requested)?requested:resolve(root,'index.html');if(!existsSync(target))return send({error:'Chưa có bản build. Chạy npm run build hoặc dùng Vite.'},404);
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'});res.end(readFileSync(target));
  }catch(error){const status=error.status||500;if(status===500)console.error('ERP request failed:',error.message);send({error:status===500?'Lỗi máy chủ. Vui lòng xem nhật ký dịch vụ.':error.message},status);}
 });
 return {server,store,erp,close:()=>new Promise(resolveClose=>server.close(()=>{store.db.close();resolveClose();}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createServer();const port=Number(process.env.API_PORT)||3001;app.server.listen(port,process.env.API_HOST||'127.0.0.1',()=>console.log(`Gems ERP server running on port ${port}`));
 const shutdown=()=>app.server.close(()=>{app.store.db.close();process.exit(0);});process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
