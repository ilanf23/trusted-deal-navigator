import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, ExternalLink, Loader2, Check } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SheetEditorHeaderProps {
  name: string;
  spreadsheetId: string;
  saveStatus: SaveStatus;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function SheetEditorHeader({
  name,
  spreadsheetId,
  saveStatus,
  onBack,
  onRefresh,
  refreshing,
}: SheetEditorHeaderProps) {
  const googleSheetsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  return (
    <div className="h-12 flex items-center justify-between px-3 border-b border-border/50 bg-[#f9fbfd] shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground truncate">{name}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Save status */}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-emerald-600" />
              All changes saved
            </>
          )}
          {saveStatus === 'error' && (
            <span className="text-destructive">Save failed</span>
          )}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>

        <a
          href={googleSheetsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Google Sheets
        </a>
      </div>
    </div>
  );
}
