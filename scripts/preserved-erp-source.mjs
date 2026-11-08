// Phase 6.3 permits only removal of the exact redundant edit-dialog mount.
// Every other byte of each locked business page/layout remains protected.
export function expectedPreservedSource(path, before) {
  return path === 'src/pages/BoothsPage.tsx' ? before.replace("        <EditBoothDialog\n          isOpen={editDialogOpen}\n          onClose={() => setEditDialogOpen(false)}\n          onSuccess={loadBooths}\n          booth={selectedBooth}\n        />\n\n", '') : before;
}
