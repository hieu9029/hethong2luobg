import {DatabaseSync,backup} from 'node:sqlite';
import {resolve,dirname} from 'node:path';
import {mkdirSync,existsSync} from 'node:fs';
const source=resolve(process.env.ERP_DB||'data/erp.sqlite');
const target=resolve(process.argv[2]||'backups/erp-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
if(!existsSync(source))throw new Error('Database chưa tồn tại. Khởi động ERP trước khi sao lưu.');
if(existsSync(target))throw new Error('File đích đã tồn tại, không ghi đè bản sao lưu.');
mkdirSync(dirname(target),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,target);console.log('Backup created: '+target);}finally{db.close();}
