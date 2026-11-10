import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Phase 6.3 permits only removal of the exact redundant edit-dialog mount.
// Every other byte of each locked business page/layout remains protected.
export function expectedPreservedSource(path, before) {
  // Phase 9 adds only authorized source navigation and capability-safe loading.
  if(path==='src/pages/TasksPage.tsx'){const current=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(current).digest('hex'),'3d4df89222e89592f68e60879c46e479ab878f27a477fe38de848f37dd4efcc2','Unreviewed task integration change');return current;}
  const phase8={"src/pages/Dashboard.tsx":"a57ea24d16b53896e1062d021b5000c6b196ceddaab2ff2aaa3826255a0ae2b7","src/pages/BoothDetail.tsx":"33b67ef316d492e642275f81e75a74b961c2b9f6038ed18f0fa243a1f60f4987","src/pages/ExpoDetail.tsx":"bc935962879579ca70525fa662b675e23b0f08751d952fe5490f0a1684412c29","src/pages/Sponsorship.tsx":"9467d1cfe884162662c8361300c7c006ef0002c3062630a1481405ba6a57300f"};
  if (phase8[path]) {
    const current=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(current).digest('hex'),phase8[path],'Unreviewed commercial projection source change');
    return current;
  }
  // Reviewed functional correction: existing deal cards now bind server relations.
  // Freeze this approved source; all other protected pages retain original byte checks.
  if (path === 'src/pages/DealDetailPage.tsx') {
    const current=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(current).digest('hex'),'a9e4131f694b4e8b1908962839aee8da186f1cc371b912c6530d69beb507871d','Unreviewed deal layout/source change');
    return current;
  }
  if (path === 'src/pages/ClientDetails.tsx') {
    const current=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(current).digest('hex'),'91797f68ecd39847c01e1726cd090dae1a49cc72787ce15d248b8608d5a2ee7a','Unreviewed client layout/source change');
    return current;
  }
  return path === 'src/pages/BoothsPage.tsx' ? before.replace("        <EditBoothDialog\n          isOpen={editDialogOpen}\n          onClose={() => setEditDialogOpen(false)}\n          onSuccess={loadBooths}\n          booth={selectedBooth}\n        />\n\n", '') : before;
}
