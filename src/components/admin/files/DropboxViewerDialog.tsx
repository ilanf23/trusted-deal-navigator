import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Download } from 'lucide-react';

interface DropboxViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropboxPath: string;
  fileName: string;
}

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function DropboxViewerDialog({
  open,
  onOpenChange,
  dropboxPath,
  fileName,
}: DropboxViewerDialogProps) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setLink(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke('dropbox-files', {
        body: { action: 'get-temporary-link', path: dropboxPath },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          toast.error(`Failed to load Dropbox file: ${error?.message || data?.error || 'unknown'}`);
          setLink(null);
        } else {
          setLink(data?.link || data?.url || null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, dropboxPath]);

  const previewable = isImage(fileName) || isPdf(fileName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
          <DialogDescription className="truncate">{dropboxPath}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md bg-muted/30 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !link ? (
            <p className="text-sm text-muted-foreground">No preview available</p>
          ) : previewable ? (
            isImage(fileName) ? (
              <img src={link} alt={fileName} className="max-w-full max-h-[65vh] object-contain rounded" />
            ) : (
              <iframe src={link} title={fileName} className="w-full h-[65vh] rounded border-0" />
            )
          ) : (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No inline preview for this file type.</p>
              <a href={link} target="_blank" rel="noreferrer" className="text-primary text-sm underline">
                Open in new tab
              </a>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {link && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={link} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open original
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={link} download={fileName}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                </a>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
