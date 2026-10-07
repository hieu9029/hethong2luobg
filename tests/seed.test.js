import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/database.js';
import {createERP} from '../server/erp.js';
import {createServer} from '../server/index.js';
import {seedDemo} from '../server/seed.js';

const actor={id:'demo-test',name:'Demo test',role:'admin',scope:{}};

test('Demo is repeatable without duplicate records, audit entries or changed financial balances',()=>{
 const store=openDatabase(':memory:');
 try {
  const erp=createERP(store),first=seedDemo(store,erp,actor);
  assert.equal(first.created,true);
  assert.equal(first.counts.buildings,3);
  assert.equal(first.counts.invoices,24);
  assert.equal(first.counts.contracts,4);
  const records=store.db.prepare('SELECT * FROM records ORDER BY collection,id').all();
  const auditCount=store.db.prepare('SELECT COUNT(*) AS count FROM audit').get().count;
  const second=seedDemo(store,erp,actor);
  assert.equal(second.created,false);
  assert.equal(second.period,first.period);
  assert.deepEqual(second.counts,first.counts);
  assert.deepEqual(store.db.prepare('SELECT * FROM records ORDER BY collection,id').all(),records);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM audit').get().count,auditCount);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM users').get().count,0);
  for(const entry of store.list('journalEntries'))assert.equal(entry.totalDebit,entry.totalCredit);
 } finally {store.db.close();}
});

test('Demo refuses existing business data without changing it or adding records',()=>{
 const store=openDatabase(':memory:');
 try {
  store.put('tenants',{id:'existing',code:'KH-0001',name:'Existing tenant'},actor);
  const before=store.db.prepare('SELECT * FROM records').all();
  assert.throws(()=>seedDemo(store,createERP(store),actor),error=>error.status===409);
  assert.deepEqual(store.db.prepare('SELECT * FROM records').all(),before);
  assert.equal(store.setting('demo'),undefined);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM audit').get().count,1);
 } finally {store.db.close();}
});

test('A failed demo rolls back all records, accounting data, settings and audit history',()=>{
 const store=openDatabase(':memory:');
 try {
  const erp=createERP(store);
  assert.throws(()=>seedDemo(store,{...erp,issue:()=>{throw new Error('Simulated invoice failure');}},actor),/Simulated invoice failure/);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM records').get().count,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM audit').get().count,0);
  assert.equal(store.setting('demo'),undefined);
  assert.equal(store.setting('demoPeriod'),undefined);
 } finally {store.db.close();}
});

test('Admin bootstrap can use a preloaded demo without duplicating data',async()=>{
 const app=createServer({dbPath:':memory:'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 try {
  const before=seedDemo(app.store,app.erp,actor);
  const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/auth/bootstrap',{
   method:'POST',headers:{'Content-Type':'application/json','X-ERP-Request':'1'},
   body:JSON.stringify({username:'demo-admin-test',name:'Demo Admin Test',password:'isolated-demo-test-123',demo:true})
  });
  assert.equal(response.status,201);
  assert.equal((await response.json()).user.role,'admin');
  assert.deepEqual(seedDemo(app.store,app.erp,actor).counts,before.counts);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS count FROM users').get().count,1);
 } finally {await app.close();}
});
