import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, ChevronDown, Check, Square } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { HtmlContent } from '@/components/ui/html-content';
import type { FeedActivity, FeedChecklistItem } from '@/hooks/useFeedData';

interface ActivityCardProps {
  activity: FeedActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onViewLead?: (leadId: string) => void;
}

const avatarColors: Record<string, string> = {
  E: 'bg-sky-500',
  B: 'bg-blue-500',
  M: 'bg-pink-500',
  W: 'bg-emerald-500',
  T: 'bg-slate-400',
  A: 'bg-amber-500',
  C: 'bg-violet-500',
  D: 'bg-teal-500',
  J: 'bg-rose-500',
  S: 'bg-indigo-500',
};

const getAvatarColor = (initial: string) => avatarColors[initial] || 'bg-gray-500';

const getTypeIcon = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call':
      return <Phone className="w-3 h-3 text-white" />;
    case 'email':
      return <Mail className="w-3 h-3 text-white" />;
    case 'sms':
      return <MessageSquare className="w-3 h-3 text-white" />;
    case 'note':
      return <StickyNote className="w-3 h-3 text-white" />;
    case 'lead_created':
      return <UserPlus className="w-3 h-3 text-white" />;
    case 'stage_change':
    case 'task_created':
      return <CheckSquare className="w-3 h-3 text-white" />;
    default:
      return null;
  }
};

const getTypeBadgeColor = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call': return 'bg-violet-600';
    case 'email': return 'bg-rose-500';
    case 'sms': return 'bg-emerald-500';
    case 'note': return 'bg-amber-500';
    case 'lead_created': return 'bg-sky-500';
    case 'stage_change': return 'bg-blue-500';
    case 'task_created': return 'bg-indigo-500';
    default: return 'bg-slate-400';
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

/** Parse checklist-style content (HTML with [ ] / [x] items) into rendered view-only checkboxes */
function ActivityContent({ content }: { content: string }) {
  if (!content) return null;

  // Detect checklist pattern: [ ] or [x] or [X]
  const hasChecklist = /\[[ xX]\]/.test(content);
  if (!hasChecklist) {
    // If HTML, render via HtmlContent; otherwise plain text
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return <HtmlContent value={content} className="text-sm text-muted-foreground" />;
    }
    return <>{content}</>;
  }

  // Strip HTML tags and split into lines
  const plain = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ');
  const lines = plain.split('\n').map(l => l.trim()).filter(Boolean);

  // Separate title (first non-checkbox line) from items
  const title = lines.length > 0 && !/^\[[ xX]\]/.test(lines[0]) ? lines[0] : null;
  const items = lines.filter(l => /^\[[ xX]\]/.test(l));

  return (
    <div className="space-y-1">
      {title && <span className="font-medium text-foreground text-xs">{title}</span>}
      {items.map((item, i) => {
        const checked = /^\[[xX]\]/.test(item);
        const text = item.replace(/^\[[ xX]\]\s*/, '');
        return (
          <div key={i} className="flex items-center gap-1.5">
            {checked ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            )}
            <span className={cn('text-xs', checked && 'line-through text-muted-foreground/60')}>
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ActivityCard = ({ activity, isExpanded, onToggle, onViewLead }: ActivityCardProps) => {
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

  return (
    <div
      onClick={onToggle}
      className={cn(
        'rounded-xl border border-border/60 mb-3 transition-all duration-200 cursor-pointer shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]',
        isExpanded
          ? 'bg-card ring-1 ring-primary/25 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.05),0_2px_4px_-2px_rgb(0_0_0/0.03)] border-primary/20'
          : 'bg-card hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.05),0_2px_4px_-2px_rgb(0_0_0/0.03)] hover:border-border'
      )}
    >
      <div className="flex gap-3.5 p-3.5 sm:p-4">
        {/* Left avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="w-9 h-9 sm:w-10 sm:h-10 ring-2 ring-background">
            {activity.actorAvatarUrl && (
              <AvatarImage src={activity.actorAvatarUrl} alt={activity.actorName} />
            )}
            <AvatarFallback
              className={cn(
                'text-white font-semibold text-xs',
                getAvatarColor(activity.actorInitial)
              )}
            >
              {activity.actorInitial}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] sm:w-5 sm:h-5 rounded-full flex items-center justify-center ring-2 ring-card shadow-sm',
            getTypeBadgeColor(activity.type)
          )}>
            {getTypeIcon(activity.type)}
          </div>
        </div>

        {/* Card content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-semibold text-foreground tracking-tight">{activity.actorName}</span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/70 rounded-full text-[11px] text-muted-foreground font-medium">
              {getTypeLabel(activity.type)}
            </span>
            <span className="text-muted-foreground/50 text-xs ml-auto font-medium tabular-nums">{activity.time}</span>
          </div>

          {/* Lead info */}
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground/70 text-xs">re: </span>
            <span className="font-medium text-foreground">{activity.leadName}</span>
            {activity.leadCompany && (
              <span className="text-muted-foreground/60"> — {activity.leadCompany}</span>
            )}
          </div>

          {/* Content preview (clamped when collapsed) */}
          <div className={cn('mt-2 text-sm text-muted-foreground/80 leading-relaxed', !isExpanded && 'line-clamp-2')}>
            <ActivityContent content={activity.content} />
          </div>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 pt-0.5">
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground/40 transition-transform duration-200',
              isExpanded && 'rotate-180 text-muted-foreground'
            )}
          />
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div className="border-t border-border/50 px-3.5 sm:px-4 py-3.5 space-y-3 bg-muted/20">
          {/* Metadata badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {activity.direction && (
              <span className="inline-flex items-center px-2.5 py-1 bg-muted/80 rounded-full text-[11px] text-muted-foreground font-medium">
                {activity.direction}
              </span>
            )}
            {activity.stage && (
              <span className="inline-flex items-center px-2.5 py-1 bg-primary/8 text-primary rounded-full text-[11px] font-medium border border-primary/10">
                {activity.stage}
              </span>
            )}
          </div>

          {/* Checklist items (from lead_checklists) */}
          {activity.checklistItems && activity.checklistItems.length > 0 && (
            <div className="space-y-1.5">
              {activity.checklistTitle && (
                <span className="font-medium text-foreground text-xs">{activity.checklistTitle}</span>
              )}
              {activity.checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {item.isChecked ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className={cn('text-xs', item.isChecked && 'line-through text-muted-foreground/60')}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {activity.leadId && (
              <button
                onClick={handleViewLead}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border/80 text-foreground hover:bg-muted/80 hover:border-border transition-all duration-150 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]"
              >
                View Lead
              </button>
            )}
            {activity.type === 'email' && (
              <button
                onClick={handleAction}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shadow-[0_1px_3px_0_hsl(217_91%_50%/0.3)]"
              >
                Reply
              </button>
            )}
            {activity.type === 'call' && (
              <button
                onClick={handleAction}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shadow-[0_1px_3px_0_hsl(217_91%_50%/0.3)]"
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
