import { useState } from 'react';
import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, Maximize2, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { FeedActivity } from '@/hooks/useFeedData';

interface ActivityCardProps {
  activity: FeedActivity;
}

const avatarColors: Record<string, string> = {
  E: 'bg-sky-600',
  B: 'bg-blue-600',
  M: 'bg-pink-600',
  W: 'bg-emerald-600',
  T: 'bg-gray-500',
  A: 'bg-amber-600',
  C: 'bg-violet-600',
  D: 'bg-teal-600',
  J: 'bg-rose-600',
  S: 'bg-indigo-600',
};

const getAvatarColor = (initial: string) => avatarColors[initial] || 'bg-gray-500';

const getTypeIcon = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call':
      return <Phone className="w-2.5 h-2.5 text-white" />;
    case 'email':
      return <Mail className="w-2.5 h-2.5 text-white" />;
    case 'sms':
      return <MessageSquare className="w-2.5 h-2.5 text-white" />;
    case 'note':
      return <StickyNote className="w-2.5 h-2.5 text-white" />;
    case 'lead_created':
      return <UserPlus className="w-2.5 h-2.5 text-white" />;
    case 'stage_change':
    case 'task_created':
      return <CheckSquare className="w-2.5 h-2.5 text-white" />;
    default:
      return null;
  }
};

const getTypeBadgeColor = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call': return 'bg-[#5B21B6]';
    case 'email': return 'bg-red-500';
    case 'sms': return 'bg-green-500';
    case 'note': return 'bg-amber-500';
    case 'lead_created': return 'bg-emerald-500';
    case 'stage_change': return 'bg-blue-500';
    case 'task_created': return 'bg-teal-500';
    default: return 'bg-gray-500';
  }
};

const getTypeLabel = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call': return 'Phone Call';
    case 'email': return 'Email';
    case 'sms': return 'SMS';
    case 'note': return 'Note';
    case 'lead_created': return 'New Lead';
    case 'lead_updated': return 'Lead Updated';
    case 'task_created': return 'Task Created';
    case 'stage_change': return 'Stage Change';
    default: return 'Activity';
  }
};

const ActivityCard = ({ activity }: ActivityCardProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] mb-3 relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-3 p-4">
        {/* Left avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="w-11 h-11">
            {activity.actorAvatarUrl && (
              <AvatarImage src={activity.actorAvatarUrl} alt={activity.actorName} />
            )}
            <AvatarFallback
              className={cn(
                'text-white font-bold text-sm',
                getAvatarColor(activity.actorInitial)
              )}
            >
              {activity.actorInitial}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            'absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center',
            getTypeBadgeColor(activity.type)
          )}>
            {getTypeIcon(activity.type)}
          </div>
        </div>

        {/* Card content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 flex-wrap text-sm">
            <span className="font-semibold text-foreground">{activity.actorName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-[11px] text-muted-foreground font-medium">
              {getTypeLabel(activity.type)}
            </span>
            {activity.direction && (
              <span className="text-[11px] text-muted-foreground/60">
                ({activity.direction})
              </span>
            )}
            <span className="text-muted-foreground/60 text-xs ml-auto">{activity.time}</span>
          </div>

          {/* Lead info */}
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground">re: </span>
            <span className="font-medium text-foreground">{activity.leadName}</span>
            {activity.leadCompany && (
              <span className="text-muted-foreground"> — {activity.leadCompany}</span>
            )}
          </div>

          {/* Stage badge */}
          {activity.stage && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
              {activity.stage}
            </span>
          )}

          {/* Content preview */}
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {activity.content}
          </p>
        </div>
      </div>

      {/* Hover controls */}
      {hovered && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityCard;
