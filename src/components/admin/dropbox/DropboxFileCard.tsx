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

interface DropboxFileCardProps {
  entry: DropboxEntry;
  isStarred: boolean;
  onToggleStar: (path: string) => void;
  onClick: (entry: DropboxEntry) => void;
  onDownload: (entry: DropboxEntry) => void;
  onRename: (entry: DropboxEntry) => void;
  onMove: (entry: DropboxEntry) => void;
  onDelete: (entry: DropboxEntry) => void;
  // Inline rename
  isEditing: boolean;
  editingName: string;
  onStartEditing: (entry: DropboxEntry) => void;
  onEditingNameChange: (name: string) => void;
  onCommitRename: () => void;
  onCancelEditing: () => void;
  renamePending: boolean;
}

export function DropboxFileCard({
  entry,
  isStarred,
  onToggleStar,
  onClick,
  onDownload,
  onRename,
  onMove,
  onDelete,
  isEditing,
  editingName,
  onStartEditing,
  onEditingNameChange,
  onCommitRename,
  onCancelEditing,
  renamePending,
}: DropboxFileCardProps) {
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
      className={cn(
        'relative border rounded-md p-4 hover:shadow-sm transition-all duration-150 bg-card border-[#e8eaed] dark:border-border group',
        isFolder && 'cursor-pointer',
      )}
      onClick={() => onClick(entry)}
    >
      {/* Star toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStar(entry.path_lower); }}
        className={cn(
          'absolute top-2 right-2 transition-opacity duration-150 z-10',
          isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Star className={cn('h-4 w-4', isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40')} />
      </button>

      {/* Context menu */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
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

      {/* Icon */}
      <div className="flex items-center justify-center py-6">
        <Icon className={cn('h-12 w-12', isFolder ? 'text-[#3b2778] dark:text-purple-400' : 'text-muted-foreground/60')} />
      </div>

      {/* Name + date */}
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
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-[13px] font-medium truncate">{entry.name}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onStartEditing(entry); }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil className="h-3 w-3 text-muted-foreground/60 hover:text-foreground" />
          </button>
        </div>
      )}
      <p className="text-[11px] text-[#5f6368] dark:text-muted-foreground mt-0.5">
        {isFolder ? 'Folder' : formatModifiedDate(entry.server_modified)}
      </p>
    </div>
  );
}
