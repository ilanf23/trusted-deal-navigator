import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Spreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface Sheet {
  id: number;
  title: string;
}

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

      const response = await supabase.functions.invoke('google-sheets-auth', {
        body: { action: 'getStatus', teamMemberName }
      });

      if (response.data?.connected) {
        setIsConnected(true);
        setConnectedEmail(response.data.email);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        return;
      }

      // Open popup immediately to avoid blockers
      const popup = window.open('about:blank', 'googleSheetsAuth', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site.');
        return;
      }

      popup.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><p>Connecting to Google Sheets...</p></body></html>');

      const redirectUri = `${window.location.origin}${redirectPath || '/superadmin/sheets-callback'}`;

      const response = await supabase.functions.invoke('google-sheets-auth', {
        body: { action: 'getAuthUrl', redirectUri, teamMemberName }
      });

      if (response.error) {
        popup.close();
        throw response.error;
      }

      popup.location.href = response.data.authUrl;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(pollInterval);
            await checkConnection();
          }
        } catch {
          // Cross-origin errors are expected
        }
      }, 500);

    } catch (error) {
      console.error('Error connecting to Google Sheets:', error);
      toast.error('Failed to connect to Google Sheets');
    }
  };

  const disconnect = async () => {
    try {
      const response = await supabase.functions.invoke('google-sheets-auth', {
        body: { action: 'disconnect', teamMemberName }
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

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      setSpreadsheets(response.data.spreadsheets || []);
      return response.data.spreadsheets || [];
    } catch (error) {
      console.error('Error listing spreadsheets:', error);
      toast.error('Failed to list spreadsheets');
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
    checkConnection,
  };
};
