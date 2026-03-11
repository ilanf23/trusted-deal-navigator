import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, ChevronDown, Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useCall } from '@/contexts/CallContext';
import { HtmlContent } from '@/components/ui/html-content';
import type { FeedActivity } from '@/hooks/useFeedData';

interface ActivityCardProps {
  activity: FeedActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onViewLead?: (leadId: string) => void;
}

const avatarColors: Record<string, string> = {
  E: 'bg-sky-500',
  B: 'bg-blue-600',
  M: 'bg-pink-500',
  W: 'bg-emerald-500',
  T: 'bg-slate-400',
  A: 'bg-amber-500',
  C: 'bg-violet-500',
  D: 'bg-teal-500',
  J: 'bg-rose-500',
  S: 'bg-indigo-500',
  R: 'bg-orange-500',
  K: 'bg-purple-500',
};

const getAvatarColor = (initial: string) => avatarColors[initial] || 'bg-gray-400';

const getTypeLabel = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call': return 'logged a Phone Call';
    case 'email': return '';
    case 'sms': return 'sent an SMS';
    case 'note': return 'logged a Note';
    case 'lead_created': return 'created a Lead';
    case 'lead_updated': return 'updated a Lead';
    case 'task_created': return 'created a Task';
    case 'stage_change': return 'changed the Stage';
    default: return 'logged an Activity';
  }
};

const getEntityLabel = (activity: FeedActivity) => {
  if (activity.source === 'people') return 'the Person';
  if (activity.leadId) return 'the Lead';
  return '';
};

/** Parse checklist-style content */
function ActivityContent({ content }: { content: string }) {
  if (!content) return null;

  const hasChecklist = /\[[ xX]\]/.test(content);
  if (!hasChecklist) {
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return <HtmlContent value={content} className="text-[13px] text-gray-600 leading-relaxed" />;
    }
    return <span className="text-[13px] text-gray-600 leading-relaxed">{content}</span>;
  }

  const plain = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ');
  const lines = plain.split('\n').map(l => l.trim()).filter(Boolean);

  const title = lines.length > 0 && !/^\[[ xX]\]/.test(lines[0]) ? lines[0] : null;
  const items = lines.filter(l => /^\[[ xX]\]/.test(l));

  return (
    <div className="space-y-1">
      {title && <span className="font-medium text-gray-700 text-xs">{title}</span>}
      {items.map((item, i) => {
        const checked = /^\[[xX]\]/.test(item);
        const text = item.replace(/^\[[ xX]\]\s*/, '');
        return (
          <div key={i} className="flex items-center gap-1.5">
            {checked ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            )}
            <span className={cn('text-xs', checked && 'line-through text-gray-400')}>
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ActivityCard = ({ activity, isExpanded, onToggle, onViewLead }: ActivityCardProps) => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const { makeOutboundCall } = useCall();

  const handleViewLead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.leadId && onViewLead) {
      onViewLead(activity.leadId);
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = teamMember?.name?.toLowerCase() || 'evan';
    const params = new URLSearchParams({ compose: 'true' });
    if (activity.leadId) params.set('leadId', activity.leadId);
    navigate(`/admin/${name}/gmail?${params.toString()}`);
  };

  const handleCallBack = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.phoneNumber) {
      await makeOutboundCall(activity.phoneNumber, activity.leadId || undefined, activity.leadName);
    } else if (activity.leadId && onViewLead) {
      onViewLead(activity.leadId);
    }
  };

  const isEmail = activity.type === 'email';
  const typeLabel = getTypeLabel(activity.type);
  const entityLabel = getEntityLabel(activity);

  return (
    <div
      onClick={onToggle}
      className={cn(
        'py-3.5 px-1 border-b border-gray-100 cursor-pointer transition-colors',
        isExpanded ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold',
              getAvatarColor(activity.actorInitial)
            )}
          >
            {activity.actorInitial}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header line */}
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] leading-snug">
              {isEmail ? (
                <>
                  <span className="font-semibold text-gray-900">{activity.actorName}</span>
                  {activity.direction === 'outbound' ? ' to ' : ' from '}
                  <span className="font-semibold text-gray-900">{activity.leadName}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{activity.actorName}</span>
                  <span className="text-gray-500">
                    {' '}{typeLabel}{entityLabel ? ` to ${entityLabel}` : ''}
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap mt-0.5 tabular-nums">
              {activity.time}
            </span>
          </div>

          {/* Lead/contact link */}
          {!isEmail && (
            <div className="mt-0.5">
              <button
                onClick={handleViewLead}
                className="text-[13px] font-medium text-blue-600 hover:underline"
              >
                {activity.leadName}
              </button>
              {activity.leadCompany && (
                <span className="text-[13px] text-gray-400"> — {activity.leadCompany}</span>
              )}
            </div>
          )}

          {/* Content preview */}
          <div className={cn('mt-1.5', !isExpanded && 'line-clamp-2')}>
            <ActivityContent content={activity.content} />
          </div>

          {/* Expanded section */}
          {isExpanded && (
            <div className="mt-3 space-y-3">
              {/* Metadata badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {activity.direction && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-medium">
                    {activity.direction}
                  </span>
                )}
                {activity.stage && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[11px] font-medium">
                    {activity.stage}
                  </span>
                )}
              </div>

              {/* Checklist items */}
              {activity.checklistItems && activity.checklistItems.length > 0 && (
                <div className="space-y-1.5">
                  {activity.checklistTitle && (
                    <span className="font-medium text-gray-700 text-xs">{activity.checklistTitle}</span>
                  )}
                  {activity.checklistItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {item.isChecked ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      )}
                      <span className={cn('text-xs', item.isChecked && 'line-through text-gray-400')}>
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
                    className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View Lead
                  </button>
                )}
                {activity.type === 'email' && (
                  <button
                    onClick={handleReply}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    Reply
                  </button>
                )}
                {activity.type === 'call' && (
                  <button
                    onClick={handleCallBack}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    Call Back
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lead detail link — collapsed state */}
          {!isExpanded && activity.leadId && (
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleViewLead}
                className="text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                View details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
