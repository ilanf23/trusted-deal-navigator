import { useState, useEffect, useCallback } from 'react';
import { X, Download, Maximize2, Minimize2, Crop, SlidersHorizontal, PenLine, MoreHorizontal, ZoomIn, ZoomOut, Loader2, ImageOff, ExternalLink, ChevronDown, Link, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDropboxGetLink, type DropboxEntry } from '@/hooks/useDropbox';
import { formatFileSize } from './dropboxConstants';

interface DropboxPreviewPanelProps {
  entry: DropboxEntry;
  onClose: () => void;
  onDownload: (entry: DropboxEntry) => void;
  onDelete: (entry: DropboxEntry) => void;
  onRename: (entry: DropboxEntry) => void;
}

export function DropboxPreviewPanel({ entry, onClose, onDownload, onDelete, onRename }: DropboxPreviewPanelProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const getLinkMutation = useDropboxGetLink();

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

  const dropboxWebUrl = `https://www.dropbox.com/home${entry.path_display ? entry.path_display.substring(0, entry.path_display.lastIndexOf('/')) : ''}?preview=${encodeURIComponent(entry.name)}`;

  const fileNameParts = entry.name.split('.');
  const extension = fileNameParts.length > 1 ? fileNameParts.pop()!.toUpperCase() : '';
  const baseName = fileNameParts.join('.');

  const closeExpanded = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpanded();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded, closeExpanded]);

  const imagePreview = (
    <>
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
          className="max-w-full max-h-full transition-transform"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
          onError={() => setImageError(true)}
        />
      )}
    </>
  );

  const zoomControls = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setZoom((z) => Math.max(10, z - 10))}
        disabled={zoom <= 10}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setZoom((z) => Math.min(200, z + 10))}
        disabled={zoom >= 200}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );

  // Fullscreen expanded overlay — Dropbox web UI style
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Row 1 — Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeExpanded}>
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Dropbox</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{baseName}</span>
              {extension && (
                <span className="ml-1 px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold uppercase rounded">
                  {extension}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload(entry)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(dropboxWebUrl); }}>
              <Link className="h-4 w-4" />
            </Button>
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 ml-1">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Row 2 — Menu bar */}
        <div className="flex items-center gap-1 px-4 py-1 border-b">
          {['File', 'Edit', 'View', 'Help'].map((label) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={() => window.open(dropboxWebUrl, '_blank')}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Row 3 — Toolbar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open(dropboxWebUrl, '_blank')}>
              Open in <ChevronDown className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open(dropboxWebUrl, '_blank')}>
              Edit <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(10, z - 10))} disabled={zoom <= 10}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(200, z + 10))} disabled={zoom >= 200}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeExpanded}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image canvas — dark background like Dropbox */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-zinc-800 p-8 min-h-0">
          {imagePreview}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[600px] border-l flex flex-col bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{entry.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(entry.size)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setExpanded(true)}>
            <Maximize2 className="h-3.5 w-3.5" /> Expand
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => setExpanded(true)}>
          <Maximize2 className="h-3.5 w-3.5" /> Expand
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => window.open(dropboxWebUrl, '_blank')}>
          <Crop className="h-3.5 w-3.5" /> Crop
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => window.open(dropboxWebUrl, '_blank')}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => onDownload(entry)}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => window.open('https://sign.dropbox.com', '_blank')}>
          <PenLine className="h-3.5 w-3.5" /> Sign
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
      <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 p-4 min-h-0">
        {imagePreview}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center justify-center px-4 py-2 border-t">
        {zoomControls}
      </div>
    </div>
  );
}
