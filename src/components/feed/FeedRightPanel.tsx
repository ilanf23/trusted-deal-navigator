import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CheckSquare, TrendingUp, Clock } from 'lucide-react';
import { STAGE_LABELS } from '@/constants/appConfig';

const FeedRightPanel = () => {
  // Upcoming tasks
  const { data: upcomingTasks } = useQuery({
    queryKey: ['feed-upcoming-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, due_date, assignee_name, priority, status')
        .eq('is_completed', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Pipeline stage counts
  const { data: stageCounts } = useQuery({
    queryKey: ['feed-stage-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('status');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const lead of data || []) {
        counts[lead.status] = (counts[lead.status] || 0) + 1;
      }
      return counts;
    },
  });

  // Recent leads
  const { data: recentLeads } = useQuery({
    queryKey: ['feed-recent-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, company_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const today = format(new Date(), 'EEEE, MMMM do');

  return (
    <div className="w-[300px] min-w-[300px] bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-4">
        {/* Date */}
        <div className="text-right text-sm text-muted-foreground mb-4">{today}</div>

        {/* Pipeline Snapshot */}
        <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">
          Pipeline Snapshot
        </div>
        <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Active Deals</h3>
          </div>
          {stageCounts && Object.keys(stageCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stageCounts)
                .filter(([stage]) => stage !== 'won')
                .map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{STAGE_LABELS[stage] || stage}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              {stageCounts['won'] && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                  <span className="text-green-600 font-medium">Won</span>
                  <span className="font-semibold text-green-600">{stageCounts['won']}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active deals</p>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">
          Upcoming Tasks
        </div>
        <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Tasks</h3>
          </div>
          {upcomingTasks && upcomingTasks.length > 0 ? (
            <div className="space-y-2.5">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.due_date && (
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      )}
                      {task.assignee_name && (
                        <span className="text-[11px] text-muted-foreground/60">{task.assignee_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No upcoming tasks</p>
          )}
        </div>

        {/* Recent Leads */}
        <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">
          Recent Leads
        </div>
        <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">New Leads</h3>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            <div className="space-y-2.5">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{lead.name}</p>
                    {lead.company_name && (
                      <p className="text-[11px] text-muted-foreground truncate">{lead.company_name}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                    {STAGE_LABELS[lead.status] || lead.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No recent leads</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedRightPanel;
