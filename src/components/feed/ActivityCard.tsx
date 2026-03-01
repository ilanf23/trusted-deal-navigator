import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, ChevronDown, Check } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { FeedActivity } from '@/hooks/useFeedData';

interface ActivityCardProps {
  activity: FeedActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onViewLead?: (leadId: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
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

const ActivityCard = ({ activity, isExpanded, onToggle, onViewLead, isSelected, onSelect }: ActivityCardProps) => {
  const { toast } = useToast();

  const handleViewLead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.leadId && onViewLead) {
      onViewLead(activity.leadId);
    }
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: 'Coming soon', description: 'This action is not yet available.' });
  };

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(activity.id);
  };

  return (
    <div
      onClick={onToggle}
      className={cn(
        'rounded-lg border mb-3 transition-all cursor-pointer',
        isSelected
          ? 'bg-primary/5 ring-1 ring-primary/30 border-primary/30'
          : isExpanded
            ? 'bg-card ring-1 ring-primary/20'
            : 'bg-card hover:bg-muted/50'
      )}
    >
      <div className="flex gap-3 p-3 sm:p-4">
        {/* Selection checkbox */}
        <button
          onClick={handleCheckbox}
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-1',
            isSelected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/30 hover:border-primary/50'
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
        </button>

        {/* Left avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="w-9 h-9 sm:w-11 sm:h-11">
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
            'absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center',
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

          {/* Content preview (clamped when collapsed) */}
          <p className={cn('mt-1.5 text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}>
            {activity.content}
          </p>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 pt-1">
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div className="border-t border-border px-3 sm:px-4 py-3 space-y-3">
          {/* Metadata badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {activity.direction && (
              <span className="inline-flex items-center px-2 py-0.5 bg-muted rounded-full text-[11px] text-muted-foreground font-medium">
                {activity.direction}
              </span>
            )}
            {activity.stage && (
              <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
                {activity.stage}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {activity.leadId && (
              <button
                onClick={handleViewLead}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                View Lead
              </button>
            )}
            {activity.type === 'email' && (
              <button
                onClick={handleAction}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Reply
              </button>
            )}
            {activity.type === 'call' && (
              <button
                onClick={handleAction}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Call Back
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCard;
