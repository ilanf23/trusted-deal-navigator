import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Phone, Mail, MessageSquare, StickyNote, CheckSquare, UserPlus } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface FeedLeftPanelProps {
  selectedTeamMember: string | null;
  onTeamMemberSelect: (member: string | null) => void;
  teamMembers: TeamMember[];
  activityCounts: {
    total: number;
    last30Days: number;
    calls: number;
    emails: number;
    sms: number;
    notes: number;
    tasks: number;
    leads: number;
  };
  isSheet?: boolean;
}

const statRows = [
  { icon: Phone, label: 'Calls', key: 'calls' as const, color: 'text-violet-500' },
  { icon: Mail, label: 'Emails', key: 'emails' as const, color: 'text-rose-500' },
  { icon: MessageSquare, label: 'SMS', key: 'sms' as const, color: 'text-emerald-500' },
  { icon: StickyNote, label: 'Notes', key: 'notes' as const, color: 'text-amber-500' },
  { icon: CheckSquare, label: 'Tasks', key: 'tasks' as const, color: 'text-indigo-500' },
  { icon: UserPlus, label: 'New Leads', key: 'leads' as const, color: 'text-sky-500' },
];

const FeedLeftPanel = ({
  selectedTeamMember,
  onTeamMemberSelect,
  teamMembers,
  activityCounts,
  isSheet,
}: FeedLeftPanelProps) => {
  const visibleMembers = teamMembers.filter(
    (m) => !['adam', 'ilan'].includes(m.name.toLowerCase())
  );

  return (
    <div
      className={cn(
        'bg-card flex flex-col h-full overflow-hidden',
        isSheet ? 'w-full' : 'w-[250px] min-w-[250px] border-r border-border/70'
      )}
    >
      {/* Team Members */}
      <div className="px-3 pt-5 pb-2">
        <span className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center block">
          Team
        </span>
      </div>

      <div className="px-2 space-y-0.5">
        <button
          onClick={() => onTeamMemberSelect(null)}
          className={cn(
            'w-full flex justify-center py-2 rounded-lg text-sm transition-all duration-150',
            !selectedTeamMember
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground/70 hover:bg-muted hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-3 w-28">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                !selectedTeamMember ? 'bg-primary/15' : 'bg-muted'
              )}
            >
              <Users className="w-4 h-4" />
            </div>
            All Team
          </div>
        </button>

        {visibleMembers.map((member) => {
          const isActive = selectedTeamMember === member.name;
          return (
            <button
              key={member.id}
              onClick={() => onTeamMemberSelect(isActive ? null : member.name)}
              className={cn(
                'w-full flex justify-center py-2 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3 w-28">
                <Avatar className="w-8 h-8 shrink-0">
                  {member.avatar_url && (
                    <AvatarImage src={member.avatar_url} alt={member.name} />
                  )}
                  <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {member.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-4 my-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Activity Summary */}
      <div className="px-3 pb-2.5">
        <span className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Activity
        </span>
      </div>

      <div className="px-4 space-y-3 flex-1 overflow-y-auto pb-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-muted/70 px-3.5 py-2.5 border border-border/50">
            <p className="text-lg font-bold text-foreground leading-tight tabular-nums tracking-tight">{activityCounts.last30Days}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Last 30 days</p>
          </div>
          <div className="rounded-xl bg-muted/70 px-3.5 py-2.5 border border-border/50">
            <p className="text-lg font-bold text-foreground leading-tight tabular-nums tracking-tight">{activityCounts.total}</p>
            <p className="text-[11px] text-muted-foreground font-medium">All time</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-1">
          {statRows.map(({ icon: Icon, label, key, color }) => (
            <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/60 transition-colors duration-100">
              <div className="flex items-center gap-2.5">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground tracking-tight">
                {activityCounts[key]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
