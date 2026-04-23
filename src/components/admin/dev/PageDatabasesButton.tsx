import { useState } from 'react';
import { Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import type { TableAccess } from '@/types/pageDatabases';

const accessStyles: Record<TableAccess, { label: string; chip: string; dot: string }> = {
  read: { label: 'read', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', dot: 'bg-sky-500' },
  write: { label: 'write', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', dot: 'bg-amber-500' },
  readwrite: { label: 'read/write', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', dot: 'bg-violet-500' },
  rpc: { label: 'rpc', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', dot: 'bg-emerald-500' },
  realtime: { label: 'realtime', chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200', dot: 'bg-fuchsia-500' },
};

export default function PageDatabasesButton() {
  const [open, setOpen] = useState(false);
  const { pageDatabases, pageTitle } = useAdminTopBar();

  if (!pageDatabases || pageDatabases.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-yellow-400 bg-yellow-200 px-2.5 py-1 text-xs font-semibold text-yellow-900 shadow-sm transition-colors hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200 dark:hover:bg-yellow-900/50',
        )}
        aria-label={`Databases used on this page (${pageDatabases.length})`}
      >
        <Database className="h-3.5 w-3.5" />
        <span>Databases</span>
        <span className="rounded-full bg-yellow-300/90 px-1.5 text-[10px] font-bold leading-4 text-yellow-950 dark:bg-yellow-700/70 dark:text-yellow-100">
          {pageDatabases.length}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-yellow-600" />
              Databases used on {pageTitle ? `"${pageTitle}"` : 'this page'}
            </DialogTitle>
            <DialogDescription>
              Supabase tables, edge functions, and RPCs this page reads from or writes to. Use it as a map while refactoring.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {pageDatabases.map((decl, idx) => {
              const styles = accessStyles[decl.access];
              return (
                <div
                  key={`${decl.table}-${idx}`}
                  className="rounded-md border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', styles.dot)} />
                      <code className="font-mono text-sm font-semibold truncate">{decl.table}</code>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        styles.chip,
                      )}
                    >
                      {styles.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{decl.usage}</p>
                  {decl.via && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-semibold">Via:</span>{' '}
                      <code className="font-mono text-[11px]">{decl.via}</code>
                    </p>
                  )}
                  {decl.notes && (
                    <p className="mt-1.5 text-xs italic text-muted-foreground">{decl.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
