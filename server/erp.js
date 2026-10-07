import {workflowTemplates} from '../shared/workflows.js';
import {randomUUID} from 'node:crypto';
import {schemas,dateToday} from '../shared/schema.js';
import {assert,validDate,daysBetween,latest,calculateInvoice,appraisalModel} from './finance.js';
export function createERP(store){
 const {db,list,get,put,transaction}=store;
 const readRestricted={prices:['admin','manager','accountant'],exchangeRates:['admin','manager','accountant'],feeTypes:['admin','manager','accountant'],invoices:['admin','manager','accountant'],payments:['admin','manager','accountant'],depositTransactions:['admin','manager','accountant'],employees:['admin','manager','accountant'],obligations:['admin','manager','accountant','staff','technician'],kpis:['admin','manager','accountant','staff'],appraisals:['admin','manager'],accounts:['admin','manager','accountant'],journalEntries:['admin','manager','accountant']};
 const tenantCollections=new Set(['legalEntities','buildings','units','tenants','contracts','meters','invoices','payments','depositTransactions','tickets','announcements']);
 function readable(collection,user){return user.role==='tenant'?tenantCollections.has(collection):!readRestricted[collection]||readRestricted[collection].includes(user.role);}
 function entityOf(collection,row){
  if(collection==='legalEntities')return row.id;
  if(row.legalEntityId)return row.legalEntityId;
  if(row.buildingId)return get('buildings',row.buildingId)?.legalEntityId;
  if(row.unitId){const unit=get('units',row.unitId);return get('buildings',unit?.buildingId)?.legalEntityId;}
  if(row.contractId)return get('contracts',row.contractId)?.legalEntityId;
  if(row.invoiceId)return get('invoices',row.invoiceId)?.legalEntityId;
  if(row.assetId)return entityOf('assets',get('assets',row.assetId)||{});
  if(row.employeeId)return get('employees',row.employeeId)?.legalEntityId;
  return null;
 }
 function visible(collection,row,user){
  if(!readable(collection,user))return false;
  if(user.role==='tenant'){
   const own=list('contracts').filter(c=>c.tenantId===user.scope.tenantId);const ids=own.map(c=>c.id);
   if(collection==='tenants')return row.id===user.scope.tenantId;
   if(collection==='contracts')return ids.includes(row.id);
   if(collection==='units')return own.some(c=>c.unitId===row.id);
   if(collection==='buildings')return own.some(c=>get('units',c.unitId)?.buildingId===row.id);
   if(collection==='legalEntities')return own.some(c=>c.legalEntityId===row.id);
   if(collection==='invoices'||collection==='meters'||collection==='tickets'||collection==='depositTransactions')return ids.includes(row.contractId);
   if(collection==='payments')return ids.includes(get('invoices',row.invoiceId)?.contractId);
   if(collection==='announcements')return !row.buildingId||own.some(c=>get('units',c.unitId)?.buildingId===row.buildingId);
   return false;
  }
  if(['staff','technician'].includes(user.role)&&['expenses','purchaseOrders'].includes(collection)&&row.createdBy&&row.createdBy!==user.id)return false;
  if(user.role!=='admin'&&user.scope.legalEntityId&&entityOf(collection,row)&&entityOf(collection,row)!==user.scope.legalEntityId)return false;
  if(['staff','technician'].includes(user.role)&&collection==='tasks')return row.employeeId===user.scope.employeeId;
  if(user.role==='manager'&&user.scope.department&&collection==='tasks')return get('employees',row.employeeId)?.department===user.scope.department;
  return true;
 }
 function buildingOf(collection,row){if(collection==='buildings')return row.id;if(row.buildingId)return row.buildingId;if(collection==='units')return row.buildingId;if(row.unitId)return get('units',row.unitId)?.buildingId;if(row.contractId)return buildingOf('contracts',get('contracts',row.contractId)||{});if(row.invoiceId)return buildingOf('invoices',get('invoices',row.invoiceId)||{});if(row.assetId)return get('assets',row.assetId)?.buildingId;return null;}
 function rows(collection,user,filters={}){assert(schemas[collection],'Không có phân hệ này.',404);assert(readable(collection,user),'Bạn không có quyền xem phân hệ.',403);return list(collection).filter(row=>{if(!visible(collection,row,user))return false;if(collection==='tenants'&&(filters.legalEntityId||filters.buildingId))return list('contracts').some(c=>c.tenantId===row.id&&visible('contracts',c,user)&&(!filters.legalEntityId||c.legalEntityId===filters.legalEntityId)&&(!filters.buildingId||buildingOf('contracts',c)===filters.buildingId));if(collection==='vendors'&&(filters.legalEntityId||filters.buildingId))return list('purchaseOrders').some(po=>po.vendorId===row.id&&visible('purchaseOrders',po,user)&&(!filters.legalEntityId||po.legalEntityId===filters.legalEntityId)&&(!filters.buildingId||po.buildingId===filters.buildingId));if(collection==='announcements'&&!row.buildingId)return true;return (!filters.legalEntityId||entityOf(collection,row)===filters.legalEntityId)&&(!filters.buildingId||buildingOf(collection,row)===filters.buildingId);});}
 function accessible(collection,id,user){const row=get(collection,id);assert(row,'Bản ghi không tồn tại.',404);assert(visible(collection,row,user),'Bản ghi nằm ngoài phạm vi quyền.',403);return row;}
 function canWrite(collection,user){assert(schemas[collection]?.writers.includes(user.role),'Bạn không có quyền chỉnh sửa phân hệ.',403);}
 const lockedCollections=new Set(['invoices','payments','expenses','tasks','kpis','journalEntries','purchaseOrders','depositTransactions','qualityChecks']);
 function checkLock(collection,row){const period=row.period||(row.dueDate||row.date||'').slice(0,7);if(lockedCollections.has(collection))assert(!list('periods').some(p=>p.period===period&&p.status==='Đã chốt'),`Kỳ ${period} đã chốt, chỉ được đọc.`,409);}
 function validate(collection,input,user,old){
  const fields=schemas[collection].fields;const data={};
  for(const field of fields){let value=input[field.key];
   if(value===undefined||value===null||value===''){assert(!field.required,`Vui lòng nhập ${field.label}.`);continue;}
   if(field.type==='number'){value=Number(value);assert(Number.isFinite(value),`${field.label} không hợp lệ.`);assert(value>=(field.min??0)&&value<=(field.max??1e15),`${field.label} nằm ngoài giới hạn.`);}
   else{assert(typeof value==='string',`${field.label} phải là chuỗi.`);value=value.trim();assert(value.length<=(field.type==='image'?420000:5000),`${field.label} quá dài.`);if(field.type==='image')assert(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),'Ảnh phải là PNG, JPEG hoặc WebP dạng base64.');assert(!field.required||value.length,`Vui lòng nhập ${field.label}.`);}
   if(field.type==='date')assert(validDate(value),`${field.label} không phải ngày hợp lệ.`);
   if(field.type==='month')assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(value),`${field.label} phải có dạng YYYY-MM.`);
   if(field.options)assert(field.options.includes(value),`${field.label} không hợp lệ.`);
   if(field.type==='email')assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),'Email không hợp lệ.');
   if(field.ref)accessible(field.ref,value,user);
   data[field.key]=value;
  }
  if(old){data.status=old.status;data.id=old.id;data.code=old.code;}
  data.createdBy=old?.createdBy||user.id;
  assert(visible(collection,data,user),'Dữ liệu nằm ngoài phạm vi được cấp.',403);
  for(const key of ['amount','cost','monthlyCost','baseSalary','bonusCap','deposit','ownerRent','operatingCost','setupCost','marketingCost','rentPerM2','unitCost'])if(data[key]!==undefined)assert(Number.isSafeInteger(data[key]),'Số tiền VNĐ phải là số nguyên an toàn.');
  if(collection==='prices'&&data.currency==='VND')assert(Number.isSafeInteger(data.unitPrice),'Giá VNĐ phải là số nguyên.');
  if(collection==='purchaseOrders')assert(Number.isSafeInteger(data.quantity*data.unitPrice),'Giá trị mua phải là số nguyên VNĐ.');
  if(collection==='qualityChecks')assert(data.date<=dateToday(),'Không đánh giá ở tương lai.');
  if(collection==='projectFlows'){assert(!old,'Quy trình đang chạy phải thay đổi qua thao tác chuyển bước.');const steps=workflowTemplates[data.template];const owner=get('employees',data.ownerId);assert(owner.department===steps[0].department,'Bước đầu phải giao nhân sự PKD.');data.steps=steps;data.currentStep=0;data.currentStepName=steps[0].name;data.status='Đang thực hiện';data.history=[];data.taskIds=[];}
  if(collection==='accounts'){assert(/^\d{3,6}$/.test(data.accountNumber),'Số tài khoản phải có 3–6 chữ số.');assert(!list('accounts').some(a=>a.id!==old?.id&&a.accountNumber===data.accountNumber),'Số tài khoản đã tồn tại.');if(old)assert(!list('journalEntries').some(j=>j.lines.some(l=>l.account===old.accountNumber)),'Tài khoản đã phát sinh bút toán không được sửa.');}
  if(collection==='inventoryItems')data.quantity=old?.quantity||0;
  if(collection==='purchaseOrders'){assert(get('buildings',data.buildingId)?.legalEntityId===data.legalEntityId,'Pháp nhân phải khớp tòa nhà.');if(old)assert(old.status==='Chờ duyệt','Đề nghị mua đã duyệt không thể sửa.');data.status=old?.status||'Chờ duyệt';data.total=Math.round(data.quantity*data.unitPrice);}
  if(collection==='units'){
   assert(Number.isInteger(data.floor),'Tầng phải là số nguyên.');
   const live=list('contracts').find(c=>c.unitId===old?.id&&c.status==='Hiệu lực');
   if(live)assert(data.status==='Đang thuê'&&data.buildingId===old.buildingId,'Mặt bằng đang có hợp đồng không thể đổi trạng thái hoặc tòa nhà.');
  }
  if(collection==='contracts'){
   assert(data.endDate>=data.startDate,'Ngày kết thúc phải sau ngày bắt đầu.');
   if(data.freeUntil)assert(data.freeUntil>=data.startDate&&data.freeUntil<=data.endDate,'Miễn phí phải nằm trong thời hạn hợp đồng.');
   const unit=get('units',data.unitId);assert(get('buildings',unit.buildingId)?.legalEntityId===data.legalEntityId,'Pháp nhân hợp đồng phải khớp với tòa nhà.');
   assert(!list('contracts').some(c=>c.id!==old?.id&&c.unitId===data.unitId&&c.status==='Hiệu lực'&&c.startDate<=data.endDate&&c.endDate>=data.startDate),'Mặt bằng có hợp đồng hiệu lực trùng thời gian.',409);
   if(old){assert(data.unitId===old.unitId&&data.tenantId===old.tenantId&&data.legalEntityId===old.legalEntityId,'Không thay khóa liên kết của hợp đồng; hãy tạo hợp đồng mới.');assert(!list('invoices').some(i=>i.contractId===old.id),'Hợp đồng đã xuất hóa đơn; dùng hợp đồng gia hạn hoặc lộ trình giá mới.',409);}
   data.status=old?.status||'Hiệu lực';data.depositBalance=old?.depositBalance??0;data.renewal=data.renewal||1;
  }
  if(collection==='meters'){
   assert(data.endReading>=data.startReading,'Chỉ số cuối không được nhỏ hơn chỉ số đầu.');
   assert(!list('meters').some(r=>r.id!==old?.id&&r.contractId===data.contractId&&r.fee===data.fee&&r.period===data.period),'Công tơ của kỳ này đã tồn tại.',409);
   assert(!list('invoices').some(i=>i.contractId===data.contractId&&i.period===data.period),'Kỳ đã xuất hóa đơn; không thay chỉ số lịch sử.',409);
  }
  if(['prices','exchangeRates','feeTypes'].includes(collection)){
   assert(!old,'Lịch sử giá/tỷ giá/thuế suất chỉ được bổ sung mốc mới.',409);
   assert(!list(collection).some(r=>r.contractId===data.contractId&&r.fee===data.fee&&r.effectiveDate===data.effectiveDate),'Mốc hiệu lực đã tồn tại; không cộng dồn cùng ngày.',409);
   const pastInvoices=list('invoices').filter(i=>!data.contractId||i.contractId===data.contractId);
   assert(!pastInvoices.some(i=>data.effectiveDate<=i.period+'-31'),'Không thêm mốc có hiệu lực ngược vào kỳ đã xuất hóa đơn.',409);
  }
  if(collection==='tasks'){
   const employee=get('employees',data.employeeId),obligation=get('obligations',data.obligationId);
   assert(employee.position===obligation.position&&employee.department===obligation.department,'Nghĩa vụ phải thuộc đúng chức danh và phòng ban.');
   assert(!data.completedDate||data.completedDate<=dateToday(),'Ngày hoàn thành không được ở tương lai.');
   if(old)assert(['Chưa hoàn thành','Bị trả lại'].includes(old.status),'Việc đang chờ duyệt/đã duyệt không thể sửa.',409);
   data.status=old?.status||'Chưa hoàn thành';data.department=employee.department;data.damage=obligation.damage;
  }
  if(collection==='kpis'){
   if(data.source==='manual')assert(data.sourceNote,'Nguồn thủ công phải ghi người cung cấp số liệu.');
   const weight=list('kpis').filter(k=>k.id!==old?.id&&k.position===data.position&&k.period===data.period).reduce((s,k)=>s+k.weight,0)+data.weight;
   assert(weight<=100,'Tổng trọng số của chức danh trong kỳ vượt 100%.');
  }
  if(collection==='expenses'){
   assert(get('buildings',data.buildingId)?.legalEntityId===data.legalEntityId,'Pháp nhân chi phí phải khớp tòa nhà.');
   if(old)assert(old.status==='Chờ duyệt','Khoản chi đã duyệt không thể sửa.',409);
   data.status=old?.status||'Chờ duyệt';
  }
  if(collection==='tickets'){
   data.status=old?.status||'Mới';data.slaHours=data.slaHours||({'Thấp':72,'Bình thường':24,'Cao':8,'Khẩn cấp':2}[data.priority]);
   if(data.contractId)assert(get('units',get('contracts',data.contractId)?.unitId)?.buildingId===data.buildingId,'Hợp đồng không thuộc tòa nhà đã chọn.');
   if(['staff','technician','tenant'].includes(user.role)){data.serviceFee=old?.serviceFee||0;}
   if(user.role==='tenant'){assert(data.contractId,'Portal phải chọn hợp đồng.');data.serviceFee=0;data.assignee='';}
   if(old)assert(!['Đã nghiệm thu'].includes(old.status),'Yêu cầu đã nghiệm thu không được sửa.',409);
  }
  if(collection==='maintenance')assert(data.date<=dateToday(),'Không ghi bảo trì ở tương lai.');
  checkLock(collection,data);if(old)checkLock(collection,old);
  return data;
 }
 function nextCode(collection,prefix=schemas[collection]?.prefix||collection){let n=list(collection).length+1;while(list(collection).some(r=>r.code===`${prefix}-${String(n).padStart(4,'0')}`))n++;return `${prefix}-${String(n).padStart(4,'0')}`;}
 function create(collection,input,user){
  canWrite(collection,user);assert(collection!=='payments','Khoản thu phải ghi qua thao tác thu tiền của hóa đơn.');
  return transaction(()=>{const data=validate(collection,input,user);let code=nextCode(collection);
   if(collection==='contracts')code=get('units',data.unitId).code+'-'+get('tenants',data.tenantId).code+(data.renewal>1?'-L'+data.renewal:'');
   if(collection==='tasks')code=nextCode(collection,data.department+'-'+data.dueDate.slice(0,7).replace('-',''));
   assert(!list(collection).some(r=>r.code===code),'Mã đã tồn tại. Chọn đúng lần gia hạn.',409);
   const result=put(collection,{...data,id:randomUUID(),code},user);
   if(collection==='projectFlows'){const task=flowTask(result,result.ownerId,result.dueDate,user);return put('projectFlows',{...result,taskIds:[task.id]},user,'start-project-flow');}
   if(collection==='contracts'){const unit=get('units',data.unitId);put('units',{...unit,status:'Đang thuê'},user,'contract-activate');}
   if(collection==='maintenance'){
    const asset=get('assets',data.assetId);const next=new Date(data.date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+asset.intervalDays);put('assets',{...asset,nextMaintenance:next.toISOString().slice(0,10)},user,'maintenance-schedule');
    if(data.cost>0){const building=get('buildings',asset.buildingId);put('expenses',{id:randomUUID(),code:nextCode('expenses'),name:'Bảo trì: '+asset.name,buildingId:building.id,legalEntityId:building.legalEntityId,category:'Bảo trì',amount:data.cost,taxRate:0,dueDate:data.date,status:'Chờ duyệt',maintenanceId:result.id},user);}
   }
   return result;
  });
 }
 function update(collection,id,input,user){canWrite(collection,user);assert(collection!=='payments','Khoản thu đã ghi không được sửa.',409);const old=accessible(collection,id,user);if(input.updatedAt)assert(input.updatedAt===old.updatedAt,'Bản ghi đã thay đổi. Tải lại trước khi lưu.',409);return transaction(()=>put(collection,{...old,...validate(collection,input,user,old)},user,'update'));}
 function remove(collection,id,user){canWrite(collection,user);assert(user.role==='admin','Chỉ quản trị viên được xóa dữ liệu nháp.',403);const old=accessible(collection,id,user);checkLock(collection,old);
  assert(!['contracts','invoices','payments','prices','exchangeRates','feeTypes','maintenance','journalEntries','stockMovements'].includes(collection),'Bản ghi nghiệp vụ có lịch sử không được xóa.',409);
  assert(!old.status||['Trống','Chờ duyệt','Chưa hoàn thành','Mới'].includes(old.status),'Chỉ xóa bản ghi nháp.',409);
  for(const name of Object.keys(schemas))assert(!list(name).some(r=>Object.entries(r).some(([key,value])=>key.endsWith('Id')&&value===id)),'Bản ghi đang được tham chiếu, không được xóa.',409);
  transaction(()=>{db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(collection,id);store.audit(user,'delete',collection,id,old,null);});return {ok:true};
 }
 function flowTask(flow,employeeId,dueDate,user){checkLock('tasks',{dueDate});const employee=get('employees',employeeId),step=flow.steps[flow.currentStep];assert(employee&&employee.department===step.department,'Người phụ trách phải thuộc '+step.department+'.');assert(validDate(dueDate),'Hạn bước không hợp lệ.');let obligation=list('obligations').find(o=>o.position===employee.position&&o.department===employee.department&&o.name==='Vòng đời dự án');if(!obligation)obligation=put('obligations',{id:randomUUID(),code:nextCode('obligations'),name:'Vòng đời dự án',position:employee.position,department:employee.department,damage:'Nặng'},user);return put('tasks',{id:randomUUID(),code:nextCode('tasks',employee.department+'-'+dueDate.slice(0,7).replace('-','')),name:flow.name+' · '+step.name,employeeId,obligationId:obligation.id,department:employee.department,damage:'Nặng',dueDate,progress:0,status:'Chưa hoàn thành',flowId:flow.id,notes:'Bước '+(flow.currentStep+1)+'/'+flow.steps.length+'; tài liệu: '+step.document},user,'flow-task');}
 function postJournal({name,date,legalEntityId,sourceType,sourceId,lines},user){
  checkLock('journalEntries',{date});const totalDebit=lines.reduce((s,l)=>s+l.debit,0),totalCredit=lines.reduce((s,l)=>s+l.credit,0);assert(Number.isSafeInteger(totalDebit)&&totalDebit>0&&totalDebit===totalCredit,'Bút toán phải cân Nợ/Có.');for(const line of lines){assert(list('accounts').some(a=>a.accountNumber===line.account),'Tài khoản kế toán không tồn tại.');assert(Number.isSafeInteger(line.debit)&&Number.isSafeInteger(line.credit)&&line.debit>=0&&line.credit>=0&&!(line.debit&&line.credit),'Dòng bút toán không hợp lệ.');}
  return put('journalEntries',{id:randomUUID(),code:nextCode('journalEntries'),name,date,legalEntityId,sourceType,sourceId,lines:lines.filter(l=>l.debit||l.credit),totalDebit,totalCredit},user,'post-journal');
 }
 function issue(contractId,period,user){assert(['admin','accountant'].includes(user.role),'Chỉ kế toán được lập hóa đơn.',403);const contract=accessible('contracts',contractId,user);assert(contract.status==='Hiệu lực','Hợp đồng đã đóng.');checkLock('invoices',{period});
  assert(!list('invoices').some(i=>i.contractId===contractId&&i.period===period),'Hợp đồng đã có hóa đơn kỳ này.',409);
  const amounts=calculateInvoice({contract,unit:get('units',contract.unitId),prices:list('prices'),rates:list('exchangeRates'),taxes:list('feeTypes'),meters:list('meters'),period});
  const services=list('tickets').filter(t=>t.contractId===contract.id&&t.status==='Đã nghiệm thu'&&t.serviceFee>0&&!t.invoiceId);
  for(const ticket of services){const tax=latest(list('feeTypes').filter(t=>t.fee==='service'),period+'-01');assert(tax,'Thiếu thuế suất dịch vụ.');const line={fee:'service',name:'Dịch vụ: '+ticket.name,quantity:1,net:ticket.serviceFee,taxRate:tax.taxRate,tax:Math.round(ticket.serviceFee*tax.taxRate/100),ticketId:ticket.id};line.total=line.net+line.tax;amounts.lines.push(line);amounts.net+=line.net;amounts.tax+=line.tax;amounts.total+=line.total;}
  return transaction(()=>{const entity=get('legalEntities',contract.legalEntityId);const code=nextCode('invoices',entity.code+'-'+period.slice(0,4));
   const invoice=put('invoices',{id:randomUUID(),code,contractId,tenantId:contract.tenantId,legalEntityId:contract.legalEntityId,unitId:contract.unitId,period,dueDate:period+'-05',...amounts,paid:0,status:'Chờ thu',snapshot:{contract:{...contract},tenant:{...get('tenants',contract.tenantId)},entity:{...entity},unit:{...get('units',contract.unitId)}}},user);
   postJournal({name:'Phát hành '+invoice.code,date:period+'-01',legalEntityId:invoice.legalEntityId,sourceType:'invoices',sourceId:invoice.id,lines:[{account:'131',debit:invoice.total,credit:0},{account:'511',debit:0,credit:invoice.net},{account:'3331',debit:0,credit:invoice.tax}]},user);
   for(const ticket of services)put('tickets',{...ticket,invoiceId:invoice.id},user,'service-invoice');return invoice;
  });
 }
 function action(collection,id,actionName,input,user){const old=accessible(collection,id,user);if(!((collection==='journalEntries'&&actionName==='reverse')||(collection==='invoices'&&actionName==='pay')))checkLock(collection,old);
  return transaction(()=>{
   if(collection==='invoices'&&actionName==='pay'){
    assert(['admin','accountant'].includes(user.role),'Bạn không được thu tiền.',403);assert(old.status!=='Đã hủy','Hóa đơn đã hủy không được thu.',409);const amount=Number(input.amount);assert(Number.isSafeInteger(amount)&&amount>0&&amount<=old.total-old.paid,'Khoản thu phải lớn hơn 0 và không vượt dư nợ.');assert(validDate(input.date)&&input.date<=dateToday(),'Ngày thu không hợp lệ hoặc ở tương lai.');checkLock('payments',input);
    assert(['Chuyển khoản','Tiền mặt','Cấn trừ cọc'].includes(input.method),'Hình thức thu không hợp lệ.');
    if(input.method==='Cấn trừ cọc'){const c=get('contracts',old.contractId);assert(c.endDate.slice(0,7)===old.period||c.status==='Đã đóng','Chỉ cấn trừ cọc ở kỳ cuối hoặc khi thanh lý.');assert(c.depositBalance>=amount,'Số cọc còn lại không đủ.');put('contracts',{...c,depositBalance:c.depositBalance-amount},user,'deposit-offset');}
    const p=put('payments',{id:randomUUID(),code:nextCode('payments'),invoiceId:id,amount,date:input.date,method:input.method,reference:String(input.reference||'').slice(0,200)},user);
    postJournal({name:'Thu tiền '+old.code,date:input.date,legalEntityId:old.legalEntityId,sourceType:'payments',sourceId:p.id,lines:[{account:input.method==='Tiền mặt'?'111':input.method==='Cấn trừ cọc'?'3386':'112',debit:amount,credit:0},{account:'131',debit:0,credit:amount}]},user);
    store.audit(user,'payment','invoices',id,old,get('invoices',id));return p;
   }
   if(collection==='contracts'&&actionName==='receiveDeposit'){assert(['admin','accountant'].includes(user.role),'Chỉ kế toán được nhận cọc.',403);assert(old.status==='Hiệu lực','Chỉ nhận cọc cho hợp đồng hiệu lực.');const amount=Number(input.amount);assert(Number.isSafeInteger(amount)&&amount>0&&amount<=Number(old.deposit||0)-Number(old.depositReceived||0),'Số cọc nhận phải dương và không vượt nghĩa vụ cọc còn lại.');assert(validDate(input.date)&&input.date<=dateToday(),'Ngày nhận cọc không hợp lệ.');checkLock('depositTransactions',input);assert(['Chuyển khoản','Tiền mặt'].includes(input.method),'Hình thức không hợp lệ.');const receipt=put('depositTransactions',{id:randomUUID(),code:nextCode('depositTransactions'),contractId:id,legalEntityId:old.legalEntityId,direction:'Nhận',amount,date:input.date,method:input.method},user,'deposit-receipt');postJournal({name:'Nhận cọc '+old.code,date:input.date,legalEntityId:old.legalEntityId,sourceType:'depositTransactions',sourceId:receipt.id,lines:[{account:input.method==='Tiền mặt'?'111':'112',debit:amount,credit:0},{account:'3386',debit:0,credit:amount}]},user);put('contracts',{...old,depositBalance:old.depositBalance+amount,depositReceived:Number(old.depositReceived||0)+amount},user,'receive-deposit');return receipt;}
   if(collection==='contracts'&&actionName==='close'){
    assert(['admin','manager','accountant'].includes(user.role),'Bạn không được đóng hợp đồng.',403);assert(old.status==='Hiệu lực','Hợp đồng đã đóng.');const date=input.date;assert(validDate(date)&&date>=old.startDate&&date<=dateToday(),'Ngày đóng hợp đồng không hợp lệ.');
    const future=list('invoices').filter(i=>i.contractId===id&&i.period>date.slice(0,7));for(const invoice of future){checkLock('invoices',invoice);assert(invoice.paid===0,'Có hóa đơn tương lai đã thu; phải xử lý trước khi thanh lý.');}
    const early=date<old.endDate;const enough=Number(input.noticeMonths||0)>=Number(old.noticeMonths??2);const months=early?Number(enough?(old.penaltyWithNotice??2):(old.penaltyWithoutNotice??4)):0;
    const price=latest(list('prices').filter(p=>p.contractId===id&&p.fee==='rent'),date);const fx=price?.currency==='USD'?latest(list('exchangeRates').filter(r=>r.contractId===id),date)?.rate:1;assert(!early||price&&fx,'Thiếu giá/tỷ giá để tính bồi thường.');const compensation=months*Math.round((price?.unitPrice||0)*(price?.basis==='area'?get('units',old.unitId).area:1)*(fx||1));
    const result=put('contracts',{...old,status:'Đã đóng',closedDate:date,compensation,compensationMonths:months,closureReason:String(input.reason||''),depositRefundDue:old.depositBalance},user,'close-contract');
    for(const invoice of future){put('invoices',{...invoice,status:'Đã hủy',cancelledAt:new Date().toISOString()},user,'stop-future-billing');const original=list('journalEntries').find(j=>j.sourceType==='invoices'&&j.sourceId===invoice.id);if(original)postJournal({name:'Hủy kỳ tương lai '+invoice.code,date:invoice.period+'-01',legalEntityId:invoice.legalEntityId,sourceType:'invoice-cancel',sourceId:invoice.id,lines:original.lines.map(l=>({...l,debit:l.credit,credit:l.debit}))},user);}
    const unit=get('units',old.unitId);if(!list('contracts').some(c=>c.id!==id&&c.unitId===unit.id&&c.status==='Hiệu lực'))put('units',{...unit,status:'Trống'},user,'release-unit');return result;
   }
   if(collection==='contracts'&&actionName==='refundDeposit'){
    assert(['admin','accountant'].includes(user.role)&&old.status==='Đã đóng','Chỉ kế toán hoàn cọc khi hợp đồng đã đóng.',403);assert(old.depositBalance>0,'Không còn cọc để hoàn.');assert(!list('invoices').some(i=>i.contractId===id&&i.status!=='Đã hủy'&&i.total>i.paid),'Còn công nợ chưa giải quyết.');assert(!old.compensation||input.confirmCompensation===true,'Xác nhận bồi thường đã được xử lý trước khi hoàn cọc.');const receipt=put('depositTransactions',{id:randomUUID(),code:nextCode('depositTransactions'),contractId:id,legalEntityId:old.legalEntityId,direction:'Hoàn',amount:old.depositBalance,date:dateToday(),method:'Chuyển khoản'},user,'deposit-refund');postJournal({name:'Hoàn cọc '+old.code,date:dateToday(),legalEntityId:old.legalEntityId,sourceType:'depositTransactions',sourceId:receipt.id,lines:[{account:'3386',debit:old.depositBalance,credit:0},{account:'112',debit:0,credit:old.depositBalance}]},user);return put('contracts',{...old,depositRefunded:old.depositBalance,depositBalance:0,depositRefundedAt:new Date().toISOString()},user,'refund-deposit');
   }
   if(collection==='tasks'){
    if(actionName==='submit'){assert(['Chưa hoàn thành','Bị trả lại'].includes(old.status),'Trạng thái hiện tại không thể gửi duyệt.');assert(['admin','manager'].includes(user.role)||old.employeeId===user.scope.employeeId,'Chỉ người phụ trách được gửi duyệt.',403);assert(old.completedDate&&old.completedDate<=dateToday(),'Phải khai ngày hoàn thành hợp lệ trước khi gửi duyệt.');return put('tasks',{...old,status:'Chờ duyệt',progress:100,submittedAt:new Date().toISOString()},user,'submit');}
    assert(['admin','manager'].includes(user.role),'Chỉ trưởng phòng được duyệt việc.',403);assert(old.status==='Chờ duyệt','Việc không nằm trong hàng đợi duyệt.');assert(['approve','reject'].includes(actionName),'Thao tác không hợp lệ.');if(actionName==='reject')assert(input.reason?.trim(),'Phải ghi lý do trả lại.');return put('tasks',{...old,status:actionName==='approve'?'Đã duyệt':'Bị trả lại',reviewNote:String(input.reason||''),reviewedAt:new Date().toISOString(),reviewedBy:user.id},user,actionName);
   }
   if(collection==='projectFlows'&&actionName==='advance'){assert(['admin','manager'].includes(user.role),'Chỉ quản lý xác nhận chuyển bước.',403);assert(old.status==='Đang thực hiện','Quy trình đã hoàn tất.');const task=get('tasks',old.taskIds[old.currentStep]);assert(task?.status==='Đã duyệt','Công việc của bước hiện tại phải được duyệt.');assert(typeof input.documentUrl==='string'&&input.documentUrl.length<=2000,'Cần liên kết tài liệu.');let link;try{link=new URL(input.documentUrl);}catch{}assert(link&&['https:','http:'].includes(link.protocol),'Liên kết tài liệu phải là HTTP/HTTPS.');const history=[...old.history,{step:old.currentStep,name:old.currentStepName,document:old.steps[old.currentStep].document,documentUrl:input.documentUrl,confirmedBy:user.id,confirmedAt:new Date().toISOString()}];const next=old.currentStep+1;if(next===old.steps.length)return put('projectFlows',{...old,status:'Đã hoàn thành',history,completedAt:new Date().toISOString()},user,'complete-project-flow');const nextOwner=accessible('employees',input.nextOwnerId,user);const updated={...old,currentStep:next,currentStepName:old.steps[next].name,ownerId:nextOwner.id,dueDate:input.nextDueDate,history};const nextTask=flowTask(updated,nextOwner.id,input.nextDueDate,user);return put('projectFlows',{...updated,taskIds:[...old.taskIds,nextTask.id]},user,'advance-project-flow');}
   if(collection==='journalEntries'&&actionName==='reverse'){assert(['admin','accountant'].includes(user.role),'Chỉ kế toán lập bút toán đảo.',403);assert(!list('journalEntries').some(j=>j.reversalOf===id),'Bút toán đã có bút toán đảo.',409);assert(validDate(input.date)&&input.date<=dateToday()&&input.date>=old.date,'Ngày đảo phải sau bút toán gốc và không ở tương lai.');const reversal=postJournal({name:'Đảo '+old.code+': '+String(input.reason||''),date:input.date,legalEntityId:old.legalEntityId,sourceType:'reversal',sourceId:id,lines:old.lines.map(l=>({...l,debit:l.credit,credit:l.debit}))},user);return put('journalEntries',{...reversal,reversalOf:id},user,'reversal-reference');}
   if(collection==='inventoryItems'){assert(['admin','manager','technician'].includes(user.role),'Không được xuất nhập vật tư.',403);assert(['receive','issue'].includes(actionName),'Thao tác kho không hợp lệ.');const quantity=Number(input.quantity);assert(Number.isFinite(quantity)&&quantity>0,'Số lượng phải lớn hơn 0.');assert(validDate(input.date)&&input.date<=dateToday(),'Ngày nhập xuất không hợp lệ.');if(actionName==='issue')assert(old.quantity>=quantity,'Tồn kho không đủ.');const movement=put('stockMovements',{id:randomUUID(),code:nextCode('stockMovements'),name:old.name,itemId:id,buildingId:old.buildingId,direction:actionName==='receive'?'Nhập':'Xuất',quantity,date:input.date,notes:String(input.notes||'')},user,'stock-movement');put('inventoryItems',{...old,quantity:old.quantity+(actionName==='receive'?quantity:-quantity)},user,'stock-balance');return movement;}
   if(collection==='purchaseOrders'){assert(['admin','manager'].includes(user.role),'Chỉ quản lý duyệt và xác nhận mua sắm.',403);if(actionName==='approve'){assert(old.status==='Chờ duyệt','Đề nghị không ở trạng thái chờ duyệt.');return put(collection,{...old,status:'Đã duyệt'},user,'approve');}if(actionName==='receive'){assert(old.status==='Đã duyệt','Đề nghị chưa được duyệt.');const expense=put('expenses',{id:randomUUID(),code:nextCode('expenses'),name:'Mua sắm: '+old.name,buildingId:old.buildingId,legalEntityId:old.legalEntityId,category:'Vận hành',amount:old.total,taxRate:old.taxRate||0,dueDate:old.dueDate,status:'Chờ duyệt',purchaseOrderId:id,vendorId:old.vendorId},user,'purchase-expense');return put(collection,{...old,status:'Đã nhận hàng',expenseId:expense.id,receivedAt:new Date().toISOString()},user,'receive-purchase');}}
   if(collection==='expenses'){
    assert(['admin','manager','accountant'].includes(user.role),'Bạn không được duyệt/thanh toán.',403);
    if(actionName==='approve'){assert(['admin','manager'].includes(user.role)&&old.status==='Chờ duyệt','Chỉ trưởng phòng duyệt đề nghị chi chờ duyệt.',403);const tax=Math.round(old.amount*Number(old.taxRate||0)/100);postJournal({name:'Ghi nhận chi phí '+old.code,date:old.dueDate,legalEntityId:old.legalEntityId,sourceType:'expenses',sourceId:id,lines:[{account:'642',debit:old.amount,credit:0},{account:'133',debit:tax,credit:0},{account:'331',debit:0,credit:old.amount+tax}]},user);return put('expenses',{...old,status:'Đã duyệt'},user,'approve');}
    if(actionName==='pay'){assert(['admin','accountant'].includes(user.role)&&old.status==='Đã duyệt','Chỉ kế toán thanh toán khoản chi đã duyệt.',403);assert(validDate(input.date)&&input.date<=dateToday(),'Ngày chi không hợp lệ.');checkLock('expenses',{date:input.date});const total=old.amount+Math.round(old.amount*Number(old.taxRate||0)/100);postJournal({name:'Thanh toán '+old.code,date:input.date,legalEntityId:old.legalEntityId,sourceType:'expense-payment',sourceId:id,lines:[{account:'331',debit:total,credit:0},{account:'112',debit:0,credit:total}]},user);return put('expenses',{...old,status:'Đã thanh toán',paidDate:input.date},user,'pay');}
   }
   if(collection==='tickets'){
    const transitions={assign:['Mới','Đang xử lý'],resolve:['Đang xử lý','Chờ nghiệm thu'],accept:['Chờ nghiệm thu','Đã nghiệm thu']};const transition=transitions[actionName];assert(transition&&transition[0]===old.status,'Thao tác không phù hợp trạng thái.');
    if(actionName==='accept')assert(['admin','manager','tenant'].includes(user.role),'Chỉ khách thuê hoặc quản lý được nghiệm thu.',403);else assert(['admin','manager','technician'].includes(user.role),'Chỉ kỹ thuật/quản lý xử lý yêu cầu.',403);
    if(actionName==='assign')assert(input.assignee?.trim(),'Phải nhập người xử lý.');return put('tickets',{...old,status:transition[1],assignee:input.assignee||old.assignee,...(actionName==='resolve'?{resolvedAt:new Date().toISOString()}:{}),...(actionName==='accept'?{acceptedAt:new Date().toISOString()}:{})},user,actionName);
   }
   assert(false,'Thao tác chưa hỗ trợ.',404);
  });
 }
 function payroll(period,user){assert(['admin','manager','accountant'].includes(user.role),'Không được xem lương.',403);const locked=list('periods').find(p=>p.period===period);if(locked?.payrollSnapshot)return locked.payrollSnapshot.filter(p=>visible('employees',p.employee,user));return rows('employees',user).map(employee=>{
  const kpis=list('kpis').filter(k=>k.position===employee.position&&k.period===period);const details=kpis.map(k=>{
   const quality=list('qualityChecks').filter(q=>q.employeeId===employee.id&&q.date.startsWith(period));const actual=k.source==='qualityScore'?(quality.length?quality.reduce((s,q)=>s+q.score,0)/quality.length:0):k.source==='approvedTasks'?list('tasks').filter(t=>t.employeeId===employee.id&&t.status==='Đã duyệt'&&t.dueDate.startsWith(period)).length:k.source==='resolvedTickets'?list('tickets').filter(t=>t.assignee===employee.name&&t.status==='Đã nghiệm thu'&&t.resolvedAt?.startsWith(period)).length:Number(k.actual||0);
   return {...k,actual,achievement:Math.min(120,actual/k.target*100)};
  });const weight=details.reduce((sum,k)=>sum+k.weight,0);const score=details.reduce((sum,k)=>sum+k.achievement*k.weight/100,0);const bonus=weight===100?Math.round(employee.bonusCap*score/100):0;return {employee,details,weight,score,bonus,oldSalary:employee.baseSalary,proposedSalary:employee.baseSalary+bonus,trialOnly:true};
 });}
 function reports(user,period=dateToday().slice(0,7),filters={}){
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(period),'Kỳ báo cáo không hợp lệ.');if(filters.legalEntityId)accessible('legalEntities',filters.legalEntityId,user);if(filters.buildingId)accessible('buildings',filters.buildingId,user);
  const scoped=(name)=>readable(name,user)?rows(name,user,filters):[];
  const buildings=scoped('buildings'),units=scoped('units'),contracts=scoped('contracts'),invoices=scoped('invoices').filter(i=>i.status!=='Đã hủy'),payments=scoped('payments'),deposits=scoped('depositTransactions'),expenses=scoped('expenses'),tickets=scoped('tickets');
  const current=invoices.filter(i=>i.period===period);const cashIn=payments.filter(p=>p.date.startsWith(period)&&p.method!=='Cấn trừ cọc').reduce((s,p)=>s+p.amount,0)+deposits.filter(d=>d.direction==='Nhận'&&d.date.startsWith(period)).reduce((s,d)=>s+d.amount,0);const cashOut=expenses.filter(e=>e.status==='Đã thanh toán'&&e.paidDate?.startsWith(period)).reduce((s,e)=>s+Math.round(e.amount*(1+Number(e.taxRate||0)/100)),0)+deposits.filter(d=>d.direction==='Hoàn'&&d.date.startsWith(period)).reduce((s,d)=>s+d.amount,0);
  const occupied=units.filter(u=>contracts.some(c=>c.unitId===u.id&&c.startDate<=period+'-31'&&(c.status==='Hiệu lực'?c.endDate:c.closedDate)>=period+'-01'));const area=units.reduce((s,u)=>s+u.area,0),occupiedArea=occupied.reduce((s,u)=>s+u.area,0);
  const aging=[{name:'Chưa đến hạn',total:0},{name:'0–30 ngày',total:0},{name:'31–60 ngày',total:0},{name:'61–90 ngày',total:0},{name:'Trên 90 ngày',total:0}];
  for(const i of invoices){const days=daysBetween(i.dueDate,dateToday());aging[days<0?0:days<=30?1:days<=60?2:days<=90?3:4].total+=i.total-i.paid;}
  const expiring=contracts.filter(c=>c.status==='Hiệu lực'&&daysBetween(dateToday(),c.endDate)>=0&&daysBetween(dateToday(),c.endDate)<=90);
  const project=buildings.map(b=>{const bs=units.filter(u=>u.buildingId===b.id);const ids=new Set(bs.map(u=>u.id));const revenue=current.filter(i=>ids.has(i.unitId)).reduce((s,i)=>s+i.net,0);const cost=expenses.filter(e=>e.buildingId===b.id&&e.dueDate.startsWith(period)).reduce((s,e)=>s+e.amount,0);const total=bs.reduce((s,u)=>s+u.area,0);const occupiedM2=occupied.filter(u=>ids.has(u.id)).reduce((s,u)=>s+u.area,0);return {...b,unitCount:bs.length,occupancy:total?occupiedM2/total*100:0,revenue,cost,profit:revenue-cost,margin:revenue?(revenue-cost)/revenue*100:0};});
  const months=[];
  for(let offset=-5;offset<=3;offset++){const d=new Date(period+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);const key=d.toISOString().slice(0,7);let incoming=payments.filter(p=>p.date.startsWith(key)&&p.method!=='Cấn trừ cọc').reduce((s,p)=>s+p.amount,0)+deposits.filter(d=>d.direction==='Nhận'&&d.date.startsWith(key)).reduce((s,d)=>s+d.amount,0),outgoing=expenses.filter(e=>e.paidDate?.startsWith(key)&&e.status==='Đã thanh toán').reduce((s,e)=>s+Math.round(e.amount*(1+Number(e.taxRate||0)/100)),0)+deposits.filter(d=>d.direction==='Hoàn'&&d.date.startsWith(key)).reduce((s,d)=>s+d.amount,0);
   if(offset>0){incoming=0;for(const c of contracts.filter(c=>c.status==='Hiệu lực'&&c.startDate<=key+'-31'&&c.endDate>=key+'-01')){try{incoming+=calculateInvoice({contract:c,unit:get('units',c.unitId),prices:list('prices'),rates:list('exchangeRates'),taxes:list('feeTypes'),meters:list('meters'),period:key}).total;}catch{ /* Incomplete usage/rate data is reported below. */ }}outgoing=expenses.filter(e=>e.dueDate.startsWith(key)&&e.status==='Đã duyệt').reduce((s,e)=>s+Math.round(e.amount*(1+Number(e.taxRate||0)/100)),0);}
   months.push({period:key,incoming,outgoing,forecast:offset>0});
  }
  const taskRows=scoped('tasks').filter(t=>t.dueDate.startsWith(period));const departments=['TCKT','PKD','BQL','MKT','HCNS'].map(name=>{const tasks=taskRows.filter(t=>t.department===name);return {name,total:tasks.length,approved:tasks.filter(t=>t.status==='Đã duyệt').length,pending:tasks.filter(t=>t.status==='Chờ duyệt').length,late:tasks.filter(t=>t.status!=='Đã duyệt'&&t.dueDate<dateToday()).length};});
  const taxes=Object.entries(current.reduce((acc,i)=>{const name=get('legalEntities',i.legalEntityId)?.name||'Khác';acc[name]=(acc[name]||0)+i.tax;return acc;},{})).map(([name,output])=>({name,output,input:expenses.filter(e=>get('legalEntities',e.legalEntityId)?.name===name&&e.dueDate.startsWith(period)).reduce((s,e)=>s+Math.round(e.amount*Number(e.taxRate||0)/100),0)}));
  const flowRows=scoped('projectFlows');const qualityRows=scoped('qualityChecks').filter(q=>q.date.startsWith(period));
  return {flows:flowRows,quality:qualityRows,period,buildings:buildings.length,units:units.length,tenants:scoped('tenants').length,contracts:contracts.filter(c=>c.status==='Hiệu lực').length,revenue:current.reduce((s,i)=>s+i.net,0),cashIn,cashOut,debt:invoices.reduce((s,i)=>s+i.total-i.paid,0),debtInvoices:invoices.filter(i=>i.total>i.paid).length,occupancy:area?occupiedArea/area*100:0,vacantArea:area-occupiedArea,vacantValue:units.filter(u=>!occupied.some(o=>o.id===u.id)).reduce((s,u)=>s+u.area*Number(u.askingRent||0),0),aging,expiring,project,months,departments,taxes,tickets:tickets.filter(t=>t.status!=='Đã nghiệm thu'),maintenance:scoped('assets').filter(a=>a.nextMaintenance<=dateToday()),approvals:taskRows.filter(t=>t.status==='Chờ duyệt'),forecastNote:'Dự báo là mức tối thiểu: khoản theo công tơ chưa có chỉ số hoặc thiếu giá/tỷ giá không được tính; chưa giả định khoản chi chưa cam kết.'};
 }
 function ledger(period,user,filters={}){assert(['admin','manager','accountant'].includes(user.role),'Không được xem sổ kế toán.',403);assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(period),'Kỳ không hợp lệ.');const journals=rows('journalEntries',user,filters).filter(j=>j.date.slice(0,7)<=period);const accounts=rows('accounts',user).map(a=>{let debit=0,credit=0,balance=0;for(const journal of journals)for(const line of journal.lines.filter(l=>l.account===a.accountNumber)){balance+=line.debit-line.credit;if(journal.date.startsWith(period)){debit+=line.debit;credit+=line.credit;}}return {...a,debit,credit,debitBalance:Math.max(0,balance),creditBalance:Math.max(0,-balance)};});return {period,accounts,totalDebit:accounts.reduce((s,a)=>s+a.debit,0),totalCredit:accounts.reduce((s,a)=>s+a.credit,0)};}
 function lockPeriod(period,user){assert(user.role==='admin','Chỉ quản trị viên được chốt kỳ.',403);assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(period)&&period<=dateToday().slice(0,7),'Kỳ chốt không hợp lệ.');assert(!list('periods').some(p=>p.period===period),'Kỳ đã chốt.',409);assert(!list('tasks').some(t=>t.dueDate.startsWith(period)&&t.status==='Chờ duyệt'),'Còn công việc chờ duyệt trong kỳ.');const snapshot=reports(user,period);return transaction(()=>put('periods',{id:randomUUID(),code:'KY-'+period,period,status:'Đã chốt',snapshot,payrollSnapshot:payroll(period,user)},user,'lock-period'));}
 return {rows,visible,readable,accessible,create,update,remove,issue,action,reports,payroll,ledger,postJournal,lockPeriod,appraisal:(id,user)=>appraisalModel(accessible('appraisals',id,user)),nextCode};
}
