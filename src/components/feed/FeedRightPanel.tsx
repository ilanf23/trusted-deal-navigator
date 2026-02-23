import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { X, SquareCheckBig, Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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

const formatMeetingParts = (startTime: string): { relativeDay: string; timeStr: string; fullText: string } => {
  const date = new Date(startTime);
  const timeStr = format(date, 'h:mm a') + ' EST';
  if (isToday(date)) return { relativeDay: 'today', timeStr, fullText: `today at ${timeStr}` };
  if (isTomorrow(date)) return { relativeDay: 'tomorrow', timeStr, fullText: `tomorrow at ${timeStr}` };
  const dayName = format(date, 'EEEE');
  const days = differenceInDays(date, new Date());
  if (days <= 6) return { relativeDay: dayName, timeStr, fullText: `on ${dayName} at ${timeStr}` };
  const dateStr = format(date, 'MMM d');
  return { relativeDay: dateStr, timeStr, fullText: `on ${dateStr} at ${timeStr}` };
};

const FeedRightPanel = () => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const basePath = teamMember ? `/admin/${teamMember.name.toLowerCase()}` : '/admin/evan';
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

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['feed-right-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, avatar_url')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const parseMeetingAttendees = (title: string): { primary: string; others: string[] } => {
    const parts = title.split('/').map((s) => s.trim());
    if (parts.length > 1) return { primary: parts[0], others: parts.slice(1) };
    if (title.toLowerCase().includes('team')) {
      const others = teamMembers.filter((m) => m.name.toLowerCase() !== 'evan').map((m) => m.name);
      return { primary: 'Team', others };
    }
    return { primary: title, others: [] };
  };

  const visibleTasks = dueTasks.filter((t) => !dismissedIds.includes(t.id));
  const visibleMeetings = upcomingMeetings.filter((m) => !dismissedIds.includes(m.id));

  return (
    <div className="w-[300px] min-w-[300px] bg-card border-l border-border h-full overflow-y-auto hidden lg:block">
      <div className="p-4 space-y-5">
        {/* Date header */}
        <p className="text-xs text-muted-foreground text-right">{format(new Date(), 'EEEE, MMMM do')}</p>

        {/* ─── Keep Things Moving ─── */}
        {visibleTasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Keep things moving</p>
            <div className="space-y-3">
              {visibleTasks.map((task) => {
                const dueInfo = formatDueLabel(task.due_date!);
                return (
                  <div key={task.id} className="bg-card rounded-lg p-4 border border-border relative">
                    <button onClick={(e) => dismiss(task.id, e)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg bg-foreground/90 flex items-center justify-center flex-shrink-0">
                        <SquareCheckBig className="w-6 h-6 text-background" />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-bold text-foreground">You have a task {dueInfo.text}!</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">"{task.title}" is {dueInfo.text}!</p>
                        {task.assignee_name && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold', getColorFromName(task.assignee_name))}>
                              {task.assignee_name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`${basePath}/tasks?taskId=${task.id}`)}
                      className="mt-3 w-full py-1.5 text-xs font-bold uppercase tracking-wider border border-primary text-primary rounded hover:bg-primary/10 transition-colors"
                    >
                      Get on it
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Upcoming Meetings ─── */}
        {visibleMeetings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming Meetings</p>
            <div className="space-y-3">
              {visibleMeetings.map((meeting) => {
                const attendees = parseMeetingAttendees(meeting.title);
                const parts = formatMeetingParts(meeting.start_time);
                const othersText = attendees.others.length > 0
                  ? `with ${attendees.others[0]}${attendees.others.length > 1 ? ` +${attendees.others.length - 1} more` : ''}`
                  : '';

                return (
                  <div key={meeting.id} className="bg-card rounded-lg p-4 border border-border relative">
                    <button onClick={(e) => dismiss(meeting.id, e)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold', getColorFromName(attendees.primary))}>
                          {attendees.primary.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-card">
                          <Calendar className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-bold text-foreground">Upcoming Meeting</p>
                        {othersText && <p className="text-xs text-muted-foreground">{othersText}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          You have a meeting <span className="font-bold text-foreground">{parts.relativeDay}</span> at <span className="font-bold text-foreground">{parts.timeStr}</span>. Prepare for your meeting now.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`${basePath}/calendar`)}
                      className="mt-3 w-full py-1.5 text-xs font-bold uppercase tracking-wider border border-primary text-primary rounded hover:bg-primary/10 transition-colors"
                    >
                      Prepare
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Separator ─── */}
        {suggestedPeople.length > 0 && <div className="border-t border-border" />}

        {/* ─── Suggestions ─── */}
        {suggestedPeople.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</h3>
              <button className="text-xs text-primary hover:text-primary/80 font-medium">View all</button>
            </div>

            <div className="bg-card rounded-lg border border-border p-3 mb-2">
              <p className="text-xs font-semibold text-foreground mb-1">Add Suggested People</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Once added, all the conversations with them will be visible and auto-tracked in your CRM
              </p>
            </div>

            <div className="space-y-0.5">
              {suggestedPeople.map((person) => (
                <div key={person.id} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={cn('text-white text-[11px] font-bold', getColorFromName(person.name))}>
                      {getInitials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {person.name}
                      {person.company_name && <span className="text-muted-foreground font-normal"> at {person.company_name}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{person.email}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Separator ─── */}
        {teamMembers.length > 0 && <div className="border-t border-border" />}

        {/* ─── Invite Team Members ─── */}
        {teamMembers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Invite Team Members</h3>
            <p className="text-[11px] text-muted-foreground mb-3">Add team members to collaborate with them on CLX</p>

            <div className="space-y-0.5">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    {member.avatar_url && (
                      <AvatarImage src={member.avatar_url} alt={member.name} />
                    )}
                    <AvatarFallback className={cn('text-white text-[11px] font-bold', getColorFromName(member.name))}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
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
