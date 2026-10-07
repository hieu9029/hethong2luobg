import {randomUUID} from 'node:crypto';
import {dateToday} from '../shared/schema.js';
import {assert} from './finance.js';
export function seedDemo(store,erp,actor){
 return store.transaction(()=>{
  if(store.setting('demo')==='true')return demoSummary(store,false);
  const existing=store.db.prepare("SELECT COUNT(*) AS count FROM records WHERE collection NOT IN ('accounts','feeTypes')").get().count;
  assert(existing===0,'Cơ sở dữ liệu đã có dữ liệu nghiệp vụ. Hãy dùng một database riêng để trải nghiệm demo; dữ liệu hiện tại được giữ nguyên.',409);
  seedTaxes(store);
  populateDemo(store,erp,actor);
  store.setSetting('demoPeriod',dateToday().slice(0,7));
  return demoSummary(store,true);
 });
}
function demoSummary(store,created){
 return {created,period:store.setting('demoPeriod'),counts:Object.fromEntries(store.db.prepare('SELECT collection,COUNT(*) AS count FROM records GROUP BY collection ORDER BY collection').all().map(row=>[row.collection,row.count]))};
}
function populateDemo(store,erp,actor){
 const {put,list}=store;const today=dateToday(),year=Number(today.slice(0,4)),period=today.slice(0,7),startYear=year-1;
 const add=(type,code,data)=>put(type,{id:randomUUID(),code,...data,demo:true},actor,'demo-seed');
 const entities=['Gems Office Demo','Gems Services Demo','Gems Management Demo','Gems Investment Demo'].map((name,i)=>add('legalEntities','PN-'+String(i+1).padStart(4,'0'),{name,taxCode:'DỮ LIỆU MẪU',address:'TP. Hồ Chí Minh'}));
 const buildings=[['Gems Central','201 Trường Chinh','Master Lease',0,1800,90000000],['Gems Riverside','18 Khu thương mại','Managed Office',1,1200,65000000],['Gems Workspace','Khu văn phòng phía Đông','Setup',2,800,35000000]].map(([name,address,model,pn,area,cost],i)=>add('buildings','DA-'+String(i+1).padStart(4,'0'),{name,address,model,legalEntityId:entities[pn].id,area,floors:8,monthlyCost:cost}));
 const units=[];for(let i=0;i<9;i++){const building=buildings[Math.floor(i/3)];units.push(add('units',building.code+'-F'+(i%3+2),{name:'Văn phòng '+(i%3+2)+'01',buildingId:building.id,floor:i%3+2,area:[120,180,240][i%3],askingRent:180000,status:'Trống'}));}
 const tenants=['Công ty Atlas (mẫu)','Studio Mây (mẫu)','Nova Technology (mẫu)','An Việt Consulting (mẫu)'].map((name,i)=>add('tenants','KH-'+String(i+1).padStart(4,'0'),{name,contact:['Minh Anh','Thu Hà','Hoàng Nam','Quỳnh Chi'][i],email:'contact'+(i+1)+'@example.com',phone:'Chưa cập nhật',notes:'Dữ liệu minh họa để trải nghiệm, không phải khách hàng thật.'}));
 const contracts=[];for(let i=0;i<4;i++){const unit=units[[0,1,3,6][i]],building=list('buildings').find(b=>b.id===unit.buildingId);const contract=add('contracts',unit.code+'-'+tenants[i].code,{unitId:unit.id,tenantId:tenants[i].id,legalEntityId:building.legalEntityId,startDate:startYear+'-01-01',endDate:i===1?year+'-12-20':(year+1)+'-12-31',deposit:unit.area*180000*3,depositBalance:0,renewal:1,noticeMonths:2,penaltyWithNotice:2,penaltyWithoutNotice:4,taxInvoice:'Có',status:'Hiệu lực'});contracts.push(contract);erp.action('contracts',contract.id,'receiveDeposit',{amount:contract.deposit,date:startYear+'-01-01',method:'Chuyển khoản'},actor);put('units',{...unit,status:'Đang thuê'},actor,'demo-occupancy');
  add('prices','GIA-'+i+'-R',{contractId:contract.id,fee:'rent',basis:'area',unitPrice:i===2?7.2:180000,currency:i===2?'USD':'VND',effectiveDate:startYear+'-01-01'});
  add('prices','GIA-'+i+'-S',{contractId:contract.id,fee:'service',basis:'area',unitPrice:35000,currency:'VND',effectiveDate:startYear+'-01-01'});
  if(i===2)add('exchangeRates','FX-0001',{contractId:contract.id,effectiveDate:startYear+'-01-01',rate:25000});
 }
 const employees=['TCKT','PKD','BQL','MKT','HCNS'].map((department,i)=>add('employees','NS-'+String(i+1).padStart(4,'0'),{name:['Nguyễn Minh Anh','Trần Hoàng Nam','Lê Quốc Bảo','Phạm Thu Hà','Võ Quỳnh Chi'][i],department,position:['Kế toán','Chuyên viên kinh doanh','Kỹ thuật viên','Chuyên viên Marketing','Chuyên viên HCNS'][i],legalEntityId:entities[0].id,email:'employee'+i+'@example.com',baseSalary:14000000+i*1000000,bonusCap:3000000}));
 for(let i=0;i<employees.length;i++){const e=employees[i];const obligation=add('obligations','NV-'+i,{name:['Đối soát công nợ','Gia hạn hợp đồng','Bảo trì định kỳ','Phát triển khách tiềm năng','Báo cáo nhân sự'][i],department:e.department,position:e.position,damage:['Nặng','Vừa','Nghiêm trọng','Nhẹ','Vừa'][i]});add('tasks',e.department+'-'+period.replace('-','')+'-0001',{name:['Đối soát hóa đơn tháng này','Liên hệ khách sắp hết hạn','Kiểm tra hệ thống PCCC','Tổng hợp khách từ chiến dịch','Rà soát hồ sơ nhân sự'][i],employeeId:e.id,obligationId:obligation.id,department:e.department,damage:obligation.damage,dueDate:today,completedDate:i<2?today:undefined,progress:i<2?100:40,status:i===0?'Đã duyệt':i===1?'Chờ duyệt':'Chưa hoàn thành'});add('kpis','KPI-'+i,{name:'Công việc được duyệt',position:e.position,period,source:'approvedTasks',weight:100,target:5,actual:0});}
 for(let i=0;i<4;i++)add('assets','TB-'+i,{name:['Thang máy A','Tủ điện tổng','Bơm PCCC','Điều hòa trung tâm'][i],buildingId:buildings[i%3].id,category:['Thang máy','Hệ điện','PCCC','Điều hòa'][i],floor:'Kỹ thuật',intervalDays:30,warrantyUntil:(year+1)+'-12-31',nextMaintenance:i===0?year+'-01-01':today});
 add('tickets','SC-0001',{name:'Điều hòa phòng 201 hoạt động yếu',buildingId:buildings[0].id,contractId:contracts[0].id,priority:'Cao',description:'Yêu cầu kiểm tra nhiệt độ và bộ lọc.',assignee:employees[2].name,slaHours:8,serviceFee:0,status:'Đang xử lý'});
 add('tickets','SC-0002',{name:'Đăng ký làm việc ngoài giờ',buildingId:buildings[1].id,contractId:contracts[2].id,priority:'Bình thường',description:'Đăng ký sử dụng điều hòa ngoài giờ.',assignee:'',slaHours:24,serviceFee:250000,status:'Mới'});
 add('announcements','TBÁO-0001',{name:'Lịch bảo trì thang máy định kỳ',buildingId:buildings[0].id,content:'Ban quản lý thông báo lịch kiểm tra thiết bị. Vui lòng liên hệ lễ tân để được hỗ trợ.',publishDate:today});
 add('appraisals','TD-0001',{name:'Cơ hội văn phòng Central (mẫu)',model:'Master Lease',area:1500,rentPerM2:230000,ownerRent:150000000,operatingCost:35000000,marketingCost:10000000,setupCost:1600000000,deposit:450000000,freeMonths:3,occupancy:90,rampMonths:12,rentGrowth:5,costGrowth:3,churn:1,discountRate:12});
 for(let offset=-5;offset<=0;offset++){
  const d=new Date(period+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);const p=d.toISOString().slice(0,7);
  for(let i=0;i<contracts.length;i++){const invoice=erp.issue(contracts[i].id,p,actor);if(offset<0||i===0)erp.action('invoices',invoice.id,'pay',{amount:offset<0?invoice.total:Math.round(invoice.total/2),date:offset<0?p+'-05':today,method:'Chuyển khoản',reference:'Giao dịch mẫu'},actor);}
  for(let i=0;i<buildings.length;i++)add('expenses','CHI-'+p+'-'+i,{name:'Chi phí vận hành '+buildings[i].name,buildingId:buildings[i].id,legalEntityId:buildings[i].legalEntityId,category:'Vận hành',amount:buildings[i].monthlyCost,taxRate:8,dueDate:p+'-05',status:offset<0?'Đã thanh toán':'Chờ duyệt',...(offset<0?{paidDate:p+'-05'}:{})});
 }
 const vendor=add('vendors','NCC-0001',{name:'Nhà cung cấp thiết bị (mẫu)',contact:'Bộ phận dịch vụ',email:'service@example.com'});add('purchaseOrders','PO-0001',{name:'Mua bộ lọc điều hòa',vendorId:vendor.id,buildingId:buildings[0].id,legalEntityId:entities[0].id,quantity:10,unitPrice:250000,total:2500000,taxRate:8,dueDate:today,status:'Chờ duyệt'});add('inventoryItems','VT-0001',{name:'Bộ lọc điều hòa',buildingId:buildings[0].id,unit:'Cái',unitCost:250000,minimumStock:5,quantity:0});
 for(const expense of list('expenses').filter(e=>e.status==='Đã thanh toán')){put('expenses',{...expense,status:'Chờ duyệt'},actor,'demo-prepare-ledger');erp.action('expenses',expense.id,'approve',{},actor);erp.action('expenses',expense.id,'pay',{date:expense.paidDate},actor);}
 store.setSetting('demo','true');
}
export function seedTaxes(store){if(!store.list('accounts').length)for(const [accountNumber,name,type] of [['111','Tiền mặt','Tài sản'],['112','Tiền gửi ngân hàng','Tài sản'],['131','Phải thu khách hàng','Tài sản'],['133','Thuế GTGT được khấu trừ','Tài sản'],['331','Phải trả nhà cung cấp','Nợ phải trả'],['3331','Thuế GTGT phải nộp','Nợ phải trả'],['3386','Cọc khách thuê','Nợ phải trả'],['511','Doanh thu cung cấp dịch vụ','Doanh thu'],['642','Chi phí quản lý và vận hành','Chi phí']])store.put('accounts',{id:randomUUID(),code:'TK-'+accountNumber,accountNumber,name,type});if(store.list('feeTypes').length)return;for(const [fee,rate] of Object.entries({rent:10,signage:10,electricity:8,parking:8,water:5,overtime:10,service:8}))store.put('feeTypes',{id:randomUUID(),code:'THUE-'+fee.toUpperCase(),fee,taxRate:rate,effectiveDate:'1970-01-01'});}
