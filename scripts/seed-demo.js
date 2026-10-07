import {resolve} from 'node:path';
import {openDatabase} from '../server/database.js';
import {createERP} from '../server/erp.js';
import {seedDemo} from '../server/seed.js';

const path=resolve(process.env.ERP_DB||'data/erp.sqlite');
const store=openDatabase(path);
try {
 const result=seedDemo(store,createERP(store),{id:'demo-seeder',name:'Khởi tạo dữ liệu minh họa',role:'admin',scope:{}});
 console.log(result.created?'Đã tạo dữ liệu demo.':'Dữ liệu demo đã tồn tại; không tạo thêm hoặc ghi đè.');
 console.log('Database: '+path);
 console.log('Kỳ minh họa: '+result.period);
 console.log(JSON.stringify(result.counts,null,2));
 console.log('Các công ty, nhân sự và giao dịch đều là dữ liệu giả lập. Không tạo tài khoản hoặc mật khẩu mặc định.');
} catch(error) {
 console.error(error.message);
 process.exitCode=1;
} finally {
 store.db.close();
}
