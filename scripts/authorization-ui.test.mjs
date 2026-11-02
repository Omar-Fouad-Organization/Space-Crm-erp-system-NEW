import test from 'node:test';
import assert from 'node:assert/strict';
import {permitted, routePermission, workflowPermissions, exportSource} from '../src/auth/access.ts';

test('module navigation and direct details share the same server capability', () => {
  const routes={clients:'clients.view',deals:'deals.view',expos:'exhibitions.view',finance:'finance.view',commissions:'commissions.view',users:'users.manage',hr:'employees.view',contracts:'documents.view',advanced:'advanced.view'};
  for(const [route,permission] of Object.entries(routes)) {
    assert.equal(routePermission('/'+route),permission);
    assert.equal(routePermission('/'+route+'/123'),permission);
    assert.equal(permitted({permissions:{[permission]:{allowed:false,source:'denied'}}},permission),false);
    assert.equal(permitted({permissions:{[permission]:{allowed:true,source:'granted'}}},permission),true);
  }
});
test('unknown permissions and incomplete contracts never grant authority', () => {
  assert.equal(permitted(null,'users.manage'),false);
  assert.equal(permitted({permissions:{}},'website.edit'),false);
  assert.equal(permitted({permissions:{'users.manage':{allowed:'true'}}},'users.manage'),false);
});
test('workflow sections use distinct current permissions and reserve no fake pages', () => {
  assert.equal(workflowPermissions.collections,'collections.view');
  assert.equal(workflowPermissions.approvals,'workflow.view');
  assert.equal(workflowPermissions.access,'permissions.manage');
  assert.equal(workflowPermissions.security,null);
  for(const reserved of ['website','content','seo','media','buyers','visitors','hosted_buyers','matchmaking']) assert.equal(workflowPermissions[reserved],undefined);
});
test('managed exports map existing CSV names to exact server operations', () => {
  for(const name of ['dashboard','collections']) assert.deepEqual(exportSource(name),{report:name});
  assert.deepEqual(exportSource('finance-receipts'),{report:'finance'});
  assert.deepEqual(exportSource('exhibition-profitability'),{report:'profitability'});
  assert.deepEqual(exportSource('pipeline-analytics'),{report:'pipeline'});
  assert.deepEqual(exportSource('installment-register'),{resource:'payment_schedules'});
  assert.deepEqual(exportSource('commission-register'),{resource:'commissions'});
  assert.deepEqual(exportSource('clients'),{resource:'clients'});
});
