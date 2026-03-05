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
        .select('id, title, due_date, assignee_name, lead_id, priority')
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

  const visibleTasks = dueTasks.filter((t) => !dismissedIds.includes(t.id));
  const visibleMeetings = upcomingMeetings.filter((m) => !dismissedIds.includes(m.id));

  return (
    <div className={isSheet ? "bg-card h-full overflow-y-auto" : "w-[280px] min-w-[280px] 2xl:w-[300px] 2xl:min-w-[300px] bg-card border-l border-border h-full overflow-y-auto hidden xl:block"}>
      <div className="p-4 space-y-5">
        {/* Due Tasks */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <SquareCheckBig className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Due Tasks</h3>
            {visibleTasks.length > 0 && (
              <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {visibleTasks.length}
              </span>
            )}
          </div>
          {visibleTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-1">No upcoming tasks</p>
          ) : (
            <div className="space-y-2">
              {visibleTasks.map((task) => {
                const dueInfo = formatDueLabel(task.due_date!);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`${basePath}/tasks?taskId=${task.id}`)}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer relative group"
                  >
                    <button
                      onClick={(e) => dismiss(task.id, e)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-sm font-medium text-foreground truncate pr-5">{task.title}</p>
                    <p className={cn('text-xs mt-1', dueInfo.urgent ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                      {dueInfo.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Upcoming Meetings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Meetings</h3>
            {visibleMeetings.length > 0 && (
              <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {visibleMeetings.length}
              </span>
            )}
          </div>
          {visibleMeetings.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-1">No upcoming meetings</p>
          ) : (
            <div className="space-y-2">
              {visibleMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => navigate(`${basePath}/calendar`)}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer relative group"
                >
                  <button
                    onClick={(e) => dismiss(meeting.id, e)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-sm font-medium text-foreground truncate pr-5">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatMeetingLabel(meeting.start_time)}</p>
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
