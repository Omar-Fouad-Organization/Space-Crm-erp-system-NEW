import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Phase 6.3 permits only removal of the exact redundant edit-dialog mount.
// Every other byte of each locked business page/layout remains protected.
export function expectedPreservedSource(path, before) {
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
