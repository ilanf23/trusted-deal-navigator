import { Database } from 'lucide-react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useSplitView } from '@/contexts/SplitViewContext';
import PageDatabaseBadge from './PageDatabaseBadge';

export default function PageDatabaseBadges() {
  const { pageDatabases } = useAdminTopBar();
  const { isOwner } = useTeamMember();
  const { isActive: splitViewActive } = useSplitView();

  if (!isOwner) return null;
  if (splitViewActive) return null;
  if (!pageDatabases || pageDatabases.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/40 px-3 md:px-4 lg:pl-4 lg:pr-8 py-1.5 flex items-center gap-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        <span>DB</span>
        <span className="text-muted-foreground/60">({pageDatabases.length})</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {pageDatabases.map((decl) => (
          <PageDatabaseBadge key={`${decl.table}-${decl.access}-${decl.usage}`} declaration={decl} />
        ))}
      </div>
    </div>
  );
}
