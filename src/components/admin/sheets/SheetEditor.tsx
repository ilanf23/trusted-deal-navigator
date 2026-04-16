import { useState, useEffect, useCallback, useRef } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import './sheets-overrides.css';
import type { Sheet } from '@fortune-sheet/core';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SheetEditorHeader, type SaveStatus } from './SheetEditorHeader';
import { toFortuneSheet, diffSheetChanges } from './sheetsDataConverter';
import { supabase } from '@/integrations/supabase/client';

interface SheetEditorProps {
  spreadsheetId: string;
  spreadsheetName: string;
  teamMemberName?: string;
  onBack: () => void;
}

export function SheetEditor({
  spreadsheetId,
  spreadsheetName,
  teamMemberName,
  onBack,
}: SheetEditorProps) {
  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const previousDataRef = useRef<Sheet[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalSaveAtRef = useRef<number>(0);
  const ECHO_SUPPRESS_MS = 5000;

  // Single API call to get all sheet tabs + data
  const loadAllData = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke('google-sheets-api', {
        body: { action: 'getAllData', spreadsheetId, teamMemberName },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      const sheetsWithData = response.data.sheets || [];

      if (sheetsWithData.length === 0) {
        const empty = [{ name: 'Sheet1', index: '0', celldata: [], order: 0, row: 100, column: 26 } as Sheet];
        setSheetData(empty);
        previousDataRef.current = empty;
        setLoading(false);
        return;
      }

      const allSheets: Sheet[] = sheetsWithData.map(
        (s: { id: number; title: string; values: string[][] }, i: number) =>
          toFortuneSheet(s.values || [], s.title, i)
      );

      setSheetData(allSheets);
      previousDataRef.current = allSheets;
    } catch (err) {
      console.error('Failed to load sheets:', err);
      toast.error('Failed to load spreadsheet data');
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, teamMemberName]);

  useEffect(() => {
    loadAllData();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadAllData]);

  // Start a Drive watch on mount; stop it on unmount. Subscribe to change events
  // via Supabase Realtime and refetch when external edits are detected (echo-suppressed).
  useEffect(() => {
    let cancelled = false;
    let renewTimer: ReturnType<typeof setTimeout> | null = null;

    const startWatch = async () => {
      try {
        const { error } = await supabase.functions.invoke('sheets-watch-start', {
          body: { spreadsheetId, teamMemberName },
        });
        if (error) console.warn('sheets-watch-start failed:', error);
      } catch (err) {
        console.warn('sheets-watch-start threw:', err);
      }
    };

    startWatch();
    // Belt-and-suspenders renewal in case a session runs past the 6d 23h watch expiry.
    renewTimer = setTimeout(startWatch, 6 * 24 * 60 * 60 * 1000);

    const channel = supabase
      .channel(`sheets-changes-${spreadsheetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sheets_change_events',
          filter: `spreadsheet_id=eq.${spreadsheetId}`,
        },
        () => {
          if (cancelled) return;
          if (Date.now() - lastLocalSaveAtRef.current < ECHO_SUPPRESS_MS) return;
          loadAllData();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (renewTimer) clearTimeout(renewTimer);
      supabase.removeChannel(channel);
      // Fire-and-forget stop. We don't await because the user is navigating away.
      supabase.functions
        .invoke('sheets-watch-stop', { body: { teamMemberName } })
        .catch((err) => console.warn('sheets-watch-stop failed:', err));
    };
  }, [spreadsheetId, teamMemberName, loadAllData]);

  const batchSave = useCallback(
    async (updates: { range: string; value: string }[]) => {
      if (updates.length === 0) return;
      lastLocalSaveAtRef.current = Date.now();
      setSaveStatus('saving');
      try {
        const response = await supabase.functions.invoke('google-sheets-api', {
          body: {
            action: 'batchUpdateCells',
            spreadsheetId,
            updates,
            teamMemberName,
          },
        });
        if (response.error || response.data?.error) {
          throw new Error(response.data?.error || 'Save failed');
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
      } catch (err) {
        console.error('Batch save failed:', err);
        setSaveStatus('error');
        toast.error('Failed to save changes');
      }
    },
    [spreadsheetId, teamMemberName]
  );

  const handleChange = useCallback(
    (updatedData: Sheet[]) => {
      setSheetData(updatedData);

      // Debounced auto-save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const changes = diffSheetChanges(previousDataRef.current, updatedData);
        if (changes.length > 0) {
          batchSave(changes);
          previousDataRef.current = updatedData;
        }
      }, 2000);
    },
    [batchSave]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading spreadsheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetEditorHeader
        name={spreadsheetName}
        spreadsheetId={spreadsheetId}
        saveStatus={saveStatus}
        onBack={onBack}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      <div className="fortune-sheet-container flex-1 min-h-0">
        <Workbook
          data={sheetData}
          onChange={handleChange}
          lang="en"
          showToolbar={true}
          showFormulaBar={true}
          showSheetTabs={true}
          defaultFontSize={10}
          rowHeaderWidth={46}
          columnHeaderHeight={20}
          toolbarItems={[
            'undo',
            'redo',
            '|',
            'format-painter',
            'clear-format',
            '|',
            'currency-format',
            'percentage-format',
            'number-decrease',
            'number-increase',
            '|',
            'font-family',
            'font-size',
            '|',
            'bold',
            'italic',
            'underline',
            'strike-through',
            '|',
            'font-color',
            'background',
            'border',
            '|',
            'merge-cell',
            'horizontal-align',
            'vertical-align',
            'text-wrap',
            '|',
            'freeze',
            'sort',
            'filter',
            'formula',
          ]}
          cellContextMenu={[
            'copy',
            'paste',
            '|',
            'insert-row',
            'insert-column',
            'delete-row',
            'delete-column',
            '|',
            'clear',
            'sort',
            'orderAZ',
            'orderZA',
          ]}
          sheetTabContextMenu={['delete', 'copy', 'rename', 'color', 'hide', '|', 'move']}
        />
      </div>
    </div>
  );
}
