import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { X, Calendar, CheckSquare, TrendingUp, Users, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMember } from '@/hooks/useTeamMember';

/* ── Helpers ── */

const formatDueLabel = (dueDate: string): { text: string; urgent: boolean } => {
  const due = new Date(dueDate);
  const now = new Date();
  const days = differenceInDays(due, now);
  if (days < 0) return { text: `overdue by ${Math.abs(days)}d`, urgent: true };
  if (days === 0) return { text: 'due today', urgent: true };
  if (days === 1) return { text: 'due in 1 day', urgent: true };
  if (days <= 3) return { text: `due in ${days}d`, urgent: false };
  return { text: `due ${format(due, 'MMM d')}`, urgent: false };
};

const formatMeetingTime = (startTime: string): string => {
  const date = new Date(startTime);
  const timeStr = format(date, 'h:mm a');
  if (isToday(date)) return `today at ${timeStr}`;
  if (isTomorrow(date)) return `tomorrow at ${timeStr}`;
  const days = differenceInDays(date, new Date());
  if (days <= 6) return `${format(date, 'EEEE')} at ${timeStr}`;
  return `${format(date, 'MMM d')} at ${timeStr}`;
};

const getCurrentDateHeader = () => {
  return format(new Date(), 'EEEE, MMMM do');
};

/* ── Attendee initials ── */
const attendeeColors = ['bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500'];

/* ═══════════════════════════════════════════════════════════
   FeedRightPanel — Improved Copper Style
   ═══════════════════════════════════════════════════════════ */

const FeedRightPanel = ({ isSheet }: { isSheet?: boolean }) => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const basePath = teamMember ? `/admin/${teamMember.name.toLowerCase()}` : '/admin/dashboard';
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, id]);
  };

  /* ── Queries ── */

  const { data: dueTasks = [] } = useQuery({
    queryKey: ['feed-right-due-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, lead_id, priority, source, user_id')
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: upcomingMeetings = [] } = useQuery({
    queryKey: ['feed-right-meetings', teamMember?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, user_id, description')
        .eq('user_id', teamMember!.id)
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!teamMember?.id,
  });

  // Pipeline pulse: quick counts
  const { data: pipelineStats } = useQuery({
    queryKey: ['feed-right-pipeline-stats'],
    queryFn: async () => {
      const [
        { count: activeDeals },
        { count: weekTasks },
        { count: weekComms },
      ] = await Promise.all([
        supabase
          .from('potential')
          .select('id', { count: 'exact', head: true })
          .in('status', ['new', 'contacted', 'in_progress', 'underwriting', 'approved']),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_completed', false)
          .not('due_date', 'is', null),
        supabase
          .from('communications')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      return {
        activeDeals: activeDeals || 0,
        openTasks: weekTasks || 0,
        weekActivity: weekComms || 0,
      };
    },
    refetchInterval: 60000,
  });

  /* ── Smart task routing ── */

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
    <div className={isSheet ? "bg-[#f7f7f8] h-full overflow-y-auto" : "w-[280px] min-w-[280px] 2xl:w-[300px] 2xl:min-w-[300px] bg-[#f7f7f8] border-l border-gray-200 h-full overflow-y-auto hidden xl:block"}>
      <div className="p-5 space-y-6">

        {/* ── Date header ── */}
        <div className="text-[13px] text-gray-500 font-medium">
          {getCurrentDateHeader()}
        </div>

        {/* ══════════════════════════════════
           SECTION 1: Keep Things Moving
           ══════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Keep things moving
          </p>

          <div className="space-y-3">

            {/* ── Upcoming Meetings ── */}
            {visibleMeetings.map((meeting) => {
              // Parse attendees from description if available
              const attendeeNames = meeting.description
                ? meeting.description.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 3)
                : [];
              const extraCount = attendeeNames.length > 2 ? attendeeNames.length - 2 : 0;

              return (
                <div
                  key={meeting.id}
                  className="bg-white rounded-xl p-4 shadow-sm relative group border border-gray-100"
                >
                  <button
                    onClick={(e) => dismiss(meeting.id, e)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Header row: avatars + title */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Stacked attendee avatars */}
                    <div className="flex -space-x-1.5">
                      {(attendeeNames.length > 0 ? attendeeNames.slice(0, 2) : ['M']).map((name, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white',
                            attendeeColors[i % attendeeColors.length]
                          )}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 leading-tight">
                        Upcoming Meeting
                      </p>
                      {attendeeNames.length > 0 && (
                        <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                          with {attendeeNames[0]}{extraCount > 0 ? ` +${extraCount} more` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
                    You have a meeting {formatMeetingTime(meeting.start_time)}. Prepare for your meeting now.
                  </p>

                  {/* CTA */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const meetingDate = format(new Date(meeting.start_time), 'yyyy-MM-dd');
                      navigate(`${basePath}/calendar?date=${meetingDate}&eventId=${meeting.id}`);
                    }}
                    className="px-4 py-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors tracking-wide"
                  >
                    Prepare
                  </button>
                </div>
              );
            })}

            {/* ── Due / Overdue Tasks ── */}
            {visibleTasks.map((task) => {
              const due = formatDueLabel(task.due_date!);
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl p-4 shadow-sm relative group border border-gray-100"
                >
                  <button
                    onClick={(e) => dismiss(task.id, e)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Header: icon + urgency label */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      due.urgent ? 'bg-red-50' : 'bg-amber-50'
                    )}>
                      <CheckSquare className={cn(
                        'w-3.5 h-3.5',
                        due.urgent ? 'text-red-500' : 'text-amber-500'
                      )} />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-800 leading-tight">
                      You have a task {due.text}!
                    </p>
                  </div>

                  {/* Task title */}
                  <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
                    "{task.title}" is {due.text}!
                  </p>

                  {/* CTA */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(getTaskRoute(task));
                    }}
                    className="px-4 py-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors tracking-wide"
                  >
                    Get on it
                  </button>
                </div>
              );
            })}

            {/* Empty state */}
            {visibleMeetings.length === 0 && visibleTasks.length === 0 && (
              <p className="text-[12px] text-gray-400 italic py-2">
                No upcoming tasks or meetings — nice work.
              </p>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════
           SECTION 2: Pipeline Pulse
           (Replaces Copper's useless "Suggestions")
           ══════════════════════════════════ */}
        {pipelineStats && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Pipeline pulse
            </p>

            <div className="space-y-2">
              {/* Active Deals */}
              <button
                onClick={() => navigate(`${basePath}/pipeline`)}
                className="w-full bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[20px] font-bold text-gray-800 leading-none">
                    {pipelineStats.activeDeals}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Active deals</p>
                </div>
              </button>

              {/* Open Tasks */}
              <button
                onClick={() => navigate(`${basePath}/tasks`)}
                className="w-full bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <CheckSquare className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[20px] font-bold text-gray-800 leading-none">
                    {pipelineStats.openTasks}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Open tasks</p>
                </div>
              </button>

              {/* Week Activity */}
              <button
                onClick={() => navigate(`${basePath}/pipeline/feed`)}
                className="w-full bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[20px] font-bold text-gray-800 leading-none">
                    {pipelineStats.weekActivity}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Touchpoints this week</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedRightPanel;
