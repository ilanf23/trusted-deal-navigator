import { useState, useRef, useCallback } from 'react';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useDropboxConnection } from '@/hooks/useDropboxConnection';
import {
  useDropboxList,
  useDropboxUpload,
  useDropboxCreateFolder,
  useDropboxDelete,
  useDropboxMove,
  useDropboxGetLink,
  useDropboxSync,
  type DropboxEntry,
} from '@/hooks/useDropbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  Folder,
  FileText,
  Upload,
  FolderPlus,
  RefreshCw,
  Trash2,
  Download,
  Pencil,
  ArrowRight,
  ChevronRight,
  Home,
  Loader2,
  Search,
  Unplug,
  FileSpreadsheet,
  Image,
  File,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return Image;
  return File;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropboxBrowser() {
  const { isOwner } = useTeamMember();
  const {
    isConnected,
    connectedEmail,
    connectedBy,
    loading: connectionLoading,
    connect,
    disconnect,
  } = useDropboxConnection();

  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DropboxEntry | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DropboxEntry | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<DropboxEntry | null>(null);
  const [moveDestination, setMoveDestination] = useState('');

  const { data: listData, isLoading: listLoading, refetch } = useDropboxList(currentPath);
  const uploadMutation = useDropboxUpload();
  const createFolderMutation = useDropboxCreateFolder();
  const deleteMutation = useDropboxDelete();
  const moveMutation = useDropboxMove();
  const getLinkMutation = useDropboxGetLink();
  const syncMutation = useDropboxSync();

  const entries = listData?.entries || [];

  // Sort: folders first, then files alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a['.tag'] === 'folder' && b['.tag'] !== 'folder') return -1;
    if (a['.tag'] !== 'folder' && b['.tag'] === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  const filteredEntries = searchQuery
    ? sortedEntries.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedEntries;

  // Breadcrumb parts
  const pathParts = currentPath
    .split('/')
    .filter(Boolean)
    .map((part, idx, arr) => ({
      name: part,
      path: '/' + arr.slice(0, idx + 1).join('/'),
    }));

  const navigateToFolder = (path: string) => {
    setCurrentPath(path);
    setSearchQuery('');
  };

  const handleEntryClick = (entry: DropboxEntry) => {
    if (entry['.tag'] === 'folder') {
      navigateToFolder(entry.path_lower);
    }
  };

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        await uploadMutation.mutateAsync({ path: currentPath, file });
      }
      refetch();
    },
    [currentPath, uploadMutation, refetch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = currentPath ? `${currentPath}/${newFolderName.trim()}` : `/${newFolderName.trim()}`;
    await createFolderMutation.mutateAsync({ path });
    setNewFolderOpen(false);
    setNewFolderName('');
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync({ path: deleteTarget.path_lower });
    setDeleteTarget(null);
    refetch();
  };

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    const parentPath = renameTarget.path_lower.substring(0, renameTarget.path_lower.lastIndexOf('/'));
    const newPath = `${parentPath}/${renameName.trim()}`;
    await moveMutation.mutateAsync({ from_path: renameTarget.path_lower, to_path: newPath });
    setRenameOpen(false);
    setRenameTarget(null);
    refetch();
  };

  const handleMove = async () => {
    if (!moveTarget || !moveDestination.trim()) return;
    const dest = moveDestination.startsWith('/') ? moveDestination : `/${moveDestination}`;
    const newPath = `${dest}/${moveTarget.name}`;
    await moveMutation.mutateAsync({ from_path: moveTarget.path_lower, to_path: newPath });
    setMoveOpen(false);
    setMoveTarget(null);
    setMoveDestination('');
    refetch();
  };

  const handleDownload = async (entry: DropboxEntry) => {
    try {
      const data = await getLinkMutation.mutateAsync({ path: entry.path_lower });
      if (data.link) {
        window.open(data.link, '_blank');
      }
    } catch {
      // toast handled by mutation
    }
  };

  const handleSync = (mode: 'full-sync' | 'incremental-sync') => {
    syncMutation.mutate({ mode });
  };

  // Not connected state
  if (connectionLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-6 max-w-lg mx-auto">
        <HardDrive className="h-16 w-16 text-muted-foreground/50" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Connect Dropbox</h2>
          <p className="text-muted-foreground">
            Connect your company Dropbox account to browse, upload, and manage files directly from this dashboard.
          </p>
        </div>
        <Button onClick={connect} size="lg">
          <HardDrive className="mr-2 h-4 w-4" />
          Connect Dropbox
        </Button>
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-4 w-full">
          <p className="font-medium">First-time setup (one-time, by a developer):</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Create an app at <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">dropbox.com/developers/apps</a></li>
            <li>Set redirect URI to: <code className="bg-muted px-1 rounded">{window.location.origin}/admin/dropbox/callback</code></li>
            <li>Add <code className="bg-muted px-1 rounded">DROPBOX_APP_KEY</code> and <code className="bg-muted px-1 rounded">DROPBOX_APP_SECRET</code> to Supabase edge function secrets</li>
            <li>Run the SQL migration: <code className="bg-muted px-1 rounded">supabase/migrations/20260304_dropbox_tables.sql</code></li>
          </ol>
          <p className="pt-1">Once set up, anyone on the team can click Connect above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-semibold">Dropbox</h1>
            <p className="text-xs text-muted-foreground">
              {connectedEmail} {connectedBy && `(connected by ${connectedBy})`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync('incremental-sync')}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', syncMutation.isPending && 'animate-spin')} />
            Sync
          </Button>
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={disconnect}>
              <Unplug className="h-3.5 w-3.5 mr-1.5" />
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 text-sm">
          <button
            onClick={() => navigateToFolder('')}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
          >
            <Home className="h-3.5 w-3.5" />
          </button>
          {pathParts.map((part) => (
            <span key={part.path} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <button
                onClick={() => navigateToFolder(part.path)}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
              >
                {part.name}
              </button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setNewFolderName('');
            setNewFolderOpen(true);
          }}
        >
          <FolderPlus className="h-3 w-3 mr-1" />
          New Folder
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleUpload(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* File List */}
      <div
        className={cn(
          'flex-1 overflow-auto',
          dragOver && 'bg-primary/5 ring-2 ring-primary/20 ring-inset'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {listLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Folder className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">
              {searchQuery ? 'No files match your search' : 'This folder is empty'}
            </p>
            <p className="text-xs mt-1">Drag & drop files here to upload</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredEntries.map((entry) => {
              const isFolder = entry['.tag'] === 'folder';
              const Icon = isFolder ? Folder : getFileIcon(entry.name);

              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors group',
                    isFolder && 'cursor-pointer'
                  )}
                  onClick={() => handleEntryClick(entry)}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isFolder ? 'text-blue-500' : 'text-muted-foreground'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{entry.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {!isFolder && entry.size !== undefined && (
                        <span>{formatFileSize(entry.size)}</span>
                      )}
                      {entry.server_modified && (
                        <span>
                          {formatDistanceToNow(new Date(entry.server_modified), { addSuffix: true })}
                        </span>
                      )}
                      {entry.lead_name && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {entry.lead_name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isFolder && (
                          <DropdownMenuItem onClick={() => handleDownload(entry)}>
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(entry);
                            setRenameName(entry.name);
                            setRenameOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMoveTarget(entry);
                            setMoveDestination('');
                            setMoveOpen(true);
                          }}
                        >
                          <ArrowRight className="h-3.5 w-3.5 mr-2" />
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload overlay when dragging */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg p-8">
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-primary font-medium">Drop files to upload</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {uploadMutation.isPending && (
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading...
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="New name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || moveMutation.isPending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Move "{moveTarget?.name}"</DialogTitle>
          </DialogHeader>
          <Input
            value={moveDestination}
            onChange={(e) => setMoveDestination(e.target.value)}
            placeholder="/destination/path"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleMove()}
          />
          <p className="text-xs text-muted-foreground">
            Enter the destination folder path (e.g., /Documents/Deals)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={!moveDestination.trim() || moveMutation.isPending}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the {deleteTarget?.['.tag'] === 'folder' ? 'folder and all its contents' : 'file'} from Dropbox. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
