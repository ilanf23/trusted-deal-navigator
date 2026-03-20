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

  const batchSave = useCallback(
    async (updates: { range: string; value: string }[]) => {
      if (updates.length === 0) return;
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
