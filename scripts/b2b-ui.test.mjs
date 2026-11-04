import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankProfile,splitTerms,eventTime,criteria,requirementAnswer} from '../src/b2b/forms.ts';
import {routePermission} from '../src/auth/access.ts';

test('B2B direct routes require their own scoped server capability',()=>{
 for(const [section,permission] of Object.entries({overview:'b2b.view',profiles:'b2b.view',qualification:'b2b.qualifications.review',matches:'b2b.matches.view',scheduler:'b2b.meetings.view',results:'b2b.results.view'})) assert.equal(routePermission('/b2b/'+section),permission);
});
test('new business profiles never invent capacity, certification or purchasing facts',()=>{
 const a=blankProfile(), b=blankProfile();
 assert.equal(a.capacity_verified,false); assert.equal(a.capacity,null); assert.equal(a.quantity,null);
 assert.deepEqual(a.certifications,[]); assert.deepEqual(a.products,[]); assert.deepEqual(a.categories,[]);
 a.categories.push(1); assert.deepEqual(b.categories,[]); assert.equal(criteria.length,6);
});
test('structured terms preserve Arabic and deterministic matching inputs',()=>{
 assert.deepEqual(splitTerms(' herbs, أعشاب, , packaging '),['herbs','أعشاب','packaging']);
 assert.match(eventTime('2027-01-01 10:00:00','Africa/Cairo'),/12:00/);
 assert.equal(eventTime('2027-01-01T10:00:00Z','Africa/Cairo'),eventTime('2027-01-01 10:00:00','Africa/Cairo'));
});
test('Phase 5 uses existing ERP components and never imports a replacement design system',()=>{
 const s=fs.readFileSync(new URL('../src/pages/B2BWorkspace.tsx',import.meta.url),'utf8');
 for(const component of ['card','table','input','button','dialog','select']) assert.ok(s.includes("@/components/ui/"+component));
 assert.ok(!/\.css['"]|@mui|antd|chakra/.test(s));
 assert.ok(s.includes('not configured')); assert.ok(s.includes('Record verified acceptance'));
});

test('requirement presentation distinguishes unanswered, supplied, explicitly unknown and no restriction',()=>{
 const p=blankProfile();assert.equal(requirementAnswer(p,'origin'),'unknown');p.preferred_origins=['Egypt'];assert.equal(requirementAnswer(p,'origin'),'applicable');p.requirement_states={origin:'unknown'};assert.equal(requirementAnswer(p,'origin'),'unknown');p.preferred_origins=[];p.requirement_states.origin='not_applicable';assert.equal(requirementAnswer(p,'origin'),'not_applicable');
});
