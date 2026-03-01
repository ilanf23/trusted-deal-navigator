import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Activity } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface FeedLeftPanelProps {
  selectedTeamMember: string | null;
  onTeamMemberSelect: (member: string | null) => void;
  teamMembers: TeamMember[];
  activityCounts: { today: number; thisWeek: number };
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
          .filter((m) => m.name.toLowerCase() !== 'adam')
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
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3 px-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Activity Summary
          </span>
        </div>
        <div className="space-y-2 px-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Today</span>
            <span className="text-sm font-semibold text-foreground">{activityCounts.today}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This week</span>
            <span className="text-sm font-semibold text-foreground">{activityCounts.thisWeek}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
