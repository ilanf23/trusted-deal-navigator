import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, Trash2, Download, File, Image, FileSpreadsheet,
  Loader2, X, Eye,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { cn, sanitizeFileName } from '@/lib/utils';
import { useDropboxAutoUpload } from '@/hooks/useDropboxAutoUpload';

interface LeadFile {
  id: string;
  lead_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface LeadFilesSectionProps {
  leadId: string;
  leadName?: string;
  companyName?: string;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  webp: Image,
  svg: Image,
};

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
}

export function LeadFilesSection({ leadId, leadName, companyName }: LeadFilesSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<LeadFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadFile | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Dropbox auto-sync: check connection status (cached 5min)
  const { data: dropboxStatus } = useQuery({
    queryKey: ['dropbox-connection-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('dropbox-auth', {
        body: { action: 'getStatus' },
      });
      if (error) return { connected: false };
      return { connected: data?.connected ?? false };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!leadName,
  });
  const { syncToDropbox } = useDropboxAutoUpload(dropboxStatus?.connected ?? false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['lead-files', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_files')
        .select('id, lead_id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LeadFile[];
    },
  });

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    // Check auth session before attempting upload
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      toast.error('You must be logged in to upload files. Please refresh and sign in again.');
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of filesToUpload) {
        try {
          const safeName = sanitizeFileName(file.name);
          const filePath = `${leadId}/${crypto.randomUUID()}_${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from('lead-files')
            .upload(filePath, file, {
              contentType: file.type || 'application/octet-stream',
              upsert: true,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            const reason = uploadError.message?.includes('security')
              ? 'Permission denied — check your login session'
              : uploadError.message || 'Storage error';
            toast.error(`Upload failed for ${file.name}: ${reason}`);
            continue;
          }

          const { error: dbError } = await supabase
            .from('lead_files')
            .insert({
              lead_id: leadId,
              file_name: file.name,
              file_url: filePath,
              file_type: file.type || null,
              file_size: file.size,
              uploaded_by: 'Admin',
            });

          if (dbError) {
            console.error('DB insert error:', dbError);
            const reason = dbError.message?.includes('row-level security')
              ? 'Permission denied — admin role required'
              : dbError.message || 'Database error';
            toast.error(`Failed to save ${file.name}: ${reason}`);
            // Clean up orphaned storage file
            await supabase.storage.from('lead-files').remove([filePath]);
            continue;
          }

          successCount++;

          // Fire-and-forget Dropbox sync
          if (leadName) {
            syncToDropbox(file, leadName, companyName || '', leadId).catch(() => {});
          }
        } catch (fileErr) {
          console.error(`Unexpected error uploading ${file.name}:`, fileErr);
          toast.error(`Unexpected error uploading ${file.name}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
        queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
        if (leadName && dropboxStatus?.connected) {
          toast.info('Syncing to Dropbox...', { duration: 2000, id: 'dropbox-sync' });
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [leadId, leadName, companyName, syncToDropbox, dropboxStatus, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (file: LeadFile) => {
      const { error: storageError } = await supabase.storage
        .from('lead-files')
        .remove([file.file_url]);

      if (storageError) console.error('Storage delete error:', storageError);

      const { error: dbError } = await supabase
        .from('lead_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success('File deleted');
      queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete file');
    },
  });

  const handleDownload = useCallback(async (file: LeadFile) => {
    try {
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
    } catch {
      toast.error('Download failed');
    }
  }, []);

  const handlePreview = useCallback(async (file: LeadFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('lead-files')
        .createSignedUrl(file.file_url, 300);

      if (error || !data?.signedUrl) {
        toast.error('Failed to load preview');
        return;
      }

      setPreviewUrl(data.signedUrl);
      setPreviewFile(file);
    } catch {
      toast.error('Preview failed');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-1">
        <div className="h-8 w-full rounded bg-muted animate-pulse" />
        <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 pt-1">
        {/* Drop zone / Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
            }}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-1">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Drop files here or <span className="text-primary font-medium">browse</span>
              </span>
            </div>
          )}
        </div>

        {/* File list */}
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No files uploaded yet</p>
        ) : (
          <div className="space-y-1">
            {files.map((file) => {
              const IconComponent = getFileIcon(file.file_name);
              const canPreview = isImageFile(file.file_name) || file.file_type === 'application/pdf';

              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 hover:bg-muted/60 transition-colors"
                >
                  <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                      <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {canPreview && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); handlePreview(file); }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
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
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.file_name}</DialogTitle>
            <DialogDescription>
              {previewFile?.file_size ? formatFileSize(previewFile.file_size) : 'File preview'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md bg-muted/30 flex items-center justify-center min-h-[300px]">
            {previewUrl && previewFile && (
              isImageFile(previewFile.file_name) ? (
                <img
                  src={previewUrl}
                  alt={previewFile.file_name}
                  className="max-w-full max-h-[65vh] object-contain rounded"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewFile.file_name}
                  className="w-full h-[65vh] rounded border-0"
                />
              )
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => previewFile && handleDownload(previewFile)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.file_name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
