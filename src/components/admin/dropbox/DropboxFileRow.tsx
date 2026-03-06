import { useRef, useEffect } from 'react';
import { Star, MoreHorizontal, Download, Pencil, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getFileIcon, formatModifiedDate } from './dropboxConstants';
import { Folder } from 'lucide-react';
import type { DropboxEntry } from '@/hooks/useDropbox';

interface DropboxFileRowProps {
  entry: DropboxEntry;
  isStarred: boolean;
  onToggleStar: (path: string) => void;
  onClick: (entry: DropboxEntry) => void;
  onDownload: (entry: DropboxEntry) => void;
  onRename: (entry: DropboxEntry) => void;
  onMove: (entry: DropboxEntry) => void;
  onDelete: (entry: DropboxEntry) => void;
  onDragStart: (e: React.DragEvent, entry: DropboxEntry) => void;
  onDragEnd: () => void;
  onFolderDragOver?: (e: React.DragEvent, folderId: string) => void;
  onFolderDragLeave?: (e: React.DragEvent) => void;
  onFolderDrop?: (e: React.DragEvent, entry: DropboxEntry) => void;
  isDragging: boolean;
  isDragOver: boolean;
  // Inline rename
  isEditing: boolean;
  editingName: string;
  onStartEditing: (entry: DropboxEntry) => void;
  onEditingNameChange: (name: string) => void;
  onCommitRename: () => void;
  onCancelEditing: () => void;
  renamePending: boolean;
}

export function DropboxFileRow({
  entry,
  isStarred,
  onToggleStar,
  onClick,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  isDragging,
  isDragOver,
  isEditing,
  editingName,
  onStartEditing,
  onEditingNameChange,
  onCommitRename,
  onCancelEditing,
  renamePending,
}: DropboxFileRowProps) {
  const isFolder = entry['.tag'] === 'folder';
  const Icon = isFolder ? Folder : getFileIcon(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
      onDragEnd={onDragEnd}
      {...(isFolder ? {
        onDragOver: (e: React.DragEvent) => onFolderDragOver?.(e, entry.id),
        onDragLeave: (e: React.DragEvent) => onFolderDragLeave?.(e),
        onDrop: (e: React.DragEvent) => onFolderDrop?.(e, entry),
      } : {})}
      className={cn(
        'grid grid-cols-[1fr_160px_200px] items-center px-4 py-2 border-b border-border/50 hover:bg-muted/40 transition-colors group',
        isFolder && 'cursor-pointer',
        isDragging && 'opacity-40',
        isDragOver && !isDragging && 'bg-primary/10 ring-2 ring-primary/30 ring-inset',
      )}
      onClick={() => onClick(entry)}
    >
      {/* Name column */}
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={cn('h-5 w-5 flex-shrink-0', isFolder ? 'text-[#0061fe]' : 'text-muted-foreground')} />
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancelEditing(); }
            }}
            onBlur={onCommitRename}
            onClick={(e) => e.stopPropagation()}
            disabled={renamePending}
            className="h-7 text-sm py-0 px-2"
          />
        ) : (
          <>
            <span className="text-sm truncate">{entry.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEditing(entry); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground" />
            </button>
          </>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(entry.path_lower); }}
          className={cn(
            'flex-shrink-0 transition-opacity',
            isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <Star className={cn('h-4 w-4', isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40')} />
        </button>
      </div>

      {/* Who can access column */}
      <div className="text-sm text-muted-foreground">Only you</div>

      {/* Modified column */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {isFolder ? '--' : formatModifiedDate(entry.server_modified)}
        </span>

        {/* Context menu */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isFolder && (
                <DropdownMenuItem onClick={() => onDownload(entry)}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onStartEditing(entry)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(entry)}>
                <ArrowRight className="h-3.5 w-3.5 mr-2" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(entry)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
