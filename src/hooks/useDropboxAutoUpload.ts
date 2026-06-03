import { useCallback } from 'react';
import { invokeDropboxApi } from './useDropbox';
import type { EntityType } from '@/components/admin/files/types';

interface DropboxAutoUploadTarget {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  companyName?: string;
}

export function useDropboxAutoUpload(enabled: boolean) {
  const syncToDropbox = useCallback(async (
    file: File,
    target: DropboxAutoUploadTarget,
  ) => {
    if (!enabled) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const content = btoa(binary);

      await invokeDropboxApi('upload-to-lead-folder', {
        entityId: target.entityId,
        entityName: target.entityName,
        entityType: target.entityType,
        companyName: target.companyName || '',
        fileName: file.name,
        content,
      });
    } catch (err) {
      console.warn('Dropbox auto-sync failed:', err);
      throw err;
    }
  }, [enabled]);

  return { syncToDropbox };
}
