import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  server_modified?: string;
  rev?: string;
  content_hash?: string;
  // Local metadata from dropbox_files
  lead_id?: string;
  lead_name?: string;
  extraction_status?: string;
}

interface ListResult {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

async function invokeDropboxApi(action: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('dropbox-api', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'Dropbox API error');
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useDropboxList(path: string, enabled = true) {
  return useQuery<ListResult>({
    queryKey: ['dropbox-files', path],
    queryFn: () => invokeDropboxApi('list', { path: path || '' }),
    staleTime: 30_000,
    enabled,
  });
}

export function useDropboxUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, file }: { path: string; file: File }) => {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const content = btoa(binary);
      const fullPath = path === '' || path === '/' ? `/${file.name}` : `${path}/${file.name}`;
      return invokeDropboxApi('upload', { path: fullPath, content });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path;
      queryClient.invalidateQueries({ queryKey: ['dropbox-files', parentPath] });
      toast.success('File uploaded');
    },
    onError: (err: Error) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });
}

export function useDropboxCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      return invokeDropboxApi('create-folder', { path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
      toast.success('Folder created');
    },
    onError: (err: Error) => {
      toast.error(`Create folder failed: ${err.message}`);
    },
  });
}

export function useDropboxDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      return invokeDropboxApi('delete', { path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
      toast.success('Deleted');
    },
    onError: (err: Error) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });
}

export function useDropboxMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ from_path, to_path }: { from_path: string; to_path: string }) => {
      return invokeDropboxApi('move', { from_path, to_path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
      toast.success('Moved successfully');
    },
    onError: (err: Error) => {
      toast.error(`Move failed: ${err.message}`);
    },
  });
}

export function useDropboxGetLink() {
  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      return invokeDropboxApi('get-temporary-link', { path });
    },
  });
}

export function useDropboxLinkToLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, leadId, leadName }: { fileId: string; leadId: string; leadName: string }) => {
      return invokeDropboxApi('link-to-lead', { fileId, leadId, leadName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
      toast.success('File linked to lead');
    },
    onError: (err: Error) => {
      toast.error(`Link failed: ${err.message}`);
    },
  });
}

export function useDropboxSearch(query: string, leadId?: string) {
  return useQuery({
    queryKey: ['dropbox-search', query, leadId],
    queryFn: () => invokeDropboxApi('search-content', { query, leadId }),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}

export function useDropboxSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mode }: { mode: 'full-sync' | 'incremental-sync' }) => {
      const { data, error } = await supabase.functions.invoke('dropbox-sync', {
        body: { action: mode },
      });
      if (error) throw new Error(error.message || 'Sync failed');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
      const count = data.synced || data.changes || 0;
      toast.success(`Sync complete: ${count} items ${variables.mode === 'full-sync' ? 'indexed' : 'updated'}`);
    },
    onError: (err: Error) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });
}
