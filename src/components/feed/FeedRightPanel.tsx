import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { X, SquareCheckBig, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMember } from '@/hooks/useTeamMember';

const formatDueLabel = (dueDate: string): { text: string; urgent: boolean } => {
  const due = new Date(dueDate);
  const now = new Date();
  const days = differenceInDays(due, now);
  if (days < 0) return { text: `overdue by ${Math.abs(days)}d`, urgent: true };
  if (days === 0) return { text: 'due today', urgent: true };
  if (days === 1) return { text: 'due tomorrow', urgent: true };
  if (days <= 3) return { text: `due in ${days}d`, urgent: false };
  return { text: `due ${format(due, 'MMM d')}`, urgent: false };
};

const formatMeetingLabel = (startTime: string): string => {
  const date = new Date(startTime);
  const timeStr = format(date, 'h:mm a');
  if (isToday(date)) return `Today at ${timeStr}`;
  if (isTomorrow(date)) return `Tomorrow at ${timeStr}`;
  const days = differenceInDays(date, new Date());
  if (days <= 6) return `${format(date, 'EEEE')} at ${timeStr}`;
  return `${format(date, 'MMM d')} at ${timeStr}`;
};

const FeedRightPanel = ({ isSheet }: { isSheet?: boolean }) => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const basePath = teamMember ? `/admin/${teamMember.name.toLowerCase()}` : '/admin/dashboard';
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, id]);
  };

  const { data: dueTasks = [] } = useQuery({
    queryKey: ['feed-right-due-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, due_date, assignee_name, lead_id, priority, source')
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: upcomingMeetings = [] } = useQuery({
    queryKey: ['feed-right-meetings'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('evan_appointments')
        .select('id, title, start_time, end_time, team_member_name, description')
        .eq('team_member_name', 'evan')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const getTaskRoute = (task: typeof dueTasks[number]): string => {
    const source = task.source?.toLowerCase() || '';
    const title = task.title?.toLowerCase() || '';
    const leadParam = task.lead_id ? `&leadId=${task.lead_id}` : '';

    if (title.includes('closing') || title.includes('prepare closing'))
      return `${basePath}/gmail?compose=true${leadParam}&template=closing`;

    if (source === 'nudge' || title.includes('follow up') || title.includes('follow-up'))
      return `${basePath}/gmail?compose=true${leadParam}&template=follow_up`;

    if (source === 'gmail' || title.includes('email') || title.includes('send'))
      return `${basePath}/gmail?compose=true${leadParam}`;

    if (source === 'lead' || task.lead_id)
      return `${basePath}/pipeline?lead=${task.lead_id}&tab=lenders`;

    return `${basePath}/tasks?taskId=${task.id}`;
  };

  const visibleTasks = dueTasks.filter((t) => !dismissedIds.includes(t.id));
  const visibleMeetings = upcomingMeetings.filter((m) => !dismissedIds.includes(m.id));

  return (
    <div className={isSheet ? "bg-card h-full overflow-y-auto" : "w-[280px] min-w-[280px] 2xl:w-[300px] 2xl:min-w-[300px] bg-card border-l border-border/50 h-full overflow-y-auto hidden xl:block"}>
      <div className="p-4 pt-5 space-y-5">
        {/* Due Tasks */}
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="p-1.5 rounded-lg bg-primary/8">
              <SquareCheckBig className="w-4 h-4 text-primary/80" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Due Tasks</h3>
            {visibleTasks.length > 0 && (
              <span className="ml-auto text-[11px] font-medium text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
                {visibleTasks.length}
              </span>
            )}
          </div>
          {visibleTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 pl-1 italic">No upcoming tasks</p>
          ) : (
            <div className="space-y-2">
              {visibleTasks.map((task) => {
                const dueInfo = formatDueLabel(task.due_date!);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(getTaskRoute(task))}
                    className="p-3 rounded-xl border border-border/50 bg-card hover:shadow-[0_2px_8px_-2px_rgb(0_0_0/0.06)] hover:border-border/80 transition-all duration-200 cursor-pointer relative group"
                  >
                    <button
                      onClick={(e) => dismiss(task.id, e)}
                      className="absolute top-2 right-2 text-muted-foreground/40 hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-sm font-medium text-foreground truncate pr-5 tracking-tight">{task.title}</p>
                    <p className={cn('text-xs mt-1.5', dueInfo.urgent ? 'text-destructive font-medium' : 'text-muted-foreground/70')}>
                      {dueInfo.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mx-1" />

        {/* Upcoming Meetings */}
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="p-1.5 rounded-lg bg-primary/8">
              <Calendar className="w-4 h-4 text-primary/80" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Meetings</h3>
            {visibleMeetings.length > 0 && (
              <span className="ml-auto text-[11px] font-medium text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
                {visibleMeetings.length}
              </span>
            )}
          </div>
          {visibleMeetings.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 pl-1 italic">No upcoming meetings</p>
          ) : (
            <div className="space-y-2">
              {visibleMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => navigate(`${basePath}/calendar`)}
                  className="p-3 rounded-xl border border-border/50 bg-card hover:shadow-[0_2px_8px_-2px_rgb(0_0_0/0.06)] hover:border-border/80 transition-all duration-200 cursor-pointer relative group"
                >
                  <button
                    onClick={(e) => dismiss(meeting.id, e)}
                    className="absolute top-2 right-2 text-muted-foreground/40 hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-sm font-medium text-foreground truncate pr-5 tracking-tight">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1.5">{formatMeetingLabel(meeting.start_time)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedRightPanel;
