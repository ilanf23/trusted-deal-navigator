import { Phone, PhoneIncoming, PhoneOutgoing, Mail, MessageSquare, AlertTriangle, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Touchpoint {
  type: string;
  direction: string;
  date: string;
}

// ── Color system (call=emerald, email=blue, sms=violet) ──

const chipStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  call: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  email: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  sms: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
  },
};

const defaultStyle = chipStyles.call;

function getStyle(type: string) {
  return chipStyles[type] || defaultStyle;
}

function getIcon(type: string, direction: string, size = 'w-3 h-3') {
  const style = getStyle(type);
  if (type === 'call') {
    return direction === 'inbound'
      ? <PhoneIncoming className={cn(size, style.text)} />
      : <PhoneOutgoing className={cn(size, style.text)} />;
  }
  if (type === 'email') {
    return <Mail className={cn(size, style.text)} />;
  }
  if (type === 'sms') {
    return <MessageSquare className={cn(size, style.text)} />;
  }
  return <Phone className={cn(size, style.text)} />;
}

function getLabel(type: string, direction: string) {
  if (type === 'call') return direction === 'inbound' ? 'Inbound call' : 'Outbound call';
  if (type === 'email') return direction === 'inbound' ? 'Email received' : 'Email sent';
  if (type === 'sms') return direction === 'inbound' ? 'SMS received' : 'SMS sent';
  return type;
}

function getShortLabel(type: string, direction: string) {
  if (type === 'call') return direction === 'inbound' ? 'Inbound' : 'Outbound';
  if (type === 'email') return 'Email';
  if (type === 'sms') return 'SMS';
  return type;
}

// ── Staleness helpers ──

type Staleness = 'fresh' | 'aging' | 'stale';

function getStaleness(date: string): Staleness {
  const days = differenceInDays(new Date(), new Date(date));
  if (days <= 3) return 'fresh';
  if (days <= 7) return 'aging';
  return 'stale';
}

const stalenessDot: Record<Staleness, string> = {
  fresh: 'bg-emerald-500',
  aging: 'bg-amber-500',
  stale: 'bg-rose-500 animate-pulse',
};

// ══════════════════════════════════════════════════════
// ── Pill variant — for LeadCard (Kanban) ──
// ══════════════════════════════════════════════════════

interface TouchpointPillProps {
  touchpoint: Touchpoint | undefined | null;
  /** Show relative time (default true, false on tablet) */
  showTime?: boolean;
}

export function TouchpointPill({ touchpoint, showTime = true }: TouchpointPillProps) {
  if (!touchpoint) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-xs font-medium animate-pulse">
        <Calendar className="w-3 h-3" />
        <span>No contact yet</span>
      </div>
    );
  }

  const style = getStyle(touchpoint.type);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
          style.bg, style.text, style.border,
        )}>
          {getIcon(touchpoint.type, touchpoint.direction)}
          <span>{getShortLabel(touchpoint.type, touchpoint.direction)}</span>
          {showTime && (
            <span className="opacity-60 ml-0.5">
              {formatDistanceToNow(new Date(touchpoint.date), { addSuffix: false })}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {getLabel(touchpoint.type, touchpoint.direction)} — {new Date(touchpoint.date).toLocaleDateString()}
      </TooltipContent>
    </Tooltip>
  );
}

// ══════════════════════════════════════════════════════
// ── Table cell variant — for CRMBoard / Pipeline ──
// ══════════════════════════════════════════════════════

interface TouchpointCellProps {
  touchpoint: Touchpoint | undefined | null;
  /** Show staleness-colored dot (default false) */
  showStaleness?: boolean;
}

export function TouchpointCell({ touchpoint, showStaleness = false }: TouchpointCellProps) {
  if (!touchpoint) {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">No contact</span>
      </div>
    );
  }

  const style = getStyle(touchpoint.type);
  const staleness = getStaleness(touchpoint.date);
  const dotColor = showStaleness ? stalenessDot[staleness] : style.dot;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
            <span className={cn('text-xs font-medium capitalize', style.text)}>
              {touchpoint.type}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-3.5">
            {formatDistanceToNow(new Date(touchpoint.date), { addSuffix: true })}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {getLabel(touchpoint.type, touchpoint.direction)} — {new Date(touchpoint.date).toLocaleDateString()}
      </TooltipContent>
    </Tooltip>
  );
}
