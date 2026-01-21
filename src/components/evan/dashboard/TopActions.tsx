import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      if (lead.status === 'approval') {
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
      } else if (lead.status === 'document_collection') {
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
      } else if (lead.status === 'pre_qualification') {
        if (hoursSinceContact > 72) {
          action = 'Re-engage with qualification call';
          actionType = 'call';
          blockerSeverity = 3;
          impact = 'Prevents lead from going cold';
        } else if (daysSinceUpdate > 5) {
          action = 'Send pre-qualification summary';
          actionType = 'email';
          blockerSeverity = 2;
          impact = 'Moves to document collection';
        }
      } else if (lead.status === 'discovery') {
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

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    pre_qualification: 'Pre-Qual',
    document_collection: 'Docs',
    underwriting: 'UW',
    approval: 'Approval',
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Top 10 Actions Now</CardTitle>
              <CardDescription className="text-xs">
                Auto-ranked by deal close proximity, blocker severity & wait time
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {actions.length} actions
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm">No urgent actions needed right now</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {actions.map((item, index) => {
                const Icon = ACTION_ICONS[item.actionType];
                const urgency = getUrgencyIndicator(item.urgencyScore);

                return (
                  <Link
                    key={item.id}
                    to={`/user/evan/leads?highlight=${item.leadId}`}
                    className="block"
                  >
                    <div className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer">
                      {/* Rank number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>

                      {/* Action icon */}
                      <div className={`flex-shrink-0 p-2 rounded-lg bg-muted/50 ${urgency.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium truncate">
                              {item.leadName}
                              {item.companyName && (
                                <span className="text-muted-foreground font-normal">
                                  {' '}· {item.companyName}
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-foreground mt-0.5">
                              {item.action}
                            </p>
                          </div>
                          {item.loanAmount && (
                            <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                              {formatCurrency(item.loanAmount)}
                            </span>
                          )}
                        </div>

                        {/* Impact & metadata */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className={`text-xs py-0 px-1.5 ${getStageColor(item.status)}`}>
                            {stageLabels[item.status] || item.status}
                          </Badge>
                          
                          {item.dueDate ? (
                            <div className="flex items-center gap-1 text-xs text-primary font-medium">
                              <Clock className="h-3 w-3" />
                              Due {format(new Date(item.dueDate), 'MMM d, h:mm a')}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatWaitingTime(item.waitingTime)} waiting
                            </div>
                          )}

                          {item.blockerSeverity >= 4 && (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              Blocker
                            </div>
                          )}
                        </div>

                        {/* Impact statement */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                          <ArrowRight className="h-3 w-3" />
                          <span>{item.impact}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default TopActions;
