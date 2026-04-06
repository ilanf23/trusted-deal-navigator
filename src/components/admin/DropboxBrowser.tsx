import { useState, useRef, useCallback } from 'react';
import { useDropboxConnection } from '@/hooks/useDropboxConnection';
import {
  useDropboxList,
  useDropboxUpload,
  useDropboxCreateFolder,
  useDropboxDelete,
  useDropboxMove,
  useDropboxGetLink,
  useDropboxSync,
  useDropboxPhotosFromDB,
  useDropboxShared,
  type DropboxEntry,
} from '@/hooks/useDropbox';
import { useDropboxStarred } from '@/components/admin/dropbox/useDropboxStarred';
import { Button } from '@/components/ui/button';
import { HardDrive, Loader2 } from 'lucide-react';
import { DropboxHeader } from './dropbox/DropboxHeader';
import { DropboxSidebar, type SidebarSection } from './dropbox/DropboxSidebar';
import { DropboxToolbar, type ViewMode, type ActiveTab, type SortField, type SortDirection } from './dropbox/DropboxToolbar';
import { DropboxFileList } from './dropbox/DropboxFileList';
import { DropboxPreviewPanel } from './dropbox/DropboxPreviewPanel';
import { DropboxDialogs } from './dropbox/DropboxDialogs';

