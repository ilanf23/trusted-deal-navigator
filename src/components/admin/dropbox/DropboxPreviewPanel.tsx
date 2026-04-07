import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Maximize2, Crop, SlidersHorizontal, PenLine, MoreHorizontal, ZoomIn, ZoomOut, Loader2, ImageOff, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDropboxGetLink, type DropboxEntry } from '@/hooks/useDropbox';
import { formatFileSize } from './dropboxConstants';
import { DropboxImageEditor } from './DropboxImageEditor';

interface DropboxPreviewPanelProps {
  entry: DropboxEntry;
  onClose: () => void;
  onDownload: (entry: DropboxEntry) => void;
  onDelete: (entry: DropboxEntry) => void;
  onRename: (entry: DropboxEntry) => void;
}

type EditorInitialTab = 'Adjust' | 'Annotate' | 'Filters' | 'Resize';

export function DropboxPreviewPanel({ entry, onClose, onDownload, onDelete, onRename }: DropboxPreviewPanelProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialTab, setEditorInitialTab] = useState<EditorInitialTab | undefined>();
  const getLinkMutation = useDropboxGetLink();

  // Track the current path to avoid stale closures
  const entryPathRef = useRef(entry.path_lower);
  entryPathRef.current = entry.path_lower;

  // Fetch image link when entry changes
  useEffect(() => {
    setImageUrl(null);
    setImageError(false);
    setZoom(100);
    getLinkMutation.mutateAsync({ path: entry.path_lower }).then((data) => {
      if (data.link) setImageUrl(data.link);
      else setImageError(true);
    }).catch(() => setImageError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.path_lower]);

  const openEditor = (tab?: EditorInitialTab) => {
    setEditorInitialTab(tab);
    setEditorOpen(true);
  };

  const handleEditorClosed = () => {
    setEditorOpen(false);
  };

  const handleEditorSaved = () => {
    setEditorOpen(false);
    // Re-fetch the preview image
    setImageUrl(null);
    setImageError(false);
    getLinkMutation.mutateAsync({ path: entryPathRef.current }).then((data) => {
      if (data.link) setImageUrl(data.link);
      else setImageError(true);
    }).catch(() => setImageError(true));
  };

  const dropboxWebUrl = `https://www.dropbox.com/home${entry.path_display ? entry.path_display.substring(0, entry.path_display.lastIndexOf('/')) : ''}?preview=${encodeURIComponent(entry.name)}`;

  return (
    <>
      <div className="w-[600px] border-l border-[#e8eaed] dark:border-border flex flex-col bg-background shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e8eaed] dark:border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="font-semibold text-[13px] truncate">{entry.name}</p>
              <p className="text-[11px] text-[#5f6368] dark:text-muted-foreground">{formatFileSize(entry.size)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openEditor()}>
            <Maximize2 className="h-3.5 w-3.5" /> Open
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[#e8eaed] dark:border-border overflow-x-auto">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => openEditor()}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => openEditor()}>
            <Crop className="h-3.5 w-3.5" /> Crop
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => openEditor('Adjust')}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => openEditor('Annotate')}>
            <PenLine className="h-3.5 w-3.5" /> Annotate
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => onDownload(entry)}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(dropboxWebUrl, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open in Dropbox
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(entry)}>Rename</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(entry)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Image Preview */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#f8f9fa] dark:bg-muted/30 p-4 min-h-0">
          {!imageUrl && !imageError && (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
          {imageError && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm">Failed to load preview</p>
            </div>
          )}
          {imageUrl && !imageError && (
            <img
              src={imageUrl}
              alt={entry.name}
              className="max-w-full max-h-full transition-transform cursor-pointer"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              onError={() => setImageError(true)}
              onClick={() => openEditor()}
            />
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center px-4 py-2 border-t border-[#e8eaed] dark:border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(10, z - 10))} disabled={zoom <= 10}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(200, z + 10))} disabled={zoom >= 200}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Fullscreen Editor/Viewer — portaled to document.body to escape contain: strict */}
      {editorOpen && imageUrl && createPortal(
        <DropboxImageEditor
          entry={entry}
          imageUrl={imageUrl}
          initialTab={editorInitialTab}
          onClose={handleEditorClosed}
          onSaved={handleEditorSaved}
        />,
        document.body
      )}
    </>
  );
}
