import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText, Plus, Trash2, Download, File, Image, FileSpreadsheet,
  Loader2, Eye, Cloud,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddFileDialog } from './AddFileDialog';
import { SheetViewerDialog } from './SheetViewerDialog';
import { DropboxViewerDialog } from './DropboxViewerDialog';
import type { EntityFile, EntityType, FileSourceSystem } from './types';

interface EntityFilesSectionProps {
  entityId: string;
  entityType: EntityType;
  entityName?: string;
  companyName?: string;
}

const EXT_ICON: Record<string, typeof FileText> = {
  pdf: FileText, doc: FileText, docx: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet,
  png: Image, jpg: Image, jpeg: Image, gif: Image, webp: Image, svg: Image,
};

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_ICON[ext] || File;
}

function isImage(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sourceMeta(source: string): { icon: typeof Cloud; label: string; className: string } {
  switch (source as FileSourceSystem) {
    case 'dropbox':
      return { icon: Cloud, label: 'Dropbox', className: 'text-blue-600' };
    case 'google_sheets':
      return { icon: FileSpreadsheet, label: 'Google Sheets', className: 'text-green-600' };
    default:
      return { icon: File, label: 'Uploaded', className: 'text-muted-foreground' };
  }
}

export function EntityFilesSection({
  entityId,
  entityType,
  entityName,
  companyName,
}: EntityFilesSectionProps) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<EntityFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EntityFile | null>(null);
  const [sheetView, setSheetView] = useState<EntityFile | null>(null);
  const [dropboxView, setDropboxView] = useState<EntityFile | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['entity-files', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_files')
        .select('id, entity_id, entity_type, file_name, file_url, file_type, file_size, uploaded_by, source_system, created_at')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EntityFile[];
    },
    enabled: !!entityId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (file: EntityFile) => {
      if (file.source_system === 'native') {
        const { error: storageError } = await supabase.storage
          .from('lead-files')
          .remove([file.file_url]);
        if (storageError) console.error('Storage delete error:', storageError);
      }
      const { error } = await supabase.from('entity_files').delete().eq('id', file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('File removed');
      queryClient.invalidateQueries({ queryKey: ['entity-files', entityType, entityId] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to remove file'),
  });

  const handleDownload = useCallback(async (file: EntityFile) => {
    if (file.source_system !== 'native') return;
    const { data, error } = await supabase.storage
      .from('lead-files')
      .createSignedUrl(file.file_url, 60);
    if (error || !data?.signedUrl) {
      toast.error('Failed to generate download link');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleOpen = useCallback(async (file: EntityFile) => {
    if (file.source_system === 'google_sheets') {
      setSheetView(file);
      return;
    }
    if (file.source_system === 'dropbox') {
      setDropboxView(file);
      return;
    }
    // native preview
    const { data, error } = await supabase.storage
      .from('lead-files')
      .createSignedUrl(file.file_url, 300);
    if (error || !data?.signedUrl) {
      toast.error('Failed to load preview');
      return;
    }
    setPreviewUrl(data.signedUrl);
    setPreviewFile(file);
  }, []);

  return (
    <>
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {files.length === 0
              ? 'No files yet'
              : `${files.length} file${files.length === 1 ? '' : 's'}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add file
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-full rounded bg-muted animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">
            Click <strong>Add file</strong> to upload from your computer or link from Dropbox / Google Sheets.
          </p>
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className="space-y-1">
              {files.map((file) => {
                const FileIcon = fileIcon(file.file_name);
                const { icon: SourceIcon, label: sourceLabel, className: sourceClass } = sourceMeta(file.source_system);
                const canPreview =
                  file.source_system === 'native'
                    ? (isImage(file.file_name) || file.file_type === 'application/pdf')
                    : true;

                return (
                  <div
                    key={file.id}
                    className="group flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 hover:bg-muted/60 transition-colors cursor-pointer"
                    onClick={() => handleOpen(file)}
                  >
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn('h-5 px-1.5 gap-1 text-[10px] font-normal shrink-0', sourceClass)}
                        >
                          <SourceIcon className="h-2.5 w-2.5" />
                          {sourceLabel}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top">From {sourceLabel}</TooltipContent>
                    </Tooltip>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                        {file.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {file.source_system === 'native' && file.file_size != null && (
                          <span>{formatBytes(file.file_size)}</span>
                        )}
                        <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {canPreview && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleOpen(file); }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      {file.source_system === 'native' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>

      <AddFileDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entityId={entityId}
        entityType={entityType}
        entityName={entityName}
        companyName={companyName}
      />

      {/* Native file preview */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.file_name}</DialogTitle>
            <DialogDescription>
              {previewFile?.file_size ? formatBytes(previewFile.file_size) : 'File preview'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md bg-muted/30 flex items-center justify-center min-h-[300px]">
            {previewUrl && previewFile && (
              isImage(previewFile.file_name) ? (
                <img src={previewUrl} alt={previewFile.file_name} className="max-w-full max-h-[65vh] object-contain rounded" />
              ) : (
                <iframe src={previewUrl} title={previewFile.file_name} className="w-full h-[65vh] rounded border-0" />
              )
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => previewFile && handleDownload(previewFile)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {sheetView && (
        <SheetViewerDialog
          open={!!sheetView}
          onOpenChange={(o) => !o && setSheetView(null)}
          spreadsheetId={sheetView.file_url}
          spreadsheetName={sheetView.file_name}
        />
      )}

      {dropboxView && (
        <DropboxViewerDialog
          open={!!dropboxView}
          onOpenChange={(o) => !o && setDropboxView(null)}
          dropboxPath={dropboxView.file_url}
          fileName={dropboxView.file_name}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.source_system === 'native' ? 'Delete file?' : 'Remove link?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.source_system === 'native' ? (
                <>This will permanently delete <strong>{deleteTarget?.file_name}</strong>.</>
              ) : (
                <>This removes the link to <strong>{deleteTarget?.file_name}</strong>. The original file in {sourceMeta(deleteTarget?.source_system ?? '').label} is not affected.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {deleteTarget?.source_system === 'native' ? 'Delete' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
