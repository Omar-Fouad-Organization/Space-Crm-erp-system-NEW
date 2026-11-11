import test from 'node:test';
import assert from 'node:assert/strict';
import {dealRelations} from '../src/lib/dealRelations.ts';

test('deal display uses the actual irregular schedule and preserves zero commission',()=>{
  const schedule=[{id:91,deal_id:7,name:'Negotiated deposit',amount:'123.45',due_date:'2027-04-02',status:'paid'},{id:92,deal_id:7,name:'Final balance',amount:'876.55',due_date:'2027-05-17',status:'pending'}];
  const commissions=[{id:23,deal_id:7,amount:'0.00',status:'pending'}];
  assert.deepEqual(dealRelations('7',{payment_schedules:schedule,commissions}),{schedules:schedule,commissions,documents:null,booth:null});
});
test('redacted and empty relations never fabricate installments or unauthorized amounts',()=>{
  assert.equal(dealRelations('7',{}).schedules,null);
  assert.deepEqual(dealRelations('7',{payment_schedules:[]}).schedules,[]);
  assert.deepEqual(dealRelations('7',{payment_schedules:[{deal_id:8,amount:'9000'},{deal_id:7,id:1}]}).schedules,[{deal_id:7,id:1}]);
});

test('missing document relations never synthesize sample proposal or contract files',()=>{assert.equal(dealRelations('7',{}).documents,null);assert.deepEqual(dealRelations('7',{documents:[]}).documents,[]);assert.deepEqual(dealRelations('7',{documents:[{id:2,deal_id:7,name:'Verified attachment record'}]}).documents,[{id:2,deal_id:7,name:'Verified attachment record'}]);});