export function DropboxBrowser() {
  const {
    isConnected,
    connectedEmail,
    connectedBy,
    loading: connectionLoading,
    connect,
    disconnect,
  } = useDropboxConnection();

  // Navigation state
  const [currentPath, setCurrentPath] = useState('');
  const [activeSection, setActiveSection] = useState<SidebarSection>('home');
  const [selectedEntry, setSelectedEntry] = useState<DropboxEntry | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Drag-drop state
  const [dragOver, setDragOver] = useState(false);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Inline rename state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DropboxEntry | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DropboxEntry | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<DropboxEntry | null>(null);
  const [moveDestination, setMoveDestination] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: listData, isLoading: listLoading, refetch } = useDropboxList(currentPath, isConnected);
  const uploadMutation = useDropboxUpload();
  const createFolderMutation = useDropboxCreateFolder();
  const deleteMutation = useDropboxDelete();
  const moveMutation = useDropboxMove();
  const getLinkMutation = useDropboxGetLink();
  const syncMutation = useDropboxSync();
  const { starredPaths, toggleStar, isStarred } = useDropboxStarred();

  // Photos section data
  const isPhotosSection = activeSection === 'photos';
  const { data: photosData, isLoading: photosLoading } = useDropboxPhotosFromDB(isPhotosSection && isConnected);

  // Shared section data
  const isSharedSection = activeSection === 'shared';
  const { data: sharedData, isLoading: sharedLoading } = useDropboxShared(isSharedSection && isConnected);

  const entries = isPhotosSection
    ? (photosData?.entries || [])
    : isSharedSection
    ? (sharedData?.entries || [])
    : (listData?.entries || []);

  // Starred entries for sidebar
  const starredEntries = (listData?.entries || []).filter((e) => isStarred(e.path_lower));

  // Breadcrumb parts
  const pathParts = currentPath
    .split('/')
    .filter(Boolean)
    .map((part, idx, arr) => ({
      name: part,
      path: '/' + arr.slice(0, idx + 1).join('/'),
    }));

  // Navigation
  const navigateToFolder = useCallback((path: string) => {
    setCurrentPath(path);
    setSearchQuery('');
    setSelectedEntry(null);
  }, []);

  const handleEntryClick = useCallback((entry: DropboxEntry) => {
    if (entry['.tag'] === 'folder') {
      navigateToFolder(entry.path_lower);
    } else {
      setSelectedEntry(entry);
    }
  }, [navigateToFolder]);

  // Upload
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

  // Folder operations
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = currentPath ? `${currentPath}/${newFolderName.trim()}` : `/${newFolderName.trim()}`;
    await createFolderMutation.mutateAsync({ path });
    setNewFolderOpen(false);
    setNewFolderName('');
    refetch();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync({ path: deleteTarget.path_lower });
    if (selectedEntry?.id === deleteTarget.id) setSelectedEntry(null);
    setDeleteTarget(null);
    refetch();
  };

  // Rename (dialog)
  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    const parentPath = renameTarget.path_lower.substring(0, renameTarget.path_lower.lastIndexOf('/'));
    const newPath = `${parentPath}/${renameName.trim()}`;
    await moveMutation.mutateAsync({ from_path: renameTarget.path_lower, to_path: newPath });
    setRenameOpen(false);
    setRenameTarget(null);
    refetch();
  };

  // Inline rename
  const handleStartEditing = useCallback((entry: DropboxEntry) => {
    setEditingEntryId(entry.id);
    setEditingName(entry.name);
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!editingEntryId || !editingName.trim()) return;
    const entry = entries.find((e) => e.id === editingEntryId);
    if (!entry) return;
    const parentPath = entry.path_lower.substring(0, entry.path_lower.lastIndexOf('/'));
    const newPath = `${parentPath}/${editingName.trim()}`;
    await moveMutation.mutateAsync({ from_path: entry.path_lower, to_path: newPath });
    setEditingEntryId(null);
    setEditingName('');
    refetch();
  }, [editingEntryId, editingName, entries, moveMutation, refetch]);

  const handleCancelEditing = useCallback(() => {
    setEditingEntryId(null);
    setEditingName('');
  }, []);

  // Move (dialog)
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

  // Download
  const handleDownload = useCallback(async (entry: DropboxEntry) => {
    try {
      const data = await getLinkMutation.mutateAsync({ path: entry.path_lower });
      if (data.link) {
        window.open(data.link, '_blank');
      }
    } catch {
      // toast handled by mutation
    }
  }, [getLinkMutation]);

  // Sort toggle
  const handleToggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDirection('asc');
      }
      return field;
    });
  }, []);

  // Internal drag-drop (file to folder)
  const handleEntryDragStart = useCallback((e: React.DragEvent, entry: DropboxEntry) => {
    setDraggingEntryId(entry.id);
    e.dataTransfer.setData('text/plain', entry.path_lower);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleEntryDragEnd = useCallback(() => {
    setDraggingEntryId(null);
    setDragOverFolderId(null);
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  }, []);

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverFolderId(null);
  }, []);

  const handleFolderDrop = useCallback(async (e: React.DragEvent, folderEntry: DropboxEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    const fromPath = e.dataTransfer.getData('text/plain');
    if (!fromPath || fromPath === folderEntry.path_lower) return;
    const fileName = fromPath.split('/').pop() || '';
    const toPath = `${folderEntry.path_lower}/${fileName}`;
    await moveMutation.mutateAsync({ from_path: fromPath, to_path: toPath });
    setDraggingEntryId(null);
    refetch();
  }, [moveMutation, refetch]);

  // Rename/Move/Delete triggers from file list
  const handleRenameClick = useCallback((entry: DropboxEntry) => {
    setRenameTarget(entry);
    setRenameName(entry.name);
    setRenameOpen(true);
  }, []);

  const handleMoveClick = useCallback((entry: DropboxEntry) => {
    setMoveTarget(entry);
    setMoveDestination('');
    setMoveOpen(true);
  }, []);

  const handleDeleteClick = useCallback((entry: DropboxEntry) => {
    setDeleteTarget(entry);
  }, []);

  // Starred entry click from sidebar
  const handleStarredEntryClick = useCallback((entry: DropboxEntry) => {
    if (entry['.tag'] === 'folder') {
      navigateToFolder(entry.path_lower);
    } else {
      setSelectedEntry(entry);
    }
  }, [navigateToFolder]);

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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-6">
        <div className="p-6 rounded-full bg-muted">
          <HardDrive className="h-16 w-16 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Connect Your Dropbox</h2>
          <p className="text-muted-foreground max-w-md">
            Connect your Dropbox account to browse, upload, and manage files directly from your dashboard.
          </p>
        </div>
        <Button onClick={connect} size="lg">
          <HardDrive className="mr-2 h-4 w-4" />
          Connect Dropbox
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <DropboxHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewFolder={() => {
          setNewFolderName('');
          setNewFolderOpen(true);
        }}
        onUploadFiles={() => fileInputRef.current?.click()}
        onUploadFolder={() => folderInputRef.current?.click()}
        connectedEmail={connectedEmail}
        onDisconnect={disconnect}
      />

      {/* Hidden file inputs */}
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
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is a non-standard attribute
        webkitdirectory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleUpload(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* 3-column layout: sidebar | main | preview */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <DropboxSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onNavigateToRoot={() => navigateToFolder('')}
          starredEntries={starredEntries}
          onStarredEntryClick={handleStarredEntryClick}
        />

        {/* Center: Toolbar + File List */}
        <div className="flex-1 flex flex-col min-w-0">
          <DropboxToolbar
            currentPath={currentPath}
            pathParts={pathParts}
            onNavigate={navigateToFolder}
            onUpload={() => fileInputRef.current?.click()}
            onNewFolder={() => {
              setNewFolderName('');
              setNewFolderOpen(true);
            }}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={handleToggleSort}
            connectedEmail={connectedEmail}
            activeSection={activeSection}
          />

          <DropboxFileList
            entries={entries}
            viewMode={viewMode}
            activeTab={activeTab}
            sortField={sortField}
            sortDirection={sortDirection}
            searchQuery={searchQuery}
            isLoading={isPhotosSection ? photosLoading : isSharedSection ? sharedLoading : listLoading}
            isStarred={isStarred}
            onToggleStar={toggleStar}
            onEntryClick={handleEntryClick}
            onDownload={handleDownload}
            onRename={handleRenameClick}
            onMove={handleMoveClick}
            onDelete={handleDeleteClick}
            dragOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            draggingEntryId={draggingEntryId}
            dragOverFolderId={dragOverFolderId}
            onEntryDragStart={handleEntryDragStart}
            onEntryDragEnd={handleEntryDragEnd}
            onFolderDragOver={handleFolderDragOver}
            onFolderDragLeave={handleFolderDragLeave}
            onFolderDrop={handleFolderDrop}
            uploadPending={uploadMutation.isPending}
            editingEntryId={editingEntryId}
            editingName={editingName}
            onStartEditing={handleStartEditing}
            onEditingNameChange={setEditingName}
            onCommitRename={handleCommitRename}
            onCancelEditing={handleCancelEditing}
            renamePending={moveMutation.isPending}
          />
        </div>

        {/* Right Preview Panel */}
        {selectedEntry && selectedEntry['.tag'] !== 'folder' && (
          <DropboxPreviewPanel
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onDownload={handleDownload}
            onDelete={(entry) => {
              setDeleteTarget(entry);
            }}
            onRename={(entry) => {
              setRenameTarget(entry);
              setRenameName(entry.name);
              setRenameOpen(true);
            }}
          />
        )}
      </div>

      {/* All Dialogs */}
      <DropboxDialogs
        newFolderOpen={newFolderOpen}
        onNewFolderOpenChange={setNewFolderOpen}
        newFolderName={newFolderName}
        onNewFolderNameChange={setNewFolderName}
        onCreateFolder={handleCreateFolder}
        createFolderPending={createFolderMutation.isPending}
        renameOpen={renameOpen}
        onRenameOpenChange={setRenameOpen}
        renameName={renameName}
        onRenameNameChange={setRenameName}
        onRename={handleRename}
        renamePending={moveMutation.isPending}
        moveOpen={moveOpen}
        onMoveOpenChange={setMoveOpen}
        moveTarget={moveTarget}
        moveDestination={moveDestination}
        onMoveDestinationChange={setMoveDestination}
        onMove={handleMove}
        movePending={moveMutation.isPending}
        deleteTarget={deleteTarget}
        onDeleteTargetChange={setDeleteTarget}
        onDelete={handleDelete}
      />
    </div>
  );
}
