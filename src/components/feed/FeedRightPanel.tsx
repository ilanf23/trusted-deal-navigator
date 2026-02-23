import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { AlertCircle, CalendarClock, UserPlus, Users, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMember } from '@/hooks/useTeamMember';

const avatarColors = [
  'bg-sky-600', 'bg-blue-600', 'bg-pink-600', 'bg-emerald-600',
  'bg-violet-600', 'bg-teal-600', 'bg-rose-600', 'bg-indigo-600',
  'bg-amber-600', 'bg-cyan-600',
];

const getColorFromName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const formatDueLabel = (dueDate: string): { text: string; urgent: boolean } => {
  const due = new Date(dueDate);
  const now = new Date();
  const days = differenceInDays(due, now);

  if (days < 0) return { text: `overdue by ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''}`, urgent: true };
  if (days === 0) return { text: 'due today', urgent: true };
  if (days === 1) return { text: 'due in 1 day', urgent: true };
  if (days <= 3) return { text: `due in ${days} days`, urgent: false };
  return { text: `due ${format(due, 'MMM d')}`, urgent: false };
};

const formatMeetingTime = (startTime: string): string => {
  const date = new Date(startTime);
  const now = new Date();

  if (isToday(date)) {
    return `today at ${format(date, 'h:mm a')} EST`;
  }
  if (isTomorrow(date)) {
    return `tomorrow at ${format(date, 'h:mm a')} EST`;
  }
  const days = differenceInDays(date, now);
  if (days <= 6) {
    return `on ${format(date, 'EEEE')} at ${format(date, 'h:mm a')} EST`;
  }
  return `on ${format(date, 'MMM d')} at ${format(date, 'h:mm a')} EST`;
};

const FeedRightPanel = () => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const basePath = teamMember ? `/admin/${teamMember.name.toLowerCase()}` : '/admin/evan';

  // Tasks due soon (incomplete with due dates)
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

  // Upcoming appointments
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

  // Suggested people (leads with email, most recently active)
  const { data: suggestedPeople = [] } = useQuery({
    queryKey: ['feed-right-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, company_name')
        .not('email', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['feed-right-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const parseMeetingAttendees = (title: string): { primary: string; others: string[] } => {
    // Titles like "Evan/Wendy" or "CLX Team TouchPoint"
    const parts = title.split('/').map(s => s.trim());
    if (parts.length > 1) {
      return { primary: parts[0], others: parts.slice(1) };
    }
    // "CLX Team TouchPoint" → show as team meeting with all members
    if (title.toLowerCase().includes('team')) {
      const others = teamMembers.filter(m => m.name.toLowerCase() !== 'evan').map(m => m.name);
      return { primary: 'Team', others };
    }
    return { primary: title, others: [] };
  };

  return (
    <div className="w-[300px] min-w-[300px] bg-card border-l border-border h-full overflow-y-auto hidden lg:block">
      <div className="p-4 space-y-5">

        {/* ─── Keep Things Moving ─── */}
        {dueTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Keep things moving</h3>
            </div>
            <div className="space-y-2">
              {dueTasks.map((task) => {
                const dueInfo = formatDueLabel(task.due_date!);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`${basePath}/tasks?taskId=${task.id}`)}
                    className="bg-muted/50 rounded-lg p-3 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-muted-foreground">
                      You have a task {dueInfo.text}!
                    </p>
                    <p className={cn(
                      'text-sm font-medium mt-0.5 truncate',
                      dueInfo.urgent ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    )}>
                      "{task.title}" is {dueInfo.text}!
                    </p>
                    {task.assignee_name && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold',
                          getColorFromName(task.assignee_name)
                        )}>
                          {task.assignee_name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Upcoming Meetings ─── */}
        {upcomingMeetings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Upcoming Meetings</h3>
            </div>
            <div className="space-y-2">
              {upcomingMeetings.map((meeting) => {
                const attendees = parseMeetingAttendees(meeting.title);
                const othersText = attendees.others.length > 0
                  ? `with ${attendees.others[0]}${attendees.others.length > 1 ? ` +${attendees.others.length - 1} more` : ''}`
                  : '';

                return (
                  <div
                    key={meeting.id}
                    onClick={() => navigate(`${basePath}/calendar`)}
                    className="bg-muted/50 rounded-lg p-3 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5',
                        getColorFromName(attendees.primary)
                      )}>
                        {attendees.primary.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Upcoming Meeting</p>
                        {othersText && (
                          <p className="text-xs text-muted-foreground">{othersText}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          You have a meeting {formatMeetingTime(meeting.start_time)}. Prepare for your meeting now.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Suggestions ─── */}
        {suggestedPeople.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Suggestions</h3>
              </div>
              <button className="text-xs text-primary hover:text-primary/80 font-medium">View all</button>
            </div>

            <div className="bg-muted/50 rounded-lg border border-border p-3 mb-2">
              <p className="text-xs font-semibold text-foreground mb-1">Add Suggested People</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Once added, all the conversations with them will be visible and auto-tracked in your CRM
              </p>
            </div>

            <div className="space-y-0.5">
              {suggestedPeople.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0',
                    getColorFromName(person.name)
                  )}>
                    {getInitials(person.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {person.name}
                      {person.company_name && (
                        <span className="text-muted-foreground font-normal"> at {person.company_name}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{person.email}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Invite Team Members ─── */}
        {teamMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Team Members</h3>
            </div>

            <div className="space-y-0.5">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0',
                    getColorFromName(member.name)
                  )}>
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FeedRightPanel;
