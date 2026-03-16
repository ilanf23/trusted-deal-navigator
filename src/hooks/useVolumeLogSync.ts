import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncConfig {
  id: string;
  spreadsheet_id: string;
  sheet_name: string | null;
  column_mapping: Record<string, string>;
  header_row: string[] | null;
  last_pull_at: string | null;
  last_push_at: string | null;
}

interface SyncResult {
  success: boolean;
  synced?: number;
  created?: number;
  updated?: number;
  pushed?: number;
  error?: string;
}

export function useVolumeLogSync(teamMemberName?: string) {
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await supabase.functions.invoke('google-sheets-sync', {
        body: { action: 'getConfig', teamMemberName },
      });
      if (response.data?.config) {
        setConfig(response.data.config);
      }
      return response.data?.config ?? null;
    } catch (error) {
      console.error('Failed to load sync config:', error);
      return null;
    } finally {
      setConfigLoading(false);
    }
  }, [teamMemberName]);

  const saveConfig = useCallback(async (
    spreadsheetId: string,
    sheetName: string,
    columnMapping: Record<string, string>,
    headerRow: string[],
  ) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-sync', {
        body: {
          action: 'saveConfig',
          teamMemberName,
          spreadsheetId,
          sheetName,
          columnMapping,
          headerRow,
        },
      });
      if (response.error) throw response.error;
      if (response.data?.config) setConfig(response.data.config);
      toast.success('Sync configuration saved');
      return true;
    } catch (error) {
      console.error('Failed to save sync config:', error);
      toast.error('Failed to save sync configuration');
      return false;
    }
  }, [teamMemberName]);

  const pull = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('google-sheets-sync', {
        body: { action: 'pull', teamMemberName },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data as SyncResult;
      toast.success(`Synced ${result.synced ?? 0} deals from Google Sheets`);
      return result;
    } catch (error: any) {
      console.error('Pull sync failed:', error);
      toast.error(error.message || 'Failed to sync from Google Sheets');
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, [teamMemberName]);

  const push = useCallback(async (leadIds?: string[]): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('google-sheets-sync', {
        body: { action: 'push', teamMemberName, leadIds },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data as SyncResult;
      toast.success(`Pushed ${result.pushed ?? 0} deals to Google Sheets`);
      return result;
    } catch (error: any) {
      console.error('Push sync failed:', error);
      toast.error(error.message || 'Failed to push to Google Sheets');
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, [teamMemberName]);

  const pushCell = useCallback(async (leadId: string, field: string, value: any) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-sync', {
        body: { action: 'updateCell', teamMemberName, leadId, field, value },
      });
      if (response.error) throw response.error;
    } catch (error) {
      console.error('Cell push failed:', error);
      // Don't toast on individual cell pushes — silent failure is fine
    }
  }, [teamMemberName]);

  return {
    syncing,
    config,
    configLoading,
    loadConfig,
    saveConfig,
    pull,
    push,
    pushCell,
  };
}
