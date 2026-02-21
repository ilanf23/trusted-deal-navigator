import { useState } from 'react';
import { Lock, Unlock, Smile, MessageSquarePlus, Paperclip, ChevronDown, Maximize2, Link2, MoreHorizontal, Phone, Mail, Send, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityItem } from './feedMockData';

interface ActivityCardProps {
  activity: ActivityItem;
}

const avatarColors: Record<string, string> = {
  B: 'bg-blue-600',
  C: 'bg-amber-600',
  V: 'bg-violet-600',
  W: 'bg-emerald-600',
  G: 'bg-teal-600',
  J: 'bg-rose-600',
  S: 'bg-indigo-600',
  M: 'bg-pink-600',
  E: 'bg-sky-600',
};

const getAvatarColor = (initial: string) => avatarColors[initial] || 'bg-gray-500';

const getBadgeIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'email_received':
      return (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <Mail className="w-2.5 h-2.5 text-white" />
        </div>
      );
    case 'email_sent':
    case 'calendar_invite':
      return (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <Send className="w-2.5 h-2.5 text-white" />
        </div>
      );
    case 'phone_call':
      return (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#5B21B6] flex items-center justify-center">
          <Phone className="w-2.5 h-2.5 text-white" />
        </div>
      );
    default:
      return null;
  }
};

const ActivityCard = ({ activity }: ActivityCardProps) => {
  const [isPrivate, setIsPrivate] = useState(activity.isPrivate ?? false);
  const [hovered, setHovered] = useState(false);
  const isEmailOrInvite = ['email_sent', 'email_received', 'calendar_invite'].includes(activity.type);
  const isNonEmail = ['phone_call', 'note'].includes(activity.type);

  return (
    <div
      className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] mb-3 relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-3 p-4">
        {/* Left avatar */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm',
              getAvatarColor(activity.senderInitial)
            )}
          >
            {activity.senderInitial}
          </div>
          {getBadgeIcon(activity.type)}
        </div>

        {/* Card content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          {isEmailOrInvite ? (
            <div className="flex items-center gap-1.5 flex-wrap text-sm">
              <span className="font-semibold text-foreground">{activity.senderName}</span>
              <span className="text-muted-foreground">to</span>
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold',
                    getAvatarColor(activity.recipientInitial)
                  )}
                >
                  {activity.recipientInitial}
                </div>
                <span className="font-medium text-foreground">{activity.recipientName}</span>
              </div>
              {activity.threadCount && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded-full text-[11px] text-muted-foreground ml-1">
                  {activity.threadCount}
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B21B6]" />
                  <ChevronDown className="w-3 h-3" />
                </span>
              )}
              {activity.isPrivate !== undefined && (
                <Lock className="w-3.5 h-3.5 text-muted-foreground/60 ml-1" />
              )}
              <span className="text-muted-foreground/60 text-xs ml-1">| {activity.time}</span>
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-semibold text-foreground">{activity.senderName}</span>
              <span className="text-muted-foreground">
                {activity.type === 'phone_call'
                  ? ' logged a Phone Call to the Person '
                  : ' logged a Note to '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold inline-flex',
                    getAvatarColor(activity.recipientInitial)
                  )}
                >
                  {activity.recipientInitial}
                </span>
                <span className="font-medium text-foreground">{activity.recipientName}</span>
              </span>
              <div className="text-xs text-muted-foreground/60 mt-0.5">{activity.time}</div>
            </div>
          )}

          {/* Subject + preview */}
          <div className="mt-1.5 text-sm">
            {activity.subject && (
              <>
                <span className="font-semibold text-foreground">{activity.subject}</span>
                <span className="text-muted-foreground"> — </span>
              </>
            )}
            <span className="text-muted-foreground">{activity.preview}</span>
          </div>

          {/* Attachments */}
          {activity.attachments && activity.attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {activity.attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-xs text-foreground"
                >
                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                  {att.name}
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
                </span>
              ))}
              {activity.overflowAttachments && activity.overflowAttachments > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 bg-muted rounded-full text-xs text-foreground">
                  +{activity.overflowAttachments}
                </span>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-4 mt-3 text-muted-foreground/60">
            {isEmailOrInvite && (
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className="flex items-center gap-1 text-xs hover:text-muted-foreground transition-colors"
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}
            <button className="flex items-center gap-1 text-xs hover:text-muted-foreground transition-colors">
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 text-xs hover:text-muted-foreground transition-colors">
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
            {activity.showReplyAll && (
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1 transition-colors">
                <Reply className="w-3.5 h-3.5" />
                Reply All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hover controls */}
      {hovered && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground">
            <Link2 className="w-4 h-4" />
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
