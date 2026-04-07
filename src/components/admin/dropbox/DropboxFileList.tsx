import { useMemo, useState, useEffect, useRef } from 'react';
import { Loader2, Folder, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DropboxFileRow } from './DropboxFileRow';
import { DropboxFileCard } from './DropboxFileCard';
import type { ViewMode, ActiveTab, SortField, SortDirection } from './DropboxToolbar';
import type { DropboxEntry } from '@/hooks/useDropbox';

interface DropboxFileListProps {
  entries: DropboxEntry[];
  viewMode: ViewMode;
  activeTab: ActiveTab;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  isLoading: boolean;
  isStarred: (path: string) => boolean;
  onToggleStar: (path: string) => void;
  onEntryClick: (entry: DropboxEntry) => void;
  onDownload: (entry: DropboxEntry) => void;
  onRename: (entry: DropboxEntry) => void;
  onMove: (entry: DropboxEntry) => void;
  onDelete: (entry: DropboxEntry) => void;
  // OS drag-drop
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  // Internal drag-drop
  draggingEntryId: string | null;
  dragOverFolderId: string | null;
  onEntryDragStart: (e: React.DragEvent, entry: DropboxEntry) => void;
  onEntryDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  onFolderDragLeave: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, entry: DropboxEntry) => void;
  // Upload progress
  uploadPending: boolean;
  // Inline rename
  editingEntryId: string | null;
  editingName: string;
  onStartEditing: (entry: DropboxEntry) => void;
  onEditingNameChange: (name: string) => void;
  onCommitRename: () => void;
  onCancelEditing: () => void;
  renamePending: boolean;
}

export function DropboxFileList({
  entries,
  viewMode,
  activeTab,
  sortField,
  sortDirection,
  searchQuery,
  isLoading,
  isStarred,
  onToggleStar,
  onEntryClick,
  onDownload,
  onRename,
  onMove,
  onDelete,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingEntryId,
  dragOverFolderId,
  onEntryDragStart,
  onEntryDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  uploadPending,
  editingEntryId,
  editingName,
  onStartEditing,
  onEditingNameChange,
  onCommitRename,
  onCancelEditing,
  renamePending,
}: DropboxFileListProps) {
  const BATCH_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const prevEntriesRef = useRef(entries);

  // Reset visibleCount when entries reference changes (new data load)
  useEffect(() => {
    if (entries !== prevEntriesRef.current) {
      prevEntriesRef.current = entries;
      setVisibleCount(BATCH_SIZE);
    }
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Tab filtering
    if (activeTab === 'recents') {
      result = result.filter((e) => e['.tag'] !== 'folder');
    } else if (activeTab === 'starred') {
      result = result.filter((e) => isStarred(e.path_lower));
    }

    // Search filtering
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }

    // Sorting
    result.sort((a, b) => {
      // Folders always first (except in recents which excludes folders)
      if (activeTab !== 'recents') {
        if (a['.tag'] === 'folder' && b['.tag'] !== 'folder') return -1;
        if (a['.tag'] !== 'folder' && b['.tag'] === 'folder') return 1;
      }

      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'modified') {
        const aDate = a.server_modified ? new Date(a.server_modified).getTime() : 0;
        const bDate = b.server_modified ? new Date(b.server_modified).getTime() : 0;
        if (activeTab === 'recents') {
          return bDate - aDate; // Always most recent first for recents
        }
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return 0;
    });

    return result;
  }, [entries, activeTab, searchQuery, sortField, sortDirection, isStarred]);

  return (
    <div
      className={cn(
        'flex-1 overflow-auto relative',
        dragOver && 'bg-[#eee6f6]/30 dark:bg-purple-950/20 ring-2 ring-[#3b2778]/20 dark:ring-purple-400/20 ring-inset',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Folder className="h-12 w-12 mb-3 text-[#3b2778]/20 dark:text-purple-400/20" />
          <p className="text-[13px] text-[#5f6368] dark:text-muted-foreground">
            {searchQuery
              ? 'No files match your search'
              : activeTab === 'starred'
              ? 'No starred files'
              : activeTab === 'recents'
              ? 'No recent files'
              : 'This folder is empty'}
          </p>
          <p className="text-[11px] text-[#5f6368] dark:text-muted-foreground mt-1">Drag & drop files here to upload</p>
        </div>
      ) : viewMode === 'list' ? (
        <div>
          {filteredEntries.map((entry) => (
            <DropboxFileRow
              key={entry.id}
              entry={entry}
              isStarred={isStarred(entry.path_lower)}
              onToggleStar={onToggleStar}
              onClick={onEntryClick}
              onDownload={onDownload}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              onDragStart={onEntryDragStart}
              onDragEnd={onEntryDragEnd}
              onFolderDragOver={onFolderDragOver}
              onFolderDragLeave={onFolderDragLeave}
              onFolderDrop={onFolderDrop}
              isDragging={draggingEntryId === entry.id}
              isDragOver={dragOverFolderId === entry.id && draggingEntryId !== entry.id}
              isEditing={editingEntryId === entry.id}
              editingName={editingName}
              onStartEditing={onStartEditing}
              onEditingNameChange={onEditingNameChange}
              onCommitRename={onCommitRename}
              onCancelEditing={onCancelEditing}
              renamePending={renamePending}
            />
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6">
            {filteredEntries.slice(0, visibleCount).map((entry) => (
              <DropboxFileCard
                key={entry.id}
                entry={entry}
                isStarred={isStarred(entry.path_lower)}
                onToggleStar={onToggleStar}
                onClick={onEntryClick}
                onDownload={onDownload}
                onRename={onRename}
                onMove={onMove}
                onDelete={onDelete}
                isEditing={editingEntryId === entry.id}
                editingName={editingName}
                onStartEditing={onStartEditing}
                onEditingNameChange={onEditingNameChange}
                onCommitRename={onCommitRename}
                onCancelEditing={onCancelEditing}
                renamePending={renamePending}
              />
            ))}
          </div>
          {filteredEntries.length > visibleCount && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-[#e8eaed] dark:border-border">
              <span className="text-sm text-muted-foreground">
                Showing {visibleCount} of {filteredEntries.length} items
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + BATCH_SIZE)}
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload overlay when dragging */}
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[#eee6f6] dark:bg-purple-950/30 border-2 border-dashed border-[#3b2778]/30 dark:border-purple-400/30 rounded-md p-8">
            <Upload className="h-8 w-8 text-[#3b2778] dark:text-purple-300 mx-auto mb-2" />
            <p className="text-sm text-[#3b2778] dark:text-purple-300 font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadPending && (
        <div className="sticky bottom-0 px-4 py-2 border-t bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading...
        </div>
      )}
    </div>
  );
}
