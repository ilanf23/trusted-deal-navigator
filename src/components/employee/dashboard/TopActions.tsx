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
    queryKey: ['top-actions', evanId],
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
    queryKey: ['lead-communications', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
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
    queryKey: ['lead-tasks-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
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
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#eee6f6', borderBottom: '1px solid #c8bdd6' }}>
        <div className="flex items-center gap-2.5">
          <Zap className="h-4 w-4" style={{ color: '#3b2778' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#3b2778' }}>Top Actions</h3>
          <span className="text-xs" style={{ color: '#3b2778', opacity: 0.6 }}>{actions.length} items</span>
        </div>
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
        <ScrollArea className="h-[460px]">
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['#', 'Action', 'Go To', 'Stage', 'Timing'].map((label) => (
                  <th
                    key={label}
                    style={{
                      backgroundColor: '#eee6f6',
                      border: '1px solid #c8bdd6',
                      color: '#3b2778',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      textAlign: 'left',
                      padding: '6px 10px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((item, index) => {
                const Icon = ACTION_ICONS[item.actionType];
                const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
                const destination = getDestinationLabel(item);
                const DestIcon = destination === 'Email' ? Mail : destination === 'Call' ? Phone : ArrowRight;
                const cellBorder = '1px solid #c8bdd6';

                return (
                  <Link
                    key={item.id}
                    to={getActionUrl(item)}
                    className="contents"
                  >
                    <tr
                      className="cursor-pointer"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eee6f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                    >
                      {/* # */}
                      <td style={{ border: cellBorder, padding: '8px 10px', width: 40, color: '#3b2778', fontWeight: 600 }}>
                        {index + 1}
                      </td>

                      {/* Action */}
                      <td style={{ border: cellBorder, padding: '8px 10px' }}>
                        <div className="flex items-center gap-2" style={{ overflow: 'hidden' }}>
                          <div className="flex-shrink-0 p-1 rounded" style={{ backgroundColor: isOverdue ? '#fef2f2' : '#f3eef9' }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: isOverdue ? '#dc2626' : '#3b2778' }} />
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ color: '#1a1a2e', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.action}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                              {item.leadName}
                              {item.companyName && ` · ${item.companyName}`}
                              {item.loanAmount ? ` · ${formatCurrency(item.loanAmount)}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Go To */}
                      <td style={{ border: cellBorder, padding: '8px 10px', width: 70, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                        <span className="inline-flex items-center gap-1">
                          <DestIcon className="h-3 w-3" />
                          {destination}
                        </span>
                      </td>

                      {/* Stage */}
                      <td style={{ border: cellBorder, padding: '8px 10px', width: 110, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                        {stageLabels[item.status] || item.status}
                      </td>

                      {/* Timing */}
                      <td style={{ border: cellBorder, padding: '8px 10px', width: 90, whiteSpace: 'nowrap' }}>
                        {item.dueDate ? (
                          <>
                            <span style={{ color: isOverdue ? '#dc2626' : '#1a1a2e' }}>
                              {format(new Date(item.dueDate), 'MMM d')}
                            </span>
                            {isOverdue && (
                              <span style={{ color: '#dc2626', fontSize: '11px', marginLeft: 4 }}>
                                Overdue
                              </span>
                            )}
                          </>
                        ) : item.waitingTime > 0 ? (
                          <span style={{ color: '#1a1a2e' }}>
                            {formatWaitingTime(item.waitingTime)} ago
                          </span>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                    </tr>
                  </Link>
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
