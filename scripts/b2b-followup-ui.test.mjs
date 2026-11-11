import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
test('follow-up creation reuses the task dialog and is an explicit action without copied B2B secrets',()=>{
 const text=fs.readFileSync('src/b2b/FollowupTask.tsx','utf8');assert.match(text,/components\/tasks\/CreateTaskDialog/);assert.match(text,/Create Follow-up Task/);assert.doesNotMatch(text,/useEffect|localStorage|qualification|consent_evidence|source_hash|buyer_organization/);assert.match(text,/status:'pending'/);assert.match(text,/description:''/);assert.match(text,/task.status/);assert.match(text,/Linked task unavailable for your permissions/);
});
test('task context keeps explicit owner/date and exact existing route navigation',()=>{
 const dialog=fs.readFileSync('src/components/tasks/CreateTaskDialog.tsx','utf8'),tasks=fs.readFileSync('src/pages/TasksPage.tsx','utf8'),operations=fs.readFileSync('src/b2b/OnsiteOperations.tsx','utf8');
 assert.match(dialog,/assigned_user_id: ''/);assert.match(dialog,/due_date: undefined/);assert.match(dialog,/format\(values.due_date,'yyyy-MM-dd'\)/);assert.match(dialog,/exhibition_id:followup.exhibition_id/);assert.match(tasks,/m.resources\[r\]\?apiAll\(r\)/);assert.match(tasks,/task.b2b_source/);assert.match(tasks,/taskQuery.get\('task'\)/);assert.match(operations,/meeting_id/);assert.match(operations,/row.status==='completed'&&<FollowupTask/);
});
test('existing light ERP layouts and task fields retain every class attribute',()=>{
 for(const path of ['src/pages/TasksPage.tsx','src/pages/B2BWorkspace.tsx','src/b2b/OnsiteOperations.tsx','src/components/tasks/CreateTaskDialog.tsx']){const before=execFileSync('git',['show','069f26e54de947bab246a6bcedf57f2fdc4f63aa:'+path],{encoding:'utf8'});assert.deepEqual(fs.readFileSync(path,'utf8').match(/className="[^"]*"/g),before.match(/className="[^"]*"/g),path);}
});
