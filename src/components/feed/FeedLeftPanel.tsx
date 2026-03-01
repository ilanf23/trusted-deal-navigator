import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Activity, Phone, Mail, MessageSquare, StickyNote, CheckSquare, UserPlus } from 'lucide-react';

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

const FeedLeftPanel = ({
  selectedTeamMember,
  onTeamMemberSelect,
  teamMembers,
  activityCounts,
  isSheet,
}: FeedLeftPanelProps) => {
  return (
    <div className={cn(
      'bg-card flex flex-col h-full overflow-hidden',
      isSheet
        ? 'w-full'
        : 'w-[240px] min-w-[240px] 2xl:w-[270px] 2xl:min-w-[270px] border-r border-border'
    )}>
      {/* Team filter */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => onTeamMemberSelect(null)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            !selectedTeamMember
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-muted'
          )}
        >
          <div className="p-1.5 rounded-lg bg-muted">
            <Users className="w-4 h-4" />
          </div>
          All Team
        </button>

        {teamMembers
          .filter((m) => !['adam', 'ilan', 'brad'].includes(m.name.toLowerCase()))
          .map((member) => (
            <button
              key={member.id}
              onClick={() =>
                onTeamMemberSelect(
                  selectedTeamMember === member.name ? null : member.name
                )
              }
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                selectedTeamMember === member.name
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Avatar className="w-9 h-9">
                {member.avatar_url && (
                  <AvatarImage src={member.avatar_url} alt={member.name} />
                )}
                <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
                  {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {member.name}
            </button>
          ))}
      </div>

      <div className="mx-3 border-t border-border" />

      {/* Activity Summary */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3 px-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Activity Summary
          </span>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 px-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last 30 days</span>
            <span className="text-sm font-semibold text-foreground">{activityCounts.last30Days}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-sm font-semibold text-foreground">{activityCounts.total}</span>
          </div>
        </div>

        <div className="mx-3 border-t border-border mb-3" />

        {/* Breakdown by type */}
        <div className="space-y-1.5 px-3">
          {[
            { icon: Phone, label: 'Calls', count: activityCounts.calls, color: 'text-violet-400' },
            { icon: Mail, label: 'Emails', count: activityCounts.emails, color: 'text-red-400' },
            { icon: MessageSquare, label: 'SMS', count: activityCounts.sms, color: 'text-green-400' },
            { icon: StickyNote, label: 'Notes', count: activityCounts.notes, color: 'text-amber-400' },
            { icon: CheckSquare, label: 'Tasks', count: activityCounts.tasks, color: 'text-teal-400' },
            { icon: UserPlus, label: 'New Leads', count: activityCounts.leads, color: 'text-emerald-400' },
          ].map(({ icon: Icon, label, count, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-3.5 h-3.5', color)} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
