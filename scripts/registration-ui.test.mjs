import {expectedPreservedSource} from './preserved-erp-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {routePermission,permitted} from '../src/auth/access.ts';

test('registration routes require separate permissions without granting finance',()=>{
 const expected={submissions:'submissions.view',buyers:'buyers.view',visitors:'visitors.view','registration-controls':'registrations.configure','registration-delivery':'registrations.deliveries'};
 const buyer={permissions:{'buyers.view':{allowed:true}}};
 for(const [route,permission] of Object.entries(expected))assert.equal(routePermission('/'+route),permission);
 assert.equal(permitted(buyer,routePermission('/buyers')),true);assert.equal(permitted(buyer,routePermission('/finance')),false);assert.equal(permitted(buyer,routePermission('/submissions')),false);
});
test('all Phase 3 ERP business pages, CSS and shared primitives remain byte-equivalent',()=>{
 const baseline='5e904496db219a467a8ec6eec92883aea174aa0b';
 const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.startsWith('src/pages/')||p.startsWith('src/components/ui/')||p.startsWith('src/components/layout/')&&!p.endsWith('/Sidebar.tsx')||p.endsWith('.css'));
 for(const p of paths)assert.equal(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n'),expectedPreservedSource(p,execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'}).replaceAll('\r\n','\n')),p);
});
test('new ERP pages use native primitives and never import public website styles or sessions',()=>{
 for(const p of ['RegistrationWorkspace','RegistrationControls']){const source=fs.readFileSync('src/pages/'+p+'.tsx','utf8');assert.match(source,/@\/components\/ui\/card/);assert.match(source,/@\/contexts\/AuthContext/);assert.doesNotMatch(source,/import\s+['"][^'"]+\.css|INTAKE_SERVICE_KEY|CMS_GATEWAY_KEY|localStorage.*token/);}
});
test('transport contract keeps public intake separate from CMS and financial domains',()=>{
 const c=JSON.parse(fs.readFileSync('backend/config/intake-contract.json','utf8'));assert.equal(c.version,1);assert.equal(c.transport,'SPACE-INTAKE-V1');assert.ok(c.types.includes('speaker'));assert.ok(c.types.includes('buyer'));assert.equal(c.ownership.processing,'erp');
 assert.ok(!c.statuses.buyers.includes('hosted'));assert.ok(!c.statuses.visitors.includes('attended'));
});
