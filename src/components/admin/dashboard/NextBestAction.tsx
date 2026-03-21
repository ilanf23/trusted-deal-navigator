import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crosshair, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

interface NextBestActionProps {
  evanId?: string;
}

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  initial_review: 'Initial Review',
  pre_qualification: 'Pre-Qual',
  document_collection: 'Docs',
  moving_to_underwriting: 'Moving to UW',
  onboarding: 'Onboarding',
  underwriting: 'Underwriting',
  ready_for_wu_approval: 'Ready for Approval',
  pre_approval_issued: 'Pre-Approval',
  approval: 'Approval',
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const NextBestAction = ({ evanId }: NextBestActionProps) => {
  const { data: nextAction, isLoading } = useQuery({
    queryKey: ['next-best-action', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      // First: overdue task with an associated lead
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, lead_id')
        .eq('is_completed', false)
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      const taskWithLead = overdueTasks?.find(t => t.lead_id);

      if (taskWithLead) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id, name, company_name, status, lead_responses(loan_amount)')
          .eq('id', taskWithLead.lead_id)
          .single();

        if (lead) {
          return {
            action: taskWithLead.title,
            leadName: lead.name,
            companyName: lead.company_name,
            stage: lead.status,
            revenue: (lead.lead_responses?.[0]?.loan_amount || 0) * 0.01,
            daysWaiting: differenceInDays(new Date(), new Date(taskWithLead.due_date)),
            leadId: lead.id,
          };
        }
      }

      // Second: lead closest to closing with longest inactivity
      const { data: staleLeads } = await supabase
        .from('leads')
        .select('id, name, company_name, status, updated_at, lead_responses(loan_amount)')
        .eq('assigned_to', evanId)
        .in('status', ['approval', 'ready_for_wu_approval', 'pre_approval_issued', 'underwriting'])
        .order('updated_at', { ascending: true })
        .limit(1);

      if (staleLeads?.[0]) {
        const lead = staleLeads[0];
        const daysWaiting = differenceInDays(new Date(), new Date(lead.updated_at));
        const isClose = ['approval', 'ready_for_wu_approval', 'pre_approval_issued'].includes(lead.status);

        return {
          action: isClose ? 'Push for final approval' : 'Follow up on underwriting status',
          leadName: lead.name,
          companyName: lead.company_name,
          stage: lead.status,
          revenue: (lead.lead_responses?.[0]?.loan_amount || 0) * 0.01,
          daysWaiting,
          leadId: lead.id,
        };
      }

      // Third: any overdue task
      if (overdueTasks?.[0]) {
        return {
          action: overdueTasks[0].title,
          leadName: 'General Task',
          companyName: null as string | null,
          stage: null as string | null,
          revenue: 0,
          daysWaiting: differenceInDays(new Date(), new Date(overdueTasks[0].due_date)),
          leadId: null as string | null,
        };
      }

      return null;
    },
    enabled: !!evanId,
  });

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!nextAction) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Crosshair className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            Your Next Best Action
          </p>
        </div>

        <div className="flex items-center gap-2">
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            {nextAction.action}
          </h2>
          <DbTableBadge tables={['tasks', 'leads']} />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {nextAction.companyName ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{nextAction.leadName}</span>
              <span>&middot;</span>
              <span>{nextAction.companyName}</span>
            </div>
          ) : nextAction.leadName !== 'General Task' ? (
            <span className="text-sm font-medium text-foreground">{nextAction.leadName}</span>
          ) : null}

          {nextAction.stage && (
            <Badge variant="secondary" className="text-xs">
              {STAGE_LABELS[nextAction.stage] || nextAction.stage}
            </Badge>
          )}

          {nextAction.revenue > 0 && (
            <Badge variant="outline" className="text-xs">
              {formatCurrency(nextAction.revenue)} potential
            </Badge>
          )}

          {nextAction.daysWaiting > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {nextAction.daysWaiting}d waiting
            </span>
          )}
        </div>

        {nextAction.leadId && (
          <Link to={`/admin/leads?highlight=${nextAction.leadId}`}>
            <Button size="sm" className="mt-4 gap-1.5">
              Take Action
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
