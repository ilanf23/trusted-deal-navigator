import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Paperclip, AlertTriangle, Clock } from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';

interface DealCardProps {
  id: string;
  companyName: string;
  contactName: string;
  contactCompany?: string | null;
  avatarUrl?: string | null;
  tags: { label: string; variant: 'default' | 'urgent' | 'stage' }[];
  nextAction: string | null;
  nextTouchDate?: string | null;
  attachmentCount?: number;
  isSelected?: boolean;
  isUrgent?: boolean;
  daysSinceActivity?: number;
  onClick: () => void;
}

const formatNextTouch = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isToday(date)) {
    return `Today, ${format(date, 'h:mm a')}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow, ${format(date, 'h:mm a')}`;
  }
  return format(date, 'EEE, h:mm a');
};

export const DealCard = memo(function DealCard({
  id,
  companyName,
  contactName,
  contactCompany,
  avatarUrl,
  tags,
  nextAction,
  nextTouchDate,
  attachmentCount = 0,
  isSelected = false,
  isUrgent = false,
  daysSinceActivity,
  onClick,
}: DealCardProps) {
  const nextTouchFormatted = formatNextTouch(nextTouchDate);
  
  return (
    <div
      onClick={onClick}
      className={`
        group relative px-4 py-3 cursor-pointer transition-all duration-150
        border-b border-slate-100 dark:border-slate-800
        ${isSelected 
          ? 'bg-slate-50 dark:bg-slate-800/80' 
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
        }
        ${isUrgent ? 'border-l-2 border-l-red-500' : ''}
      `}
    >
      {/* Unread indicator */}
      {isUrgent && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
      )}
      
      <div className="flex items-start justify-between gap-3">
        {/* Left: Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Company Name */}
          <h3 className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate leading-tight">
            {companyName}
          </h3>
          
          {/* Contact */}
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {contactName}
            {contactCompany && contactCompany !== companyName && (
              <span className="text-slate-400 dark:text-slate-500"> · {contactCompany}</span>
            )}
          </p>
          
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className={`
                  text-[11px] px-2 py-0.5 font-medium rounded-sm border-0
                  ${tag.variant === 'urgent' 
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                    : tag.variant === 'stage'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }
                `}
              >
                {tag.variant === 'urgent' && <AlertTriangle className="w-3 h-3 mr-1" />}
                {tag.label}
              </Badge>
            ))}
          </div>
          
          {/* Next Action */}
          {nextAction && (
            <p className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 dark:text-slate-500">→</span>
              <span className="truncate">{nextAction}</span>
            </p>
          )}
        </div>
        
        {/* Right: Avatar + Meta */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-700">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={contactName} />}
            <AvatarFallback className="text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {contactName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Next Touch */}
          {nextTouchFormatted && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Next touch</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{nextTouchFormatted}</p>
            </div>
          )}
          
          {/* Attachment count */}
          {attachmentCount > 0 && (
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <Paperclip className="w-3 h-3" />
              <span className="text-xs">{attachmentCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
