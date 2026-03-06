import { useCallback } from 'react';
import { invokeDropboxApi } from './useDropbox';

export function useDropboxAutoUpload(enabled: boolean) {
  const syncToDropbox = useCallback(async (
    file: File,
    leadName: string,
    companyName: string,
    leadId: string,
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
        leadName,
        companyName,
        leadId,
        fileName: file.name,
        content,
      });
    } catch (err) {
      console.warn('Dropbox auto-sync failed (non-blocking):', err);
    }
  }, [enabled]);

  return { syncToDropbox };
}
