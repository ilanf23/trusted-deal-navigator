import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Link2, Loader2 } from 'lucide-react';
import { SheetFileBrowser } from '@/components/admin/sheets/SheetFileBrowser';
import { SheetEditor } from '@/components/admin/sheets/SheetEditor';

const STORAGE_KEY_PREFIX = 'scoresheet-file-';

type View = 'browser' | 'editor';

const ScoreSheet = () => {
  const { teamMember } = useTeamMember();
  const name = teamMember?.name;
  const googleSheets = useGoogleSheets(name, '/admin/sheets-callback');

  const [view, setView] = useState<View>('browser');
  const [activeFile, setActiveFile] = useState<{ id: string; name: string } | null>(null);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);

  const storageKey = teamMember?.id ? `${STORAGE_KEY_PREFIX}${teamMember.id}` : null;

  // Load persisted file selection
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id && parsed?.name) {
          setActiveFile(parsed);
          setView('editor');
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Persist file selection
  const persistFile = useCallback(
    (file: { id: string; name: string } | null) => {
      if (!storageKey) return;
      if (file) {
        localStorage.setItem(storageKey, JSON.stringify(file));
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [storageKey]
  );

  // Load spreadsheets when connected
  useEffect(() => {
    if (googleSheets.isConnected && !googleSheets.loading && googleSheets.spreadsheets.length === 0) {
      setLoadingSpreadsheets(true);
      googleSheets.listSpreadsheets().finally(() => setLoadingSpreadsheets(false));
    }
  }, [googleSheets.isConnected, googleSheets.loading]);

  const handleOpen = (id: string, fileName: string) => {
    const file = { id, name: fileName };
    setActiveFile(file);
    setView('editor');
    persistFile(file);
  };

  const handleBack = () => {
    setView('browser');
    setActiveFile(null);
    persistFile(null);
  };

  // Loading auth state
  if (googleSheets.loading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  // Not connected
  if (!googleSheets.isConnected) {
    return (
      <EmployeeLayout>
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
      </EmployeeLayout>
    );
  }

  // Editor view — full viewport
  if (view === 'editor' && activeFile) {
    return (
      <EmployeeLayout>
        <div className="h-[calc(100vh-4rem)] -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 md:-mx-6 md:-mb-6 lg:-mx-8 lg:-mb-8 xl:-mx-10 xl:-mb-10">
          <SheetEditor
            spreadsheetId={activeFile.id}
            spreadsheetName={activeFile.name}
            teamMemberName={name}
            onBack={handleBack}
          />
        </div>
      </EmployeeLayout>
    );
  }

  // File browser view
  return (
    <EmployeeLayout>
      <SheetFileBrowser
        spreadsheets={googleSheets.spreadsheets}
        connectedEmail={googleSheets.connectedEmail}
        loading={loadingSpreadsheets}
        onOpen={handleOpen}
        onDisconnect={googleSheets.disconnect}
        onRefresh={googleSheets.listSpreadsheets}
      />
    </EmployeeLayout>
  );
};

export default ScoreSheet;
