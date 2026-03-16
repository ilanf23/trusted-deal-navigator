import { useState, useEffect, useCallback } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Settings,
  Loader2,
  Unlink,
  Check,
} from 'lucide-react';

const STORAGE_KEY_PREFIX = 'scoresheet-selection-';

function colIndexToLetter(index: number): string {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

const ScoreSheet = () => {
  const { teamMember } = useTeamMember();
  const name = teamMember?.name;
  const googleSheets = useGoogleSheets(name, '/admin/sheets-callback');

  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const storageKey = teamMember?.id ? `${STORAGE_KEY_PREFIX}${teamMember.id}` : null;

  // Load persisted selection
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { spreadsheetId: sid, sheetName: sn } = JSON.parse(saved);
        if (sid) setSpreadsheetId(sid);
        if (sn) setSheetName(sn);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Persist selection
  const persistSelection = useCallback((sid: string, sn: string) => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify({ spreadsheetId: sid, sheetName: sn }));
  }, [storageKey]);

  // Load spreadsheets when connected and in settings or no selection yet
  useEffect(() => {
    if (googleSheets.isConnected && !googleSheets.loading && googleSheets.spreadsheets.length === 0) {
      setLoadingSpreadsheets(true);
      googleSheets.listSpreadsheets().finally(() => setLoadingSpreadsheets(false));
    }
  }, [googleSheets.isConnected, googleSheets.loading]);

  // Load sheets when spreadsheet selected
  useEffect(() => {
    if (spreadsheetId && googleSheets.isConnected) {
      setLoadingSheets(true);
      googleSheets.getSheets(spreadsheetId).finally(() => setLoadingSheets(false));
    }
  }, [spreadsheetId, googleSheets.isConnected]);

  // Load data when sheet selected
  useEffect(() => {
    if (spreadsheetId && sheetName && googleSheets.isConnected) {
      setLoadingData(true);
      googleSheets.getData(spreadsheetId, sheetName).finally(() => setLoadingData(false));
    }
  }, [spreadsheetId, sheetName, googleSheets.isConnected]);

  const handleSpreadsheetChange = (id: string) => {
    setSpreadsheetId(id);
    setSheetName('');
    persistSelection(id, '');
  };

  const handleSheetChange = (name: string) => {
    setSheetName(name);
    persistSelection(spreadsheetId, name);
  };

  const handleRefresh = async () => {
    if (!spreadsheetId || !sheetName) return;
    setLoadingData(true);
    await googleSheets.getData(spreadsheetId, sheetName);
    setLoadingData(false);
  };

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    // rowIdx is 1-based (data rows), header is row 0
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(googleSheets.sheetData[rowIdx]?.[colIdx] ?? '');
  };

  const handleCellSave = async () => {
    if (!editingCell || !spreadsheetId || !sheetName) return;
    const { row, col } = editingCell;
    const colLetter = colIndexToLetter(col);
    const range = `${sheetName}!${colLetter}${row + 1}`;

    setSaving(true);
    try {
      await googleSheets.updateCell(spreadsheetId, range, editValue);
      // Update local state
      const newData = [...googleSheets.sheetData];
      if (!newData[row]) newData[row] = [];
      newData[row][col] = editValue;
      // sheetData is managed by the hook, so refresh
      await googleSheets.getData(spreadsheetId, sheetName);
      toast.success('Cell updated');
    } catch {
      toast.error('Failed to update cell');
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const headers = googleSheets.sheetData[0] || [];
  const dataRows = googleSheets.sheetData.slice(1);
  const hasSelection = spreadsheetId && sheetName;
  const showSelector = !hasSelection || showSettings;

  // Loading state
  if (googleSheets.loading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  // Not connected state
  if (!googleSheets.isConnected) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm w-full">
            <CardContent className="flex flex-col items-center gap-5 py-10 px-6">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <FileSpreadsheet className="h-7 w-7 text-white" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">Connect Google Sheets</h2>
                <p className="text-sm text-muted-foreground">
                  Link your Google account to view and edit spreadsheets.
                </p>
              </div>
              <Button onClick={googleSheets.connect} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Link2 className="h-4 w-4" />
                Connect Google Sheets
              </Button>
            </CardContent>
          </Card>
        </div>
      </EvanLayout>
    );
  }

  return (
    <EvanLayout>
      <div className="space-y-5 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Score Sheet</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {googleSheets.connectedEmail && (
                <span>Connected as {googleSheets.connectedEmail}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingData} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={googleSheets.disconnect}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Sheet selector */}
        {showSelector && (
          <Card className="border border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Spreadsheet</label>
                {loadingSpreadsheets ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={spreadsheetId} onValueChange={handleSpreadsheetChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose a spreadsheet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {googleSheets.spreadsheets.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {spreadsheetId && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Sheet Tab</label>
                  {loadingSheets ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Select value={sheetName} onValueChange={handleSheetChange}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Choose a sheet tab..." />
                      </SelectTrigger>
                      <SelectContent>
                        {googleSheets.sheets.map((s) => (
                          <SelectItem key={s.id} value={s.title} className="text-sm">
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {hasSelection && showSettings && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowSettings(false)} className="gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Data table */}
        {hasSelection && !showSettings && (
          loadingData ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : headers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No data found in this sheet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-x-auto bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    {headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap text-xs"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      {headers.map((_, colIdx) => {
                        const actualRowIdx = rowIdx + 1; // offset for header
                        const isEditing = editingCell?.row === actualRowIdx && editingCell?.col === colIdx;
                        return (
                          <td
                            key={colIdx}
                            className="px-3 py-1.5 text-foreground/90 whitespace-nowrap max-w-[200px] cursor-pointer"
                            onClick={() => !isEditing && handleCellClick(actualRowIdx, colIdx)}
                          >
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={handleCellKeyDown}
                                autoFocus
                                disabled={saving}
                                className="h-7 text-xs px-1.5 py-0"
                              />
                            ) : (
                              <span className="truncate block text-xs">
                                {row[colIdx] ?? ''}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </EvanLayout>
  );
};

export default ScoreSheet;
