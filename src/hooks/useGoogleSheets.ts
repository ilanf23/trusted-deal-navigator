import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getGoogleIntegrationStatus } from '@/lib/googleAuth';

interface Spreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface Sheet {
  id: number;
  title: string;
}

const getFunctionError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return payload.error as string;
    } catch {
      // Use the fallback below.
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export const useGoogleSheets = (teamMemberName?: string, redirectPath?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetData, setSheetData] = useState<string[][]>([]);

  const checkConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const status = await getGoogleIntegrationStatus('sheets');

      if (status.connected) {
        setIsConnected(true);
        setConnectedEmail(status.email || null);
      } else {
        setIsConnected(false);
        setConnectedEmail(null);
      }
    } catch (error) {
      console.error('Error checking sheets connection:', error);
    } finally {
      setLoading(false);
    }
  }, [teamMemberName]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = async () => {
    try {
      // Open popup FIRST — must be synchronous with the user click or browsers block it
      const popup = window.open('about:blank', 'googleSheetsAuth', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site.');
        return;
      }

      popup.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><p>Connecting to Google Sheets...</p></body></html>');

      const redirectUri = `${window.location.origin}${redirectPath || '/superadmin/google-callback'}`;

      const response = await supabase.functions.invoke('google-auth', {
        body: { action: 'getAuthUrl', redirectUri, integration: 'sheets' }
      });

      if (response.error) {
        popup.close();
        throw response.error;
      }

      popup.location.href = response.data.authUrl;

      // Listen for postMessage from the callback page.
      // COOP blocks polling popup.closed once the popup navigates to accounts.google.com.
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.integration && event.data.integration !== 'sheets') return;
        if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
          cleanup();
          toast.error(event.data.error || 'Failed to connect Google Sheets');
          return;
        }
        if (event.data?.type !== 'GOOGLE_CONNECTED') return;
        cleanup();
        checkConnection();
      };
      const cleanup = () => {
        window.removeEventListener('message', messageHandler);
        window.clearTimeout(timeout);
      };
      const timeout = window.setTimeout(cleanup, 5 * 60 * 1000);
      window.addEventListener('message', messageHandler);

    } catch (error) {
      console.error('Error connecting to Google Sheets:', error);
      toast.error('Failed to connect to Google Sheets');
    }
  };

  const disconnect = async () => {
    try {
      const response = await supabase.functions.invoke('google-auth', {
        body: { action: 'disconnect' }
      });

      if (response.error) throw response.error;

      setIsConnected(false);
      setConnectedEmail(null);
      setSpreadsheets([]);
      setSheets([]);
      setSheetData([]);
      toast.success('Disconnected from Google Sheets');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const listSpreadsheets = async () => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'listSpreadsheets', teamMemberName }
      });

      if (response.error) {
        throw new Error(await getFunctionError(response.error, 'Failed to list spreadsheets'));
      }
      if (response.data?.error) throw new Error(response.data.error);

      setSpreadsheets(response.data.spreadsheets || []);
      return response.data.spreadsheets || [];
    } catch (error) {
      console.error('Error listing spreadsheets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to list spreadsheets');
      return [];
    }
  };

  const getSheets = async (spreadsheetId: string) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'getSheets', spreadsheetId, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      setSheets(response.data.sheets || []);
      return response.data.sheets || [];
    } catch (error) {
      console.error('Error getting sheets:', error);
      toast.error('Failed to get sheets');
      return [];
    }
  };

  const getData = async (spreadsheetId: string, sheetName?: string) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'getData', spreadsheetId, sheetName, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      setSheetData(response.data.values || []);
      return response.data.values || [];
    } catch (error) {
      console.error('Error getting data:', error);
      toast.error('Failed to get sheet data');
      return [];
    }
  };

  const updateCell = async (spreadsheetId: string, range: string, value: string) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'updateCell', spreadsheetId, range, value, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    } catch (error) {
      console.error('Error updating cell:', error);
      throw error;
    }
  };

  const updateRow = async (spreadsheetId: string, range: string, rowValues: string[]) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'updateRow', spreadsheetId, range, rowValues, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    } catch (error) {
      console.error('Error updating row:', error);
      throw error;
    }
  };

  const appendRow = async (spreadsheetId: string, rowValues: string[], sheetName?: string) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'appendRow', spreadsheetId, sheetName, rowValues, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    } catch (error) {
      console.error('Error appending row:', error);
      throw error;
    }
  };

  const batchUpdateCells = async (spreadsheetId: string, updates: { range: string; value: string }[]) => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'batchUpdateCells', spreadsheetId, updates, teamMemberName }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    } catch (error) {
      console.error('Error batch updating cells:', error);
      throw error;
    }
  };

  return {
    isConnected,
    connectedEmail,
    loading,
    spreadsheets,
    sheets,
    sheetData,
    connect,
    disconnect,
    listSpreadsheets,
    getSheets,
    getData,
    updateCell,
    updateRow,
    appendRow,
    batchUpdateCells,
    checkConnection,
  };
};
