import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cmsResource,cmsSections,createCmsClient,publicCmsUrl} from '../src/cms/client.ts';
import {routePermission} from '../src/auth/access.ts';

const site={slug:'green-life-expo',name:'Green Life Expo',exhibition_id:7001,public_origin:'https://public.example.test'};
const id='01900000-0000-7000-8000-000000000001';
const version=letter=>letter.repeat(64);

test('CMS route and resource mappings exclude submissions, staff and ERP business tables',()=>{
  assert.equal(routePermission('/website/blogs'),'website.view');
  assert.equal(cmsResource('language','site_settings'),'language');
  assert.equal(cmsResource('language','translations'),'translations');
  assert.equal(cmsResource('photos','photos'),'media');
  for(const table of ['contact_submissions','visitor_registrations','users','admin_users','payments'])assert.throws(()=>cmsResource('settings',table));
  assert.throws(()=>cmsResource('settings','blogs'));
  assert.equal(Object.keys(cmsSections).length,13);
});

test('pagination loads all authorized rows and never sends arbitrary columns or URLs',async()=>{
  const calls=[];
  const client=createCmsClient(async(path,method,body)=>{calls.push({path,method,body});return {data:body.offset===0?[{id:'a',_version:version('a')},{id:'b',_version:version('b')}]:[{id:'c',_version:version('c')}],count:3};},site,'blogs');
  const result=await client.from('blogs').select('title').order('created_at',{ascending:false});
  assert.equal(result.error,null);assert.equal(result.data.length,3);assert.equal(calls[1].body.offset,2);
  assert.equal(calls[0].body.columns,undefined);assert.equal(calls[0].body.url,undefined);
  assert.equal(calls[0].path,'website-cms/green-life-expo/resources/blogs');
});

test('oversized read pages shrink predictably and cannot retry without a bound',async()=>{
  const sizes=[];
  const client=createCmsClient(async(_path,_method,body)=>{sizes.push(body.limit);if(body.limit>1)throw Object.assign(new Error('Too large'),{status:413});return {data:[],count:0};},site,'blogs');
  assert.equal((await client.from('blogs').select()).error,null);
  assert.deepEqual(sizes,[20,10,5,2,1]);
});

test('same-record autosaves serialize and use the version returned by the preceding save',async()=>{
  let current=version('a'),active=0,peak=0;const expected=[];
  const client=createCmsClient(async(_path,_method,body)=>{
    if(body.operation==='list')return {data:[{id,english_text:'Original',_version:current}],count:1};
    active++;peak=Math.max(peak,active);expected.push(body.expected_version);await Promise.resolve();
    current=expected.length===1?version('b'):version('c');active--;
    return {data:[{id,...body.records,_version:current}]};
  },site,'language');
  await client.from('translations').select();
  const results=await Promise.all([client.from('translations').update({english_text:'First'}).eq('id',id),client.from('translations').update({arabic_text:'العربية'}).eq('id',id)]);
  assert.ok(results.every(result=>result.error===null));assert.equal(peak,1);assert.deepEqual(expected,[version('a'),version('b')]);
});

test('conflicts preserve an error state and prevent a blind repeated write',async()=>{
  let writes=0;
  const client=createCmsClient(async(_path,_method,body)=>{if(body.operation==='list')return {data:[{id,_version:version('a')}],count:1};writes++;throw Object.assign(new Error('Reload before saving'),{status:409});},site,'blogs');
  await client.from('blogs').select();
  assert.equal((await client.from('blogs').update({title:'Change'}).eq('id',id)).error.status,409);
  assert.equal((await client.from('blogs').update({title:'Retry'}).eq('id',id)).error.status,409);
  assert.equal(writes,1);
});

test('creating a new record never reuses an unrelated cached row version',async()=>{
  let createBody;
  const client=createCmsClient(async(_path,_method,body)=>{if(body.operation==='list')return {data:[{id,slug:'existing',_version:version('a')}],count:1};createBody=body;return {data:[{id:'new',_version:version('b'),...body.records}]};},site,'blogs');
  await client.from('blogs').select();
  assert.equal((await client.from('blogs').insert([{title:'New',slug:'new',content:'Draft',is_published:false}])).error,null);
  assert.equal(createBody.expected_version,null);
});

