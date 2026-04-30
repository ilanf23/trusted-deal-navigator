import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface TopActionsProps {
  evanId?: string;
}

interface ActionItem {
  id: string;
  leadId: string;
  leadName: string;
  companyName?: string;
  action: string;
  actionType: 'call' | 'email' | 'document' | 'follow_up' | 'close';
  waitingTime: number; // in hours
  dueDate?: string;
  status: string;
  loanAmount?: number;
  phone?: string;
  email?: string;
  taskId?: string;
}

export const TopActions = ({ evanId }: TopActionsProps) => {
  const navigate = useNavigate();

  type OverdueTaskLead = {
    id: string;
    name: string | null;
    company_name: string | null;
    status: string;
    email: string | null;
    phone: string | null;
    deal_value: number | null;
    potential_revenue: number | null;
  };
  type OverdueTask = {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    priority: string | null;
    status: string | null;
    lead_id: string | null;
    lead: OverdueTaskLead | null;
  };

  const { data: tasks, isLoading } = useQuery<OverdueTask[]>({
    queryKey: ['top-actions-overdue', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, due_date, priority, status, lead_id,
          lead:potential(
            id, name, company_name, status, email, phone,
            deal_value, potential_revenue
          )
        `)
        .eq('user_id', evanId!)
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as unknown as OverdueTask[];
    },
    enabled: !!evanId,
  });

  const actions = useMemo<ActionItem[]>(() => {
    if (!tasks) return [];
    return tasks.map((task) => {
      const lead = task.lead;
      return {
        id: `task-${task.id}`,
        leadId: lead?.id ?? '',
        leadName: lead?.name ?? 'General Task',
        companyName: lead?.company_name ?? undefined,
        action: task.title,
        actionType: 'follow_up',
        waitingTime: 0,
        dueDate: task.due_date ?? undefined,
        status: lead?.status ?? 'discovery',
        loanAmount: lead?.deal_value ?? undefined,
        phone: lead?.phone ?? undefined,
        email: lead?.email ?? undefined,
        taskId: task.id,
      };
    });
  }, [tasks]);

  const formatWaitingTime = (hours: number) => {
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getActionUrl = (item: ActionItem): string => {
    switch (item.actionType) {
      case 'email':
        if (item.leadId) {
          const params = new URLSearchParams({ compose: 'true', leadId: item.leadId });
          if (item.taskId) params.set('taskId', item.taskId);
          return `/admin/gmail?${params.toString()}`;
        }
        if (item.email) return `/admin/gmail?compose=new&to=${encodeURIComponent(item.email)}`;
        return '/admin/gmail';

      case 'call':
        if (item.phone) {
          const params = new URLSearchParams({ phone: item.phone });
          if (item.leadId) params.set('leadId', item.leadId);
          return `/admin/calls?${params.toString()}`;
        }
        return '/admin/calls';

      case 'document':
        // Document requests are best handled via email with context
        if (item.leadId) {
          return `/admin/gmail?compose=true&leadId=${item.leadId}&template=follow_up`;
        }
        return '/admin/leads';

      case 'close':
        // Close actions → pipeline view for deal progression
        if (item.phone) {
          const params = new URLSearchParams({ phone: item.phone });
          if (item.leadId) params.set('leadId', item.leadId);
          return `/admin/calls?${params.toString()}`;
        }
        return '/admin/pipeline/potential';

      case 'follow_up':
        // Tasks: use email with AI suggestions if lead exists, otherwise calls
        if (item.leadId && item.taskId) {
          return `/admin/gmail?compose=true&leadId=${item.leadId}&taskId=${item.taskId}`;
        }
        if (item.leadId) {
          return `/admin/gmail?compose=true&leadId=${item.leadId}`;
        }
        return '/admin/leads';

      default:
        return '/admin/leads';
    }
  };

  const getDestinationLabel = (item: ActionItem): string => {
    switch (item.actionType) {
      case 'email': return 'Email';
      case 'call': return 'Call';
      case 'document': return 'Email';
      case 'close': return item.phone ? 'Call' : 'Pipeline';
      case 'follow_up': return 'Email';
      default: return 'Open';
    }
  };

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    pre_qualification: 'Pre-Qual',
    document_collection: 'Docs',
    underwriting: 'UW',
    approval: 'Approval',
  };

  const openAction = (item: ActionItem) => {
    navigate(getActionUrl(item));
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#eee6f6', borderBottom: '1px solid #d8cee6' }}>
        <div>
          <h3 className="text-sm font-semibold leading-none" style={{ color: '#3b2778' }}>Top Actions</h3>
          <p className="mt-1 text-xs leading-none" style={{ color: 'rgba(59, 39, 120, 0.62)' }}>
            {actions.length} item{actions.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : actions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm font-medium">All caught up</p>
        </div>
      ) : (
        <ScrollArea className="h-[460px]">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {['#', 'Action', 'Go to', 'Stage', 'Timing'].map((label) => (
                  <th key={label} className="border-b px-4 py-2.5 text-left text-xs font-medium" style={{ backgroundColor: '#eee6f6', borderColor: '#d8cee6', color: '#3b2778' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((item, index) => {
                const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
                const destination = getDestinationLabel(item);

                return (
                  <tr
                    key={item.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[-2px]"
                    style={{ borderColor: '#ece6f3' }}
                    onClick={() => openAction(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openAction(item);
                      }
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f6f1fb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <td className="w-12 px-4 py-3 align-middle text-xs font-medium tabular-nums" style={{ color: 'rgba(59, 39, 120, 0.72)' }}>
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium leading-5 text-foreground">
                          {item.action}
                        </div>
                        <div className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
                          {item.leadName}
                          {item.companyName && ` · ${item.companyName}`}
                          {item.loanAmount ? ` · ${formatCurrency(item.loanAmount)}` : ''}
                        </div>
                      </div>
                    </td>

                    <td className="w-24 px-4 py-3 align-middle text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {destination}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </td>

                    <td className="w-32 px-4 py-3 align-middle text-[13px] text-foreground">
                      <span className="whitespace-nowrap">{stageLabels[item.status] || item.status}</span>
                    </td>

                    <td className="w-36 px-4 py-3 align-middle text-[13px]">
                      {item.dueDate ? (
                        <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
                          <span className="font-medium text-foreground">{format(new Date(item.dueDate), 'MMM d')}</span>
                          {isOverdue && <span className="text-xs text-muted-foreground">Past due</span>}
                        </span>
                      ) : item.waitingTime > 0 ? (
                        <span className="whitespace-nowrap text-foreground">
                          {formatWaitingTime(item.waitingTime)} ago
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default TopActions;
