import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload, Loader2, Cloud, FileSpreadsheet, Search, FileText, File,
} from 'lucide-react';
import { sanitizeFileName, cn } from '@/lib/utils';
import { useDropboxAutoUpload } from '@/hooks/useDropboxAutoUpload';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useTeamMember } from '@/hooks/useTeamMember';
import type { EntityType } from './types';

interface AddFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: EntityType;
  entityName?: string;
  companyName?: string;
  onAdded?: () => void;
}

interface DropboxFileEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_lower?: string;
  path_display?: string;
  size?: number;
}

interface SheetEntry {
  id: string;
  name: string;
  modifiedTime: string;
}

export function AddFileDialog({
  open,
  onOpenChange,
  entityId,
  entityType,
  entityName,
  companyName,
  onAdded,
}: AddFileDialogProps) {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'computer' | 'dropbox' | 'sheets'>('computer');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropboxSearch, setDropboxSearch] = useState('');
  const [sheetsSearch, setSheetsSearch] = useState('');
  const [savingLink, setSavingLink] = useState<string | null>(null);

  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['entity-files', entityType, entityId] });
    onAdded?.();
  }, [queryClient, entityId, entityType, onAdded]);

  // ── Dropbox connection + listing ─────────────────────────────────────────
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
  });
  const dropboxConnected = !!dropboxStatus?.connected;
  const { syncToDropbox } = useDropboxAutoUpload(dropboxConnected);

  const { data: dropboxFiles = [], isLoading: dropboxLoading } = useQuery<DropboxFileEntry[]>({
    queryKey: ['add-file-dropbox-list-recursive'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('dropbox-files', {
        body: { action: 'list-recursive', path: '' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.entries ?? []).filter((e: DropboxFileEntry) => e['.tag'] === 'file');
    },
    enabled: open && tab === 'dropbox' && dropboxConnected,
    staleTime: 5 * 60 * 1000,
  });

  // ── Google Sheets ────────────────────────────────────────────────────────
  const { isConnected: sheetsConnected, listSpreadsheets, connect: connectSheets } =
    useGoogleSheets(teamMember?.name, '/admin/settings');
  const [sheets, setSheets] = useState<SheetEntry[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  useEffect(() => {
    if (!open || tab !== 'sheets' || !sheetsConnected) return;
    let cancelled = false;
    setSheetsLoading(true);
    listSpreadsheets()
      .then((list) => { if (!cancelled) setSheets(list as SheetEntry[]); })
      .finally(() => { if (!cancelled) setSheetsLoading(false); });
    return () => { cancelled = true; };
  }, [open, tab, sheetsConnected, listSpreadsheets]);

  // ── Native upload (Computer tab) ─────────────────────────────────────────
  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      toast.error('You must be logged in to upload files.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    const syncPromises: Promise<void>[] = [];

    try {
      for (const file of filesToUpload) {
        const safeName = sanitizeFileName(file.name);
        const filePath = `${entityId}/${crypto.randomUUID()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('lead-files')
          .upload(filePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) {
          toast.error(`Upload failed for ${file.name}: ${uploadError.message || 'Storage error'}`);
          continue;
        }

        const { error: dbError } = await supabase.from('entity_files').insert({
          entity_id: entityId,
          entity_type: entityType,
          file_name: file.name,
          file_url: filePath,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: teamMember?.name ?? 'Admin',
          source_system: 'native',
        });

        if (dbError) {
          toast.error(`Failed to save ${file.name}: ${dbError.message || 'Database error'}`);
          await supabase.storage.from('lead-files').remove([filePath]);
          continue;
        }

        successCount++;
        if (entityName && dropboxConnected) {
          syncPromises.push(syncToDropbox(file, entityName, companyName || '', entityId));
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
        invalidateFiles();

        if (syncPromises.length > 0) {
          toast.info('Syncing to Dropbox…', { duration: Infinity, id: 'dropbox-sync' });
          Promise.allSettled(syncPromises).then((results) => {
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
            queryClient.invalidateQueries({ queryKey: ['dropbox-files-recursive'] });
            if (succeeded === results.length) {
              toast.success(`Synced ${succeeded} to Dropbox`, { id: 'dropbox-sync' });
            } else if (succeeded > 0) {
              toast.warning(`Synced ${succeeded}/${results.length} to Dropbox`, { id: 'dropbox-sync' });
            } else {
              toast.error('Dropbox sync failed', { id: 'dropbox-sync' });
            }
          });
        }
        onOpenChange(false);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [entityId, entityType, entityName, companyName, dropboxConnected, syncToDropbox, invalidateFiles, queryClient, teamMember, onOpenChange]);

  // ── Save Dropbox file as link reference ──────────────────────────────────
  const saveDropboxLink = useCallback(async (entry: DropboxFileEntry) => {
    const path = entry.path_display || entry.path_lower || '';
    if (!path) {
      toast.error('Missing Dropbox path');
      return;
    }
    setSavingLink(entry.id);
    const { error } = await supabase.from('entity_files').insert({
      entity_id: entityId,
      entity_type: entityType,
      file_name: entry.name,
      file_url: path,
      file_type: 'dropbox',
      file_size: entry.size ?? null,
      uploaded_by: teamMember?.name ?? 'Admin',
      source_system: 'dropbox',
    });
    setSavingLink(null);
    if (error) {
      toast.error(`Failed to link Dropbox file: ${error.message}`);
      return;
    }
    toast.success(`Linked “${entry.name}” from Dropbox`);
    invalidateFiles();
    onOpenChange(false);
  }, [entityId, entityType, invalidateFiles, onOpenChange, teamMember]);

  // ── Save Google Sheet as link reference ──────────────────────────────────
  const saveSheetLink = useCallback(async (entry: SheetEntry) => {
    setSavingLink(entry.id);
    const { error } = await supabase.from('entity_files').insert({
      entity_id: entityId,
      entity_type: entityType,
      file_name: entry.name,
      file_url: entry.id,
      file_type: 'google_sheets',
      file_size: null,
      uploaded_by: teamMember?.name ?? 'Admin',
      source_system: 'google_sheets',
    });
    setSavingLink(null);
    if (error) {
      toast.error(`Failed to link sheet: ${error.message}`);
      return;
    }
    toast.success(`Linked “${entry.name}” from Sheets`);
    invalidateFiles();
    onOpenChange(false);
  }, [entityId, entityType, invalidateFiles, onOpenChange, teamMember]);

  const filteredDropbox = dropboxSearch
    ? dropboxFiles.filter((f) => f.name.toLowerCase().includes(dropboxSearch.toLowerCase()))
    : dropboxFiles;
  const filteredSheets = sheetsSearch
    ? sheets.filter((s) => s.name.toLowerCase().includes(sheetsSearch.toLowerCase()))
    : sheets;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add file</DialogTitle>
          <DialogDescription>
            Upload from your computer, or link a file from Dropbox or Google Sheets.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="computer" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Computer
            </TabsTrigger>
            <TabsTrigger value="dropbox" className="gap-1.5">
              <Cloud className="h-3.5 w-3.5" /> Dropbox
            </TabsTrigger>
            <TabsTrigger value="sheets" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Google Sheets
            </TabsTrigger>
          </TabsList>

          {/* Computer tab */}
          <TabsContent value="computer" className="mt-4">
            <div
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); }}
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Drop files here or <span className="text-primary font-medium">browse</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Files are stored in our app and {dropboxConnected ? 'auto-synced to Dropbox' : 'kept locally'}.
                  </span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Dropbox tab */}
          <TabsContent value="dropbox" className="mt-4">
            {!dropboxConnected ? (
              <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
                Connect Dropbox in Settings to pick files from your account.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search Dropbox files…"
                    value={dropboxSearch}
                    onChange={(e) => setDropboxSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
                  {dropboxLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading files…
                    </div>
                  ) : filteredDropbox.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {dropboxSearch ? 'No matches' : 'No files found'}
                    </div>
                  ) : (
                    filteredDropbox.slice(0, 200).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        disabled={savingLink === entry.id}
                        onClick={() => saveDropboxLink(entry)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 border-b border-border last:border-b-0 disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {entry.path_display || entry.path_lower}
                          </p>
                        </div>
                        {savingLink === entry.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Google Sheets tab */}
          <TabsContent value="sheets" className="mt-4">
            {!sheetsConnected ? (
              <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground space-y-3">
                <p>Connect Google Sheets to link spreadsheets to this record.</p>
                <Button size="sm" variant="outline" onClick={() => connectSheets()}>
                  Connect Google Sheets
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search sheets…"
                    value={sheetsSearch}
                    onChange={(e) => setSheetsSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
                  {sheetsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading sheets…
                    </div>
                  ) : filteredSheets.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {sheetsSearch ? 'No matches' : 'No sheets found'}
                    </div>
                  ) : (
                    filteredSheets.slice(0, 200).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={savingLink === s.id}
                        onClick={() => saveSheetLink(s)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 border-b border-border last:border-b-0 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.modifiedTime ? new Date(s.modifiedTime).toLocaleDateString() : ''}
                          </p>
                        </div>
                        {savingLink === s.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
