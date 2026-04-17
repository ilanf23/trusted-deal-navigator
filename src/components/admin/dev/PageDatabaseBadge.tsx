import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { PageDatabaseDeclaration, TableAccess } from '@/types/pageDatabases';

const accessStyles: Record<TableAccess, { dot: string; chip: string; label: string }> = {
  read: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    label: 'read',
  },
  write: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    label: 'write',
  },
  readwrite: {
    dot: 'bg-violet-500',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    label: 'read/write',
  },
  rpc: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    label: 'rpc',
  },
  realtime: {
    dot: 'bg-fuchsia-500',
    chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
    label: 'realtime',
  },
};

interface PageDatabaseBadgeProps {
  declaration: PageDatabaseDeclaration;
}

export default function PageDatabaseBadge({ declaration }: PageDatabaseBadgeProps) {
  const styles = accessStyles[declaration.access];

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-mono transition-colors hover:border-foreground/30 hover:bg-muted',
          )}
          aria-label={`Database ${declaration.table} (${styles.label})`}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />
          <span className="truncate max-w-[180px]">{declaration.table}</span>
          <Info className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <code className="font-mono text-sm font-semibold">{declaration.table}</code>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide', styles.chip)}>
            {styles.label}
          </span>
        </div>
        <p className="leading-relaxed text-foreground">{declaration.usage}</p>
        {declaration.via && (
          <p className="mt-2 text-muted-foreground">
            <span className="font-semibold">Via:</span>{' '}
            <code className="font-mono text-[11px]">{declaration.via}</code>
          </p>
        )}
        {declaration.notes && (
          <p className="mt-2 text-muted-foreground italic">{declaration.notes}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
