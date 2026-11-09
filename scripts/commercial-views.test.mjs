import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {linkedBoothDeal,moneyGroups,totalsLabel,exhibitionProjection,dashboardProjection,dashboardRecords,metricLabel} from '../src/lib/commercialViews.ts';
test('a cancelled historical booth deal cannot replace the live client relationship',()=>{
 const rows=[{id:1,booth_id:'9',stage:'canceled',client_id:71},{id:2,booth_id:'9',stage:'closed_won',client_id:72},{id:3,booth_id:'10',stage:'talking',client_id:73}];
 assert.equal(linkedBoothDeal({id:9},rows).client_id,72);assert.equal(linkedBoothDeal({id:11},rows),undefined);
});
test('exhibition revenue preserves currency groups and distinct booth/sponsor organizations',()=>{
 const deals=[{id:1,exhibition_id:5,stage:'closed_won',deal_type:'booth',client_id:7,deal_value:1000,currency:'EGP'},{id:2,exhibition_id:5,stage:'closed_won',deal_type:'booth',client_id:7,deal_value:123.45,currency:'USD'},{id:3,exhibition_id:5,stage:'closed_won',deal_type:'sponsorship',client_id:8,deal_value:50,currency:'USD'},{id:4,exhibition_id:6,stage:'closed_won',client_id:9,deal_value:9999,currency:'USD'}];
 const result=exhibitionProjection({id:'5'},[{exhibition_id:5,status:'Sold'},{exhibition_id:6,status:'Reserved'}],deals);
 assert.deepEqual(result.totalRevenue,{EGP:1000,USD:173.45});assert.equal(result.exhibitors,1);assert.equal(result.sponsors,1);assert.equal(result.bookedBooths,1);
 assert.match(totalsLabel(result.totalRevenue),/EGP/);assert.match(totalsLabel(result.totalRevenue),/\$173\.45/);
});
test('redacted money and unrecorded analytics never become invented zero totals',()=>{
 assert.equal(moneyGroups([{currency:'USD'}]),null);assert.equal(totalsLabel(null),'Not available');assert.equal(metricLabel(undefined),'Not recorded');assert.equal(metricLabel(0),'0');assert.equal(metricLabel(null,'/5.0'),'Not recorded');
});
test('cash trend includes current receipts and corrections for an older deal and excludes other events/currencies',()=>{
 const raw={meta:{settings:{currency:'EGP'}},deals:[{id:'1',exhibition_id:'2',created_at:'2020-01-01',stage:'closed_won',deal_value:100,currency:'EGP'},{id:'2',exhibition_id:'3',created_at:'2026-11-01',stage:'talking',deal_value:800,currency:'USD'}],payments:[{deal_id:'1',paid_date:'2026-11-02',amount:'100.25',currency:'EGP'},{deal_id:'1',paid_date:'2026-11-03',amount:'-10.25',currency:'EGP'},{deal_id:'2',paid_date:'2026-11-03',amount:'900',currency:'USD'}]};
 const result=dashboardProjection(raw,'2','2026-10-01');assert.equal(result.deals.length,0);assert.deepEqual(result.revenueData,[{month:'2026-11',revenue:90,deals:0}]);
});
test('a payment reader without finance report capability still loads the nonfinancial dashboard',async()=>{
 const calls=[];const meta={resources:{deals:{},clients:{},payments:{}},authorization:{permissions:{'finance.view':{allowed:false}}}};
 const data=await dashboardRecords(meta,async name=>{calls.push(name);return [{id:1}];},async()=>{throw Error('Forbidden finance request');});
 assert.equal(data.deals.length,1);assert.deepEqual(calls,['deals','clients']);assert.equal(data.canCash,false);
});
import fs from 'node:fs';
test('active commercial detail and dashboard routes consume the corrected projections',()=>{
 assert.match(fs.readFileSync('src/pages/BoothDetail.tsx','utf8'),/linkedBoothDeal/);
 assert.match(fs.readFileSync('src/pages/ExpoDetail.tsx','utf8'),/exhibitionProjection/);
 assert.match(fs.readFileSync('src/pages/Dashboard.tsx','utf8'),/dashboardRecords/);
 for(const p of ['BoothDetail','ExpoDetail'])assert.doesNotMatch(fs.readFileSync('src/pages/'+p+'.tsx','utf8'),/currency: 'USD'/);
});

test('commercial projection repairs preserve original classes and field structure',()=>{
 for(const name of ['Dashboard','BoothDetail','ExpoDetail','Sponsorship']){const path='src/pages/'+name+'.tsx';const before=execFileSync('git',['show','8533075f5c759eb1b531ecd9b7211c1141415ffc:'+path],{encoding:'utf8'});assert.deepEqual(fs.readFileSync(path,'utf8').match(/className="[^"]*"/g),before.match(/className="[^"]*"/g),path);}
});
