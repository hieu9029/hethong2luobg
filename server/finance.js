import {feeLabels} from '../shared/schema.js';
export function assert(condition,message,status=400){if(!condition){const error=new Error(message);error.status=status;throw error;}}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
export function latest(rows,date){return rows.filter(r=>r.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];}
export function calculateInvoice({contract,unit,prices,rates,taxes,meters,period}){
 assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(period),'Kỳ phải có dạng YYYY-MM.');
 const [year,month]=period.split('-').map(Number);const count=new Date(Date.UTC(year,month,0)).getUTCDate();
 const periodStart=period+'-01', periodEnd=period+'-'+count;
 assert(contract.status==='Hiệu lực','Hợp đồng đã đóng.');
 assert(contract.startDate<=periodEnd&&contract.endDate>=periodStart,'Kỳ nằm ngoài thời hạn hợp đồng.');
 const lines=[];
 const fees=[...new Set(prices.filter(p=>p.contractId===contract.id).map(p=>p.fee))];
 for(const fee of fees){
  const schedule=prices.filter(p=>p.contractId===contract.id&&p.fee===fee);const buckets=new Map();
  for(let day=1;day<=count;day++){
   const date=period+'-'+String(day).padStart(2,'0');
   if(date<contract.startDate||date>contract.endDate||(fee==='rent'&&contract.freeUntil&&date<=contract.freeUntil))continue;
   const price=latest(schedule,date);assert(price,`Thiếu đơn giá ${feeLabels[fee]} hiệu lực ngày ${date}.`);
   const tax=latest(taxes.filter(t=>t.fee===fee),date);assert(tax,`Thiếu thuế suất ${feeLabels[fee]} ngày ${date}.`);
   const fx=price.currency==='USD'?latest(rates.filter(r=>r.contractId===contract.id),date)?.rate:1;
   assert(fx>0,`Thiếu tỷ giá của đúng hợp đồng ngày ${date}.`);
   let quantity=price.basis==='area'?unit.area:1;
   if(price.basis==='usage'){
    const meter=meters.find(m=>m.contractId===contract.id&&m.fee===fee&&m.period===period);
    assert(meter,`Chưa nhập chỉ số ${feeLabels[fee]} kỳ ${period}.`);quantity=meter.endReading-meter.startReading;
   }
   // Meter amounts are allocated across the full month's daily effective prices.
   const amount=quantity*price.unitPrice*fx/count;
   const key=[price.id,tax.taxRate,fx].join(':');let item=buckets.get(key);
   if(!item){item={fee,name:feeLabels[fee],basis:price.basis,quantity,unitPrice:price.unitPrice,currency:price.currency,exchangeRate:fx,taxRate:tax.taxRate,from:date,to:date,days:0,net:0};buckets.set(key,item);}
   item.days++;item.to=date;item.net+=amount;
  }
  for(const item of buckets.values()){item.net=Math.round(item.net);item.tax=Math.round(item.net*item.taxRate/100);item.total=item.net+item.tax;lines.push(item);}
 }
 assert(lines.length,'Hợp đồng chưa có lộ trình giá hoặc toàn kỳ được miễn phí.');
 return {lines,net:lines.reduce((sum,l)=>sum+l.net,0),tax:lines.reduce((sum,l)=>sum+l.tax,0),total:lines.reduce((sum,l)=>sum+l.total,0)};
}
export function appraisalModel(input){
 const months=input.model==='Master Lease'?120:60;
 return [{name:'Thận trọng',factor:.85,costFactor:1.1},{name:'Cơ sở',factor:1,costFactor:1},{name:'Tích cực',factor:1.1,costFactor:.95}].map(s=>{
  const initial=Number(input.setupCost||0)+Number(input.deposit||0);const cashflows=[-initial];let cumulative=-initial;let breakeven=null;
  const monthlyDiscount=(1+input.discountRate/100)**(1/12)-1;let npv=-initial;
  const timeline=[];
  for(let i=1;i<=months;i++){
   const year=Math.floor((i-1)/12);
   const occupancy=Math.max(0,Math.min(1,input.occupancy/100*s.factor*Math.min(1,i/input.rampMonths)-Number(input.churn||0)/100));
   const revenue=input.area*input.rentPerM2*(1+Number(input.rentGrowth||0)/100)**year*occupancy;
   const owner=i<=Number(input.freeMonths||0)?0:input.ownerRent*(1+Number(input.costGrowth||0)/100)**year;
   const cost=(owner+input.operatingCost+Number(input.marketingCost||0))*s.costFactor;
   const cash=Math.round(revenue-cost+(i===months?Number(input.deposit||0):0));cashflows.push(cash);cumulative+=cash;npv+=cash/(1+monthlyDiscount)**i;
   if(cumulative>=0&&breakeven===null)breakeven=i;
   timeline.push({month:i,revenue:Math.round(revenue),cost:Math.round(cost),cash,cumulative:Math.round(cumulative),occupancy:Math.round(occupancy*100)});
  }
  const value=rate=>cashflows.reduce((sum,c,i)=>sum+c/(1+rate)**i,0);
  let low=-.95,high=1,irr=null;
  if(value(low)*value(high)<0){for(let i=0;i<100;i++){const mid=(low+high)/2;if(value(mid)>0)low=mid;else high=mid;}irr=((1+(low+high)/2)**12-1)*100;}
  const minimumOccupancy=(input.ownerRent+input.operatingCost+Number(input.marketingCost||0))/(input.area*input.rentPerM2)*100;
  return {...s,months,breakeven,profit:Math.round(cumulative),npv:Math.round(npv),irr,minimumOccupancy,timeline};
 });
}
