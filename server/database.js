import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
export function openDatabase(path=process.env.ERP_DB||resolve('data/erp.sqlite')){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL,id TEXT NOT NULL,code TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id),UNIQUE(collection,code));
 CREATE INDEX IF NOT EXISTS records_updated ON records(collection,updated_at);
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,scope TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY,actor_id TEXT,actor_name TEXT,action TEXT,collection TEXT,record_id TEXT,before_json TEXT,after_json TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 function list(collection){return db.prepare('SELECT * FROM records WHERE collection=? ORDER BY created_at DESC, id').all(collection).map(unpack);}
 function unpack(row){if(!row)return null;const result={...JSON.parse(row.data),id:row.id,code:row.code,createdAt:row.created_at,updatedAt:row.updated_at};if(row.collection==='invoices'){const payments=db.prepare("SELECT data,updated_at FROM records WHERE collection='payments' AND json_extract(data,'$.invoiceId')=? ORDER BY updated_at DESC").all(row.id);result.paid=payments.reduce((sum,p)=>sum+JSON.parse(p.data).amount,0);if(result.status!=='Đã hủy')result.status=result.paid===result.total?'Đã thu đủ':result.paid>0?'Thu một phần':'Chờ thu';if(payments[0]?.updated_at>result.updatedAt){result.updatedAt=payments[0].updated_at;result.updatedBy=JSON.parse(payments[0].data).updatedBy;}}return result;}
 function get(collection,id){return unpack(db.prepare('SELECT * FROM records WHERE collection=? AND id=?').get(collection,id));}
 function audit(actor,action,collection,id,before,after){db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),actor?.id||'system',actor?.name||'Hệ thống',action,collection,id,before?JSON.stringify(before):null,after?JSON.stringify(after):null,new Date().toISOString());}
 function put(collection,record,actor={id:'system',name:'Hệ thống'},action='create'){
  const before=get(collection,record.id);const now=new Date().toISOString();const data={...record,sourceSystem:'GEMS-ERP',updatedBy:actor.id};delete data.id;delete data.code;delete data.createdAt;delete data.updatedAt;data.createdBy=before?.createdBy||actor.id;
  db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(collection,record.id,record.code,JSON.stringify(data),before?.createdAt||now,now);
  const after=get(collection,record.id);audit(actor,action,collection,record.id,before,after);return after;
 }
 let depth=0;
 function transaction(fn){const nested=depth>0,name='erp_tx_'+depth;db.exec(nested?'SAVEPOINT '+name:'BEGIN IMMEDIATE');depth++;try{const result=fn();db.exec(nested?'RELEASE SAVEPOINT '+name:'COMMIT');return result;}catch(error){db.exec(nested?'ROLLBACK TO SAVEPOINT '+name:'ROLLBACK');if(nested)db.exec('RELEASE SAVEPOINT '+name);throw error;}finally{depth--;}}
 return {db,list,get,put,audit,transaction,setting:(key)=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value,setSetting:(key,value)=>db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value))};
}
