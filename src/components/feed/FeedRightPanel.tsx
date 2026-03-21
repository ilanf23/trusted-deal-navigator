import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { X, Calendar } from 'lucide-react';
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

// Get current day/date for Copper-style header
const getCurrentDateHeader = () => {
  const now = new Date();
  return format(now, 'EEEE, MMMM do');
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
        .from('tasks')
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
        .from('appointments')
        .select('id, title, start_time, end_time, team_member_name, team_member_id, description')
        .eq('team_member_id', '5e2d8710-7a23-4c33-87a2-4ad9ced4e936')
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
    <div className={isSheet ? "bg-[#f7f5f3] h-full overflow-y-auto" : "w-[280px] min-w-[280px] 2xl:w-[300px] 2xl:min-w-[300px] bg-[#f7f5f3] border-l border-gray-200 h-full overflow-y-auto hidden xl:block"}>
      <div className="p-5 space-y-5">
        {/* Date header — Copper style */}
        <div className="text-xs text-gray-500 font-medium">
          {getCurrentDateHeader()}
        </div>

        {/* Keep things moving — Copper style */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Keep things moving
          </p>

          {visibleTasks.length === 0 && visibleMeetings.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No upcoming tasks or meetings</p>
          ) : (
            <div className="space-y-3">
              {/* Due Tasks */}
              {visibleTasks.map((task) => {
                const dueInfo = formatDueLabel(task.due_date!);
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg p-4 shadow-sm relative group"
                  >
                    <button
                      onClick={(e) => dismiss(task.id, e)}
                      className="absolute top-2.5 right-2.5 text-gray-300 hover:text-gray-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Pink checkbox icon — Copper style */}
                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="w-8 h-8 rounded bg-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-pink-500" viewBox="0 0 16 16" fill="currentColor">
                          <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M5 8l2.5 2.5L11 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800">
                          You have a task {dueInfo.text}!
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-3 leading-relaxed pl-11">
                      "{task.title}" is {dueInfo.text}!
                    </p>

                    <div className="pl-11">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(getTaskRoute(task));
                        }}
                        className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors uppercase tracking-wide"
                      >
                        GET IT DONE
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Upcoming Meetings */}
              {visibleMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-white rounded-lg p-4 shadow-sm relative group"
                >
                  <button
                    onClick={(e) => dismiss(meeting.id, e)}
                    className="absolute top-2.5 right-2.5 text-gray-300 hover:text-gray-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-start gap-3 mb-2.5">
                    <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800">
                        Upcoming meeting
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 leading-relaxed pl-11">
                    {meeting.title} — {formatMeetingLabel(meeting.start_time)}
                  </p>

                  <div className="pl-11">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/calendar`);
                      }}
                      className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors uppercase tracking-wide"
                    >
                      VIEW CALENDAR
                    </button>
                  </div>
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