test('historical relative image URLs are displayed against the website and preserved on unchanged saves',async()=>{
  let saved;
  const client=createCmsClient(async(_path,_method,body)=>{if(body.operation==='list')return {data:[{id,photo_name:'Original',photo_url:'/storage/premium_photos/original.png',_version:version('a')}],count:1};saved=body.records;return {data:[{id,...body.records,_version:version('b')}]};},site,'photos');
  const rows=await client.from('photos').select();
  assert.equal(rows.data[0].photo_url,'https://public.example.test/storage/premium_photos/original.png');
  await client.from('photos').update({...rows.data[0],photo_name:'Renamed'}).eq('id',id);
  assert.equal(saved.photo_url,'/storage/premium_photos/original.png');assert.equal(saved.id,undefined);assert.equal(saved._version,undefined);
  assert.equal(publicCmsUrl(site.public_origin,'https://cdn.example.test/photo.png'),'https://cdn.example.test/photo.png');
});

test('website editors reuse ERP primitives without importing website providers or global CSS',()=>{
  const provenance=JSON.parse(fs.readFileSync('src/cms/editors/provenance.json','utf8'));
  assert.equal(provenance.editors.length,12);
  for(const editor of provenance.editors){const text=fs.readFileSync(editor.file,'utf8');assert.doesNotMatch(text,/components\/admin\/|contexts\/(Language|SEO)Context|document\.(head|title|documentElement)|import\s+['"][^'"]+\.css/);}
  const context=fs.readFileSync('src/cms/context.tsx','utf8');assert.match(context,/sandbox=""/);assert.doesNotMatch(context,/allow-same-origin/);
});

test('every original ERP business page, layout and design-system file remains unchanged',()=>{
  const baseline='80f37386ae1f8066f7c621d7d7609542a0d0d83e';
  const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(path=>path.startsWith('src/pages/')||path.startsWith('src/components/ui/')||path.startsWith('src/components/layout/')&&!path.endsWith('/Sidebar.tsx')||/\.css$/.test(path));
  for(const path of paths){const before=execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');assert.equal(fs.readFileSync(path,'utf8').replaceAll('\r\n','\n'),before,'Locked ERP visual source changed: '+path);}
  for(const file of ['Dashboard','Clients','Expos','DealsPage','FinancePage','UsersPage'])assert.ok(paths.includes('src/pages/'+file+'.tsx'));
});


test('unchanged fields do not generate writes or conflict with unrelated editor saves',async()=>{
  let writes=0;
  const client=createCmsClient(async(_path,_method,body)=>{if(body.operation==='list')return {data:[{id,content_value:'Original',_version:version('a')}],count:1};writes++;throw new Error('Unexpected write');},site,'content');
  await client.from('page_content').select();
  const result=await client.from('page_content').update({content_value:'Original'}).eq('id',id);
  assert.equal(result.error,null);assert.equal(writes,0);
});

test('general settings retain their resource-specific versions and authorization boundary',async()=>{
  let savedPath;
  const client=createCmsClient(async(path,_method,body)=>{
    if(body.operation==='list')return path.endsWith('/branding')?{data:[{id,setting_key:'logo_alt_text',setting_value:'Original alt',_version:version('a')}],count:1}:{data:[],count:0};
    savedPath=path;assert.equal(body.expected_version,version('a'));return {data:[{id,...body.records,_version:version('b')}]};
  },site,'settings',()=>{},['settings','branding']);
  const rows=await client.from('site_settings').select();assert.equal(rows.data.length,1);
  assert.equal((await client.from('site_settings').update({setting_value:'Reviewed alt'}).eq('id',id)).error,null);
  assert.ok(savedPath.endsWith('/branding'));
});


test('location saves preserve existing shared-setting metadata',async()=>{
  let saved;
  const client=createCmsClient(async(_path,_method,body)=>{if(body.operation==='list')return {data:[{id,setting_key:'contact_address',setting_value:'Original',category:'contact',setting_type:'text',description:'Contact address',_version:version('a')}],count:1};saved=body.records;return {data:[{id,...body.records,_version:version('b')}]};},site,'location');
  await client.from('site_settings').select();
  assert.equal((await client.from('site_settings').upsert({setting_key:'contact_address',setting_value:'Reviewed address',category:'location',description:'Generated label',setting_type:'text'},{onConflict:'setting_key'})).error,null);
  assert.equal(saved.category,'contact');assert.equal(saved.description,'Contact address');assert.equal(saved.setting_value,'Reviewed address');
});
