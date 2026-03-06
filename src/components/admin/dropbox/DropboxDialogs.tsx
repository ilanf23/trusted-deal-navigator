import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DropboxEntry } from '@/hooks/useDropbox';

interface DropboxDialogsProps {
  newFolderOpen: boolean;
  onNewFolderOpenChange: (open: boolean) => void;
  newFolderName: string;
  onNewFolderNameChange: (name: string) => void;
  onCreateFolder: () => void;
  createFolderPending: boolean;

  renameOpen: boolean;
  onRenameOpenChange: (open: boolean) => void;
  renameName: string;
  onRenameNameChange: (name: string) => void;
  onRename: () => void;
  renamePending: boolean;

  moveOpen: boolean;
  onMoveOpenChange: (open: boolean) => void;
  moveTarget: DropboxEntry | null;
  moveDestination: string;
  onMoveDestinationChange: (dest: string) => void;
  onMove: () => void;
  movePending: boolean;

  deleteTarget: DropboxEntry | null;
  onDeleteTargetChange: (target: DropboxEntry | null) => void;
  onDelete: () => void;
}

export function DropboxDialogs({
  newFolderOpen, onNewFolderOpenChange, newFolderName, onNewFolderNameChange, onCreateFolder, createFolderPending,
  renameOpen, onRenameOpenChange, renameName, onRenameNameChange, onRename, renamePending,
  moveOpen, onMoveOpenChange, moveTarget, moveDestination, onMoveDestinationChange, onMove, movePending,
  deleteTarget, onDeleteTargetChange, onDelete,
}: DropboxDialogsProps) {
  return (
    <>
      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={onNewFolderOpenChange}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onNewFolderOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateFolder} disabled={!newFolderName.trim() || createFolderPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={onRenameOpenChange}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => onRenameNameChange(e.target.value)}
            placeholder="New name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onRenameOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onRename} disabled={!renameName.trim() || renamePending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={onMoveOpenChange}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Move &ldquo;{moveTarget?.name}&rdquo;</DialogTitle>
          </DialogHeader>
          <Input
            value={moveDestination}
            onChange={(e) => onMoveDestinationChange(e.target.value)}
            placeholder="/destination/path"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onMove()}
          />
          <p className="text-xs text-muted-foreground">
            Enter the destination folder path (e.g., /Documents/Deals)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onMoveOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onMove} disabled={!moveDestination.trim() || movePending}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && onDeleteTargetChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the {deleteTarget?.['.tag'] === 'folder' ? 'folder and all its contents' : 'file'} from Dropbox. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
