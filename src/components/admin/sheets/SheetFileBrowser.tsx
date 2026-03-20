import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, Unlink, RefreshCw } from 'lucide-react';
import { SheetFileCard } from './SheetFileCard';

interface Spreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface SheetFileBrowserProps {
  spreadsheets: Spreadsheet[];
  connectedEmail: string | null;
  loading: boolean;
  onOpen: (id: string, name: string) => void;
  onDisconnect: () => void;
  onRefresh: () => Promise<Spreadsheet[]>;
}

export function SheetFileBrowser({
  spreadsheets,
  connectedEmail,
  loading,
  onOpen,
  onDisconnect,
  onRefresh,
}: SheetFileBrowserProps) {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = search
    ? spreadsheets.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    : spreadsheets;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Google Sheets
          </h1>
          {connectedEmail && (
            <p className="text-muted-foreground mt-1 text-sm">
              Connected as {connectedEmail}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Unlink className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search spreadsheets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-xl bg-background border-border/50"
        />
      </div>

      {/* File grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
              <Skeleton className="w-full aspect-[4/3]" />
              <div className="px-3 py-2.5 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
            <FileSpreadsheet className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? 'No spreadsheets match your search.' : 'No spreadsheets found in your Google Drive.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((s) => (
            <SheetFileCard
              key={s.id}
              name={s.name}
              modifiedTime={s.modifiedTime}
              onClick={() => onOpen(s.id, s.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
