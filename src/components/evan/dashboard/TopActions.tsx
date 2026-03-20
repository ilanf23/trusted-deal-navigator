import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  Phone, 
  FileText, 
  Mail,
  ArrowRight,
  Target,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { differenceInDays, differenceInHours, format } from 'date-fns';
import { Link } from 'react-router-dom';

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
  impact: string;
  urgencyScore: number;
  closeProximity: number; // 1-5, 5 = closest to closing
  blockerSeverity: number; // 1-5, 5 = most severe
  waitingTime: number; // in hours
  dueDate?: string;
  status: string;
  loanAmount?: number;
  phone?: string;
  email?: string;
  taskId?: string;
}

const ACTION_ICONS = {
  call: Phone,
  email: Mail,
  document: FileText,
  follow_up: Clock,
  close: Target,
};

const STAGE_CLOSE_PROXIMITY: Record<string, number> = {
  approval: 5,
  underwriting: 4,
  document_collection: 3,
  pre_qualification: 2,
  discovery: 1,
};

export const TopActions = ({ evanId }: TopActionsProps) => {
  // Fetch leads with their communications and responses
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['evan-top-actions', evanId],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          company_name,
          status,
          updated_at,
          created_at,
          email,
          phone,
          lead_responses (
            loan_amount,
            funding_timeline
          )
        `)
        .eq('assigned_to', evanId)
        .neq('status', 'funded')
        .order('updated_at', { ascending: true });

      if (error) throw error;
      return leads;
    },
    enabled: !!evanId,
  });

  // Fetch recent communications
  const { data: communications } = useQuery({
    queryKey: ['evan-lead-communications', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id, created_at, communication_type, direction')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!evanId,
  });

  // Fetch pending tasks per lead
  const { data: tasks } = useQuery({
    queryKey: ['evan-lead-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, due_date, priority, description, lead_id')
        .eq('is_completed', false)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const actions = useMemo(() => {
    if (!leadsData) return [];

    const now = new Date();
    const actionsList: ActionItem[] = [];

    // First, add pending tasks as actions (these take priority when they have due dates)
    tasks?.forEach((task) => {
      // Find the associated lead if any
      const leadId = (task as any).lead_id;
      const lead = leadId ? leadsData.find(l => l.id === leadId) : null;
      
      actionsList.push({
        id: `task-${task.id}`,
        leadId: leadId || '',
        leadName: lead?.name || 'General Task',
        companyName: lead?.company_name || undefined,
        action: task.title,
        actionType: 'follow_up',
        impact: task.description || 'Complete this task',
        urgencyScore: task.priority === 'high' ? 5 : task.priority === 'medium' ? 3 : 1,
        closeProximity: lead ? STAGE_CLOSE_PROXIMITY[lead.status] || 1 : 1,
        blockerSeverity: task.priority === 'high' ? 4 : 2,
        waitingTime: 0,
        dueDate: task.due_date || undefined,
        status: lead?.status || 'discovery',
        loanAmount: lead?.lead_responses?.[0]?.loan_amount || undefined,
        phone: lead?.phone || undefined,
        email: lead?.email || undefined,
        taskId: task.id,
      });
    });

    leadsData.forEach((lead) => {
      const lastComm = communications?.find((c) => c.lead_id === lead.id);
      const hoursSinceContact = lastComm 
        ? differenceInHours(now, new Date(lastComm.created_at))
        : differenceInHours(now, new Date(lead.created_at));
      
      const daysSinceUpdate = differenceInDays(now, new Date(lead.updated_at));
      const closeProximity = STAGE_CLOSE_PROXIMITY[lead.status] || 1;
      const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
      const isHighValue = loanAmount >= 500000;

      // Determine action type and blocker severity based on status and timing
      let action = '';
      let actionType: ActionItem['actionType'] = 'follow_up';
      let blockerSeverity = 1;
      let impact = '';

      // Status-based actions
      if (lead.status === 'ready_for_wu_approval' || lead.status === 'pre_approval_issued' || lead.status === 'approval') {
        if (daysSinceUpdate > 2) {
          action = 'Push for final approval signature';
          actionType = 'close';
          blockerSeverity = 5;
          impact = 'Close this deal today';
        } else {
          action = 'Confirm closing requirements met';
          actionType = 'call';
          blockerSeverity = 4;
          impact = 'Removes final friction to close';
        }
      } else if (lead.status === 'underwriting') {
        if (daysSinceUpdate > 5) {
          action = 'Follow up with underwriter for status';
          actionType = 'call';
          blockerSeverity = 4;
          impact = 'Unblocks stalled underwriting';
        } else if (hoursSinceContact > 48) {
          action = 'Check in on underwriting progress';
          actionType = 'email';
          blockerSeverity = 3;
          impact = 'Keeps deal moving forward';
        }
      } else if (lead.status === 'onboarding' || lead.status === 'document_collection') {
        if (daysSinceUpdate > 3) {
          action = 'Request missing documents';
          actionType = 'document';
          blockerSeverity = 4;
          impact = 'Unblocks document bottleneck';
        } else if (hoursSinceContact > 24) {
          action = 'Follow up on document submission';
          actionType = 'call';
          blockerSeverity = 3;
          impact = 'Accelerates doc collection';
        }
      } else if (lead.status === 'moving_to_underwriting' || lead.status === 'pre_qualification') {
        if (hoursSinceContact > 72) {
          action = 'Re-engage with qualification call';
          actionType = 'call';
          blockerSeverity = 3;
          impact = 'Prevents lead from going cold';
        } else if (daysSinceUpdate > 5) {
          action = 'Send pre-qualification summary';
          actionType = 'email';
          blockerSeverity = 2;
          impact = 'Moves to onboarding';
        }
      } else if (lead.status === 'initial_review' || lead.status === 'discovery') {
        if (hoursSinceContact > 24 && hoursSinceContact < 72) {
          action = 'Schedule discovery call';
          actionType = 'call';
          blockerSeverity = 2;
          impact = 'Starts relationship building';
        } else if (hoursSinceContact >= 72) {
          action = 'Send re-engagement email';
          actionType = 'email';
          blockerSeverity = 3;
          impact = 'Prevents lead from going cold';
        }
      }

      // Skip if no action determined
      if (!action) return;

      // Calculate urgency score
      // Higher = more urgent
      // Factors: close proximity (40%), blocker severity (35%), waiting time (25%)
      const waitingScore = Math.min(hoursSinceContact / 24, 10) / 2; // Max 5 for 10+ days
      const urgencyScore = 
        (closeProximity * 0.4) + 
        (blockerSeverity * 0.35) + 
        (waitingScore * 0.25);

      // Boost high-value deals
      const finalUrgency = isHighValue ? urgencyScore * 1.2 : urgencyScore;

      actionsList.push({
        id: `${lead.id}-action`,
        leadId: lead.id,
        leadName: lead.name,
        companyName: lead.company_name || undefined,
        action,
        actionType,
        impact,
        urgencyScore: finalUrgency,
        closeProximity,
        blockerSeverity,
        waitingTime: hoursSinceContact,
        status: lead.status,
        loanAmount: loanAmount || undefined,
        phone: lead.phone || undefined,
        email: lead.email || undefined,
      });
    });

    // Sort by due date (soonest first), then by urgency score for items without due dates
    return actionsList
      .sort((a, b) => {
        // Items with due dates come first, sorted chronologically (soonest first)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        // Items with due dates come before items without
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        // For items without due dates, sort by urgency score (highest first)
        return b.urgencyScore - a.urgencyScore;
      })
      .slice(0, 10);
  }, [leadsData, communications, tasks]);

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

  const getStageColor = (status: string) => {
    switch (status) {
      case 'approval': return 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400';
      case 'underwriting': return 'bg-primary/10 text-primary';
      case 'document_collection': return 'bg-muted text-muted-foreground';
      case 'pre_qualification': return 'bg-muted text-muted-foreground';
      case 'discovery': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getUrgencyIndicator = (score: number) => {
    if (score >= 4) return { color: 'text-destructive', label: 'Critical' };
    if (score >= 3) return { color: 'text-primary', label: 'High' };
    if (score >= 2) return { color: 'text-muted-foreground', label: 'Medium' };
    return { color: 'text-muted-foreground/60', label: 'Low' };
  };

  // Build the deep-link URL based on action type and available contact info
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
        return '/admin/pipeline';

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

  // Short label showing where the action link goes
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

  // Helper to truncate and clean impact text
  const formatImpactText = (text: string, maxLength: number = 60) => {
    if (!text) return '';
    // Remove markdown-style formatting
    let cleaned = text
      .replace(/\*\*/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Zap className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <h3 className="text-base font-bold">Top Actions</h3>
          <DbTableBadge tables={['leads', 'evan_communications', 'evan_tasks']} />
          <span className="text-xs text-muted-foreground">{actions.length} items</span>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2rem_1fr_4rem_5rem_4.5rem] gap-3 px-5 md:px-6 py-2 border-t border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>#</span>
        <span>Action</span>
        <span className="text-right">Go to</span>
        <span className="text-right">Stage</span>
        <span className="text-right">Timing</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm font-medium">All caught up!</p>
        </div>
      ) : (
        <ScrollArea className="h-[420px]">
          {actions.map((item, index) => {
            const Icon = ACTION_ICONS[item.actionType];
            const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
            const destination = getDestinationLabel(item);
            const DestIcon = destination === 'Email' ? Mail : destination === 'Call' ? Phone : ArrowRight;

            return (
              <Link
                key={item.id}
                to={getActionUrl(item)}
                className="block"
              >
                <div className={`group grid grid-cols-[2rem_1fr_4rem_5rem_4.5rem] gap-3 items-center px-5 md:px-6 py-3 hover:bg-muted/40 transition-colors cursor-pointer ${
                  index < actions.length - 1 ? 'border-b border-border/50' : ''
                }`}>
                  {/* Rank */}
                  <span className={`text-xs font-bold ${
                    index < 3 ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>

                  {/* Action + lead info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex-shrink-0 p-1.5 rounded-md ${
                      isOverdue
                        ? 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-muted/60 text-muted-foreground'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">
                        {item.action}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.leadName}
                        {item.companyName && ` · ${item.companyName}`}
                        {item.loanAmount ? ` · ${formatCurrency(item.loanAmount)}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      <DestIcon className="h-3 w-3" />
                      {destination}
                    </span>
                  </div>

                  {/* Stage */}
                  <div className="text-right">
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${getStageColor(item.status)}`}>
                      {stageLabels[item.status] || item.status}
                    </span>
                  </div>

                  {/* Timing */}
                  <div className="text-right">
                    {item.dueDate ? (
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-foreground'}`}>
                        {isOverdue ? 'Overdue' : format(new Date(item.dueDate), 'MMM d')}
                      </span>
                    ) : item.waitingTime > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {formatWaitingTime(item.waitingTime)} ago
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </ScrollArea>
      )}
    </div>
  );
};

export default TopActions;
