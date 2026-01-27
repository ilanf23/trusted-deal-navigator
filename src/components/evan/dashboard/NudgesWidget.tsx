import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Mail, Loader2, Clock, ExternalLink, Zap } from 'lucide-react';
import { differenceInDays, subDays, format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  last_activity_at: string | null;
  created_at: string;
}

interface NudgesWidgetProps {
  evanId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  pre_qualification: 'Pre-Qual',
  document_collection: 'Docs',
  underwriting: 'UW',
  approval: 'Approval',
};

export const NudgesWidget = ({ evanId }: NudgesWidgetProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tasksCreatedRef = useRef<Set<string>>(new Set());

  // Fetch leads needing nudges (no activity in 7+ days)
  const { data: nudgeLeads = [], isLoading } = useQuery({
    queryKey: ['evan-dashboard-nudges'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      
      // Fetch all active leads with emails that have stale activity
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, company_name, status, last_activity_at, created_at')
        .neq('status', 'funded')
        .not('email', 'is', null)
        .order('last_activity_at', { ascending: true, nullsFirst: true })
        .limit(20);
      
      if (error) throw error;

      // Filter to leads where last activity is older than 7 days
      return (leads || []).filter(lead => {
        const lastActivity = lead.last_activity_at 
          ? new Date(lead.last_activity_at) 
          : new Date(lead.created_at);
        return lastActivity < new Date(sevenDaysAgo);
      }) as Lead[];
    },
  });

  // Fetch existing follow-up tasks to avoid duplicates
  const { data: existingTasks = [] } = useQuery({
    queryKey: ['evan-followup-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, lead_id, title')
        .ilike('title', '%7-day follow up%');
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-create high priority tasks for leads needing follow-up
  useEffect(() => {
    const createFollowUpTasks = async () => {
      if (nudgeLeads.length === 0) return;

      const existingLeadIds = new Set(existingTasks.map(t => t.lead_id));
      
      for (const lead of nudgeLeads) {
        // Skip if task already exists or we already created one this session
        if (existingLeadIds.has(lead.id) || tasksCreatedRef.current.has(lead.id)) {
          continue;
        }

        const lastActivity = lead.last_activity_at || lead.created_at;
        const daysSince = differenceInDays(new Date(), new Date(lastActivity));
        
        // Set due date to today for follow-up tasks
        const dueDate = new Date();
        
        const { error } = await supabase.from('evan_tasks').insert({
          title: `7-Day Follow Up: ${lead.name}`,
          description: `No activity in ${daysSince} days. Follow up with ${lead.name}${lead.company_name ? ` at ${lead.company_name}` : ''}.`,
          status: 'todo',
          priority: 'high',
          lead_id: lead.id,
          assignee_name: 'Evan',
          group_name: 'To Do',
          source: 'nudge',
          due_date: dueDate.toISOString(),
        });

        if (!error) {
          tasksCreatedRef.current.add(lead.id);
        }
      }

      // Invalidate tasks query to show new tasks
      if (tasksCreatedRef.current.size > 0) {
        queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      }
    };

    createFollowUpTasks();
  }, [nudgeLeads, existingTasks, queryClient]);

  // Create nudge email draft and navigate to Gmail
  const createNudgeDraft = useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const subject = `Following up - ${lead.company_name || lead.name}`;
      const body = `Hi ${lead.name.split(' ')[0]},\n\nI wanted to follow up and see if you had any questions about the financing options we discussed.\n\nPlease let me know if there's anything I can help with.\n\nBest regards,\nEvan`;

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=create-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: lead.email, subject, body }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create draft');
      }

      // Update lead's updated_at to prevent repeated nudges
      await supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      return { lead, draftId: data.id };
    },
    onSuccess: ({ lead, draftId }) => {
      toast.success(`Draft created for ${lead.name} - Opening Gmail...`);
      queryClient.invalidateQueries({ queryKey: ['evan-dashboard-nudges'] });
      // Navigate to Gmail with the draft ID to open it directly
      navigate(`/team/evan/gmail?compose=draft&draftId=${draftId}&to=${encodeURIComponent(lead.email || '')}&leadId=${lead.id}`);
    },
    onError: (error: any) => {
      toast.error('Failed to create draft: ' + error.message);
    },
  });

  if (!isLoading && nudgeLeads.length === 0) {
    return null; // Don't render widget if no nudges
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Leads Needing Follow-Up
                {nudgeLeads.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {nudgeLeads.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                No activity in 7+ days — send a quick nudge
              </CardDescription>
            </div>
          </div>
          <Link to="/team/evan/gmail">
            <Button variant="ghost" size="sm" className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Gmail
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[260px] pr-4">
            <div className="space-y-2">
              {nudgeLeads.map((lead) => {
                const lastActivity = lead.last_activity_at || lead.created_at;
                const daysSince = differenceInDays(new Date(), new Date(lastActivity));
                
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">
                          {STATUS_LABELS[lead.status] || lead.status}
                        </Badge>
                      </div>
                      {lead.company_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.company_name}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                        <Clock className="h-3 w-3" />
                        <span>{daysSince} days since last activity</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 ml-3 shrink-0"
                      onClick={() => createNudgeDraft.mutate(lead)}
                      disabled={createNudgeDraft.isPending}
                    >
                      {createNudgeDraft.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          Create Draft
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default NudgesWidget;
