import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

export default function PageDatabasesDot() {
  const [open, setOpen] = useState(false);
  const { pageDatabases, pageTitle } = useAdminTopBar();
  const { pathname } = useLocation();

  const inSalesRepPortal = pathname.startsWith('/admin/') || pathname === '/admin';
  const hasDecls = !!pageDatabases && pageDatabases.length > 0;
  const visible = inSalesRepPortal && hasDecls;

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  if (!visible) return null;

  const count = pageDatabases!.length;
  const tooltipLabel = `${count} ${count === 1 ? 'database' : 'databases'} on this page · ⌘⇧D`;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={tooltipLabel}
              className={cn(
                'fixed bottom-4 right-4 z-50',
                'inline-flex items-center gap-1 rounded-full',
                'border border-yellow-500/70 bg-yellow-300/90 text-yellow-950',
                'px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-md',
                'transition-all hover:scale-110 hover:bg-yellow-300 hover:shadow-lg',
                'focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1',
                'dark:border-yellow-600/70 dark:bg-yellow-500/90 dark:text-yellow-950',
                'dark:hover:bg-yellow-400',
              )}
            >
              <Database className="h-2.5 w-2.5" />
              <span>{count}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{tooltipLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
            {pageDatabases!.map((decl, idx) => {
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
