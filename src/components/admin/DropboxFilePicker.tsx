import { useState } from 'react';
import { useDropboxList, useDropboxLinkToLead, useDropboxGetLink, type DropboxEntry } from '@/hooks/useDropbox';
import { useDropboxConnection } from '@/hooks/useDropboxConnection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HardDrive,
  Folder,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  ChevronRight,
  Home,
  Download,
  Link2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return Image;
  return File;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DropboxFilePickerProps {
  leadId: string;
  leadName: string;
}

interface LinkedFile {
  id: string;
  name: string;
  dropbox_path_display: string;
  size: number | null;
  is_folder: boolean;
  extraction_status: string | null;
}

export function DropboxFilePicker({ leadId, leadName }: DropboxFilePickerProps) {
  const { isConnected } = useDropboxConnection();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('');
  const linkMutation = useDropboxLinkToLead();
  const getLinkMutation = useDropboxGetLink();

  // Fetch files linked to this lead from dropbox_files table
  const { data: linkedFiles = [], refetch: refetchLinked } = useQuery<LinkedFile[]>({
    queryKey: ['dropbox-lead-files', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dropbox_files')
        .select('id, name, dropbox_path_display, size, is_folder, extraction_status')
        .eq('lead_id', leadId)
        .eq('is_folder', false)
        .order('name');
      if (error) throw error;
      return (data || []) as LinkedFile[];
    },
    enabled: isConnected,
  });

  const handleLink = async (entry: DropboxEntry) => {
    await linkMutation.mutateAsync({
      fileId: entry.id,
      leadId,
      leadName,
    });
    refetchLinked();
  };

  const handleDownload = async (path: string) => {
    try {
      const data = await getLinkMutation.mutateAsync({ path });
      if (data.link) window.open(data.link, '_blank');
    } catch {
      // handled by mutation
    }
  };

  if (!isConnected) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Dropbox Files</span>
          {linkedFiles.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {linkedFiles.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          onClick={() => {
            setPickerPath('');
            setPickerOpen(true);
          }}
        >
          <Link2 className="h-3 w-3 mr-1" />
          Link File
        </Button>
      </div>

      {/* Linked files list */}
      {linkedFiles.length > 0 && (
        <div className="space-y-1">
          {linkedFiles.map((file) => {
            const Icon = getFileIcon(file.name);
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-sm group"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                {file.size && (
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleDownload(file.dropbox_path_display)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* File Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Link Dropbox File to {leadName}</DialogTitle>
          </DialogHeader>
          <PickerBrowser
            path={pickerPath}
            onNavigate={setPickerPath}
            onLink={(entry) => {
              handleLink(entry);
              setPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PickerBrowser({
  path,
  onNavigate,
  onLink,
}: {
  path: string;
  onNavigate: (path: string) => void;
  onLink: (entry: DropboxEntry) => void;
}) {
  const { data, isLoading } = useDropboxList(path);

  const entries = (data?.entries || []).sort((a: DropboxEntry, b: DropboxEntry) => {
    if (a['.tag'] === 'folder' && b['.tag'] !== 'folder') return -1;
    if (a['.tag'] !== 'folder' && b['.tag'] === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  const pathParts = path
    .split('/')
    .filter(Boolean)
    .map((part, idx, arr) => ({
      name: part,
      path: '/' + arr.slice(0, idx + 1).join('/'),
    }));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs mb-2 flex-wrap">
        <button onClick={() => onNavigate('')} className="text-muted-foreground hover:text-foreground">
          <Home className="h-3 w-3" />
        </button>
        {pathParts.map((part) => (
          <span key={part.path} className="flex items-center gap-1">
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60" />
            <button onClick={() => onNavigate(part.path)} className="text-muted-foreground hover:text-foreground">
              {part.name}
            </button>
          </span>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto border rounded-md">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            Empty folder
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry: DropboxEntry) => {
              const isFolder = entry['.tag'] === 'folder';
              const Icon = isFolder ? Folder : getFileIcon(entry.name);

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isFolder ? 'text-blue-500' : 'text-muted-foreground')} />
                  {isFolder ? (
                    <button
                      className="flex-1 text-left text-sm truncate hover:underline"
                      onClick={() => onNavigate(entry.path_lower)}
                    >
                      {entry.name}
                    </button>
                  ) : (
                    <>
                      <span className="flex-1 text-sm truncate">{entry.name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => onLink(entry)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
