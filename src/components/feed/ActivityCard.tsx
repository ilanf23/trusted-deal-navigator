import { useState, useRef, useEffect } from 'react';
import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, Check, Square, Reply, SmilePlus, Loader2, Send, CalendarDays, Video, FileText, FileSignature, HelpCircle, BarChart3, Pause, Mailbox, ListChecks, ExternalLink, User, RefreshCw, ClipboardList, Building2, Clock, AtSign, ArrowUpRight, ArrowDownLeft, ArrowRight, Tag, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useCall } from '@/contexts/CallContext';
import { HtmlContent } from '@/components/ui/html-content';
import { useFeedComments, useAddFeedComment, useFeedReactions, useToggleFeedReaction } from '@/hooks/useFeedInteractions';
import { formatDistanceToNow, format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import type { FeedActivity } from '@/hooks/useFeedData';

interface ActivityCardProps {
  activity: FeedActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onViewLead?: (leadId: string) => void;
}

/* ── Recipient initial colors ── */
const recipientColors: Record<string, string> = {
  G: 'bg-amber-500',
  M: 'bg-blue-500',
  W: 'bg-purple-500',
  S: 'bg-indigo-500',
  A: 'bg-amber-500',
  B: 'bg-sky-500',
  C: 'bg-teal-500',
  D: 'bg-rose-500',
  E: 'bg-pink-500',
  J: 'bg-orange-500',
  K: 'bg-violet-500',
  L: 'bg-lime-600',
  R: 'bg-red-500',
  T: 'bg-cyan-600',
};

const getRecipientColor = (initial: string) => recipientColors[initial] || 'bg-gray-400';

/* ── Sub-type badge mapping (matches filter items) ── */
const SUB_TYPE_ICONS: Record<string, { icon: LucideIcon; bg: string }> = {
  'annual follow up':           { icon: CalendarDays,   bg: 'bg-teal-500' },
  'annual_follow_up':           { icon: CalendarDays,   bg: 'bg-teal-500' },
  'clx agr. out for esignature':{ icon: FileSignature,  bg: 'bg-violet-500' },
  'clx_agreement':              { icon: FileSignature,  bg: 'bg-violet-500' },
  'email':                      { icon: Mail,           bg: 'bg-rose-500' },
  'follow up':                  { icon: RefreshCw,      bg: 'bg-sky-500' },
  'follow_up':                  { icon: RefreshCw,      bg: 'bg-sky-500' },
  'form':                       { icon: FileText,       bg: 'bg-slate-500' },
  'lender needs list':          { icon: ListChecks,     bg: 'bg-amber-600' },
  'lender_needs_list':          { icon: ListChecks,     bg: 'bg-amber-600' },
  'lender q&a':                 { icon: HelpCircle,     bg: 'bg-cyan-600' },
  'lender_qa':                  { icon: HelpCircle,     bg: 'bg-cyan-600' },
  'mail':                       { icon: Mailbox,        bg: 'bg-orange-400' },
  'meeting':                    { icon: CalendarDays,   bg: 'bg-indigo-500' },
  'note':                       { icon: StickyNote,     bg: 'bg-yellow-500' },
  'phone call':                 { icon: Phone,          bg: 'bg-green-500' },
  'call':                       { icon: Phone,          bg: 'bg-green-500' },
  'prep projections':           { icon: BarChart3,      bg: 'bg-purple-500' },
  'prep_projections':           { icon: BarChart3,      bg: 'bg-purple-500' },
  'review financials':          { icon: ClipboardList,  bg: 'bg-emerald-600' },
  'review_financials':          { icon: ClipboardList,  bg: 'bg-emerald-600' },
  'sms':                        { icon: MessageSquare,  bg: 'bg-blue-500' },
  'to do':                      { icon: CheckSquare,    bg: 'bg-purple-600' },
  'todo':                       { icon: CheckSquare,    bg: 'bg-purple-600' },
  'uw paused - need info':      { icon: Pause,          bg: 'bg-red-500' },
  'uw_paused':                  { icon: Pause,          bg: 'bg-red-500' },
  'zoom call':                  { icon: Video,          bg: 'bg-blue-600' },
  'zoom':                       { icon: Video,          bg: 'bg-blue-600' },
};

const getTypeIcon = (type: FeedActivity['type'], direction?: string, subType?: string) => {
  if (subType) {
    const match = SUB_TYPE_ICONS[subType.toLowerCase()];
    if (match) return match;
  }
  switch (type) {
    case 'email':
      return direction === 'outbound'
        ? { icon: Mail, bg: 'bg-rose-500' }
        : { icon: Mail, bg: 'bg-green-500' };
    case 'call':
      return { icon: Phone, bg: 'bg-green-500' };
    case 'sms':
      return { icon: MessageSquare, bg: 'bg-blue-500' };
    case 'note':
      return { icon: StickyNote, bg: 'bg-yellow-500' };
    case 'task_created':
      return { icon: CheckSquare, bg: 'bg-purple-500' };
    case 'lead_created':
      return { icon: UserPlus, bg: 'bg-emerald-500' };
    case 'stage_change':
      return { icon: RefreshCw, bg: 'bg-indigo-500' };
    default:
      return { icon: ClipboardList, bg: 'bg-gray-400' };
  }
};

const getTypeLabel = (type: FeedActivity['type']) => {
  switch (type) {
    case 'call': return 'logged a Phone Call';
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

/** Detect and parse a stage-change JSON payload like {"from":"Client","to":"Prospect"} */
function parseStageChange(content: string): { from: string; to: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'from' in parsed && 'to' in parsed) {
      const from = String(parsed.from ?? '').trim();
      const to = String(parsed.to ?? '').trim();
      if (from || to) return { from: from || '—', to: to || '—' };
    }
  } catch {
    return null;
  }
  return null;
}

function StagePill({ label, tone }: { label: string; tone: 'from' | 'to' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold tracking-normal',
        tone === 'from'
          ? 'bg-gray-100 text-gray-500 line-through decoration-gray-400'
          : 'bg-purple-50 text-[#3b2778]'
      )}
    >
      {label}
    </span>
  );
}

function StageChangePreview({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StagePill label={from} tone="from" />
      <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
      <StagePill label={to} tone="to" />
    </div>
  );
}

/** Parse checklist-style content */
function ActivityContent({ content }: { content: string }) {
  if (!content) return null;

  const stageChange = parseStageChange(content);
  if (stageChange) {
    return <StageChangePreview from={stageChange.from} to={stageChange.to} />;
  }

  const hasChecklist = /\[[ xX]\]/.test(content);
  if (!hasChecklist) {
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return <HtmlContent value={content} className="text-[14px] text-gray-600 leading-relaxed" />;
    }
    return <span className="text-[14px] text-gray-600 leading-relaxed">{content}</span>;
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
      {title && <span className="font-medium text-gray-700 text-sm">{title}</span>}
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

function EmailContentPreview({ subject, content, isExpanded }: { subject?: string | null; content: string; isExpanded: boolean }) {
  return (
    <div>
      {subject && (
        <p className="text-[14px] font-semibold text-gray-900 mb-1 tracking-normal">{subject}</p>
      )}
      {content && (
        <p className={cn('text-[14px] text-gray-600 leading-relaxed tracking-normal', !isExpanded && 'line-clamp-2')}>
          {content}
        </p>
      )}
    </div>
  );
}

const EMOJI_PRESETS = [
  { key: 'thumbsup', char: '👍' },
  { key: 'heart', char: '❤️' },
  { key: 'fire', char: '🔥' },
  { key: 'clap', char: '👏' },
  { key: 'eyes', char: '👀' },
  { key: 'rocket', char: '🚀' },
  { key: 'tada', char: '🎉' },
  { key: 'thinking', char: '🤔' },
];

const emojiCharMap: Record<string, string> = Object.fromEntries(EMOJI_PRESETS.map(e => [e.key, e.char]));

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

function ActivityAvatar({
  actorInitial,
  typeBg,
  TypeIcon,
}: {
  actorInitial: string;
  typeBg: string;
  TypeIcon: LucideIcon;
}) {
  return (
    <div className="relative w-10 h-10 shrink-0">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold">
        {actorInitial}
      </div>
      <div
        className={cn(
          'absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white',
          typeBg
        )}
        aria-hidden="true"
      >
        <TypeIcon className="w-2.5 h-2.5 text-white" />
      </div>
    </div>
  );
}

function ActivityHeader({
  actorName,
  actionLabel,
  timestamp,
  isEmail,
  recipientInitial,
  leadName,
  onContactClick,
}: {
  actorName: string;
  actionLabel: string;
  timestamp: string;
  isEmail: boolean;
  recipientInitial: string;
  leadName: string;
  onContactClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[14px] font-semibold text-gray-900 tracking-normal">{actorName}</span>
          <span className="text-[14px] font-normal text-gray-500 tracking-normal">
            {isEmail ? (
              <>
                emailed{' '}
                <button
                  type="button"
                  onClick={onContactClick}
                  className="inline-flex items-baseline gap-1 align-baseline text-[#3b2778] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-sm"
                  role="link"
                  aria-label={`View ${leadName}`}
                >
                  <span
                    className={cn(
                      'self-center w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold',
                      getRecipientColor(recipientInitial)
                    )}
                  >
                    {recipientInitial}
                  </span>
                  {leadName}
                </button>
              </>
            ) : (
              actionLabel
            )}
          </span>
        </div>
      </div>
      <span className="text-[12px] font-normal text-gray-500 tracking-normal tabular-nums shrink-0 whitespace-nowrap pt-0.5">
        {timestamp}
      </span>
    </div>
  );
}

function ActivityContact({
  recipientInitial,
  leadName,
  leadCompany,
  onClick,
}: {
  recipientInitial: string;
  leadName: string;
  leadCompany: string | null;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0',
          getRecipientColor(recipientInitial)
        )}
        aria-hidden="true"
      >
        {recipientInitial}
      </span>
      <button
        type="button"
        onClick={onClick}
        className="text-[14px] font-medium text-[#3b2778] hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-sm"
        role="link"
        aria-label={`View ${leadName}`}
      >
        {leadName}
      </button>
      {leadCompany && (
        <span className="text-[13px] text-gray-400 truncate tracking-normal">— {leadCompany}</span>
      )}
    </div>
  );
}

function CallStatusLine({ direction, subType }: { direction?: string; subType?: string }) {
  const isOutbound = direction === 'outbound';
  const isMissed = /missed/i.test(subType || '');

  const dotClass = isMissed ? 'bg-red-500' : isOutbound ? 'bg-blue-500' : 'bg-green-500';
  const label = isMissed
    ? 'Missed call'
    : isOutbound
      ? 'Outgoing call — completed'
      : 'Incoming call — completed';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} aria-hidden="true" />
      <span className="text-[12px] text-gray-500 tracking-normal">{label}</span>
    </div>
  );
}

/* Primary CTA button — filled dark */
function PrimaryActionButton({
  onClick,
  icon: Icon,
  label,
  ariaLabel,
}: {
  onClick: (e: React.MouseEvent) => void;
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* Secondary CTA — ghost outline */
function SecondaryActionButton({
  onClick,
  icon: Icon,
  label,
  ariaLabel,
}: {
  onClick: (e: React.MouseEvent) => void;
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   ActivityCard
   ═══════════════════════════════════════════════════════════ */

const ActivityCard = ({ activity, isExpanded, onToggle, onViewLead: _onViewLead }: ActivityCardProps) => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const { makeOutboundCall } = useCall();
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const [showComments, setShowComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentText, setCommentText] = useState('');

  const { data: comments = [], isLoading: commentsLoading } = useFeedComments(activity.id, showComments);
  const { data: reactions = [] } = useFeedReactions(activity.id);
  const addComment = useAddFeedComment();
  const toggleReaction = useToggleFeedReaction();

  const handleSubmitComment = () => {
    const text = commentText.trim();
    if (!text || addComment.isPending) return;
    addComment.mutate({ activityId: activity.id, leadId: activity.leadId, content: text });
    setCommentText('');
  };

  const handleEmojiClick = (emojiKey: string) => {
    toggleReaction.mutate({ activityId: activity.id, emoji: emojiKey });
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleViewLead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.leadId) {
      navigate(`/admin/contacts/people/expanded-view/${activity.leadId}`);
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    if (activity.gmailThreadId) {
      params.set('threadId', activity.gmailThreadId);
      if (activity.gmailMessageId) params.set('messageId', activity.gmailMessageId);
      params.set('reply', 'true');
    } else if (activity.toEmail) {
      params.set('compose', 'new');
      params.set('to', activity.toEmail);
    } else if (activity.leadId) {
      params.set('compose', 'true');
      params.set('leadId', activity.leadId);
    }
    navigate(`/admin/gmail?${params.toString()}`);
  };

  const handleViewThread = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    if (activity.gmailThreadId) {
      params.set('threadId', activity.gmailThreadId);
      if (activity.gmailMessageId) params.set('messageId', activity.gmailMessageId);
    } else if (activity.leadId) {
      params.set('compose', 'true');
      params.set('leadId', activity.leadId);
    }
    navigate(`/admin/gmail?${params.toString()}`);
  };

  const handleCallBack = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.phoneNumber) {
      await makeOutboundCall(activity.phoneNumber, activity.leadId || undefined, activity.leadName);
    } else if (activity.leadId) {
      navigate(`/admin/contacts/people/expanded-view/${activity.leadId}`);
    }
  };

  const isEmail = activity.type === 'email';
  const isCall = activity.type === 'call';
  const isSms = activity.type === 'sms';
  const isNote = activity.type === 'note';
  const typeLabel = getTypeLabel(activity.type);
  const entityLabel = getEntityLabel(activity);
  const recipientInitial = activity.leadName?.charAt(0)?.toUpperCase() || '?';
  const typeIconInfo = getTypeIcon(activity.type, activity.direction, activity.subType);
  const TypeIcon = typeIconInfo.icon;
  const ccList = activity.ccRecipients ?? [];

  const relativeTime = activity.rawDate
    ? formatDistanceToNow(activity.rawDate, { addSuffix: true })
    : activity.time;

  const actionLabel = `${typeLabel}${entityLabel ? ` to ${entityLabel}` : ''}`;

  return (
    <div
      onClick={onToggle}
      className={cn(
        'bg-white rounded-2xl border p-4 mb-2 cursor-pointer transition-shadow duration-150',
        isExpanded
          ? 'border-gray-200 shadow-md ring-1 ring-purple-100'
          : 'border-gray-200 hover:shadow-sm hover:bg-gray-50/50'
      )}
    >
      <div className="flex gap-3">
        <ActivityAvatar actorInitial={activity.actorInitial} typeBg={typeIconInfo.bg} TypeIcon={TypeIcon} />

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Header + timestamp (tight gap-1 between header and sub) */}
          <div className="flex flex-col gap-1">
            <ActivityHeader
              actorName={activity.actorName}
              actionLabel={actionLabel}
              timestamp={relativeTime}
              isEmail={isEmail}
              recipientInitial={recipientInitial}
              leadName={activity.leadName}
              onContactClick={handleViewLead}
            />

            {/* Contact row — only for non-email types (email inlines contact in header) */}
            {!isEmail && activity.leadName && (
              <ActivityContact
                recipientInitial={recipientInitial}
                leadName={activity.leadName}
                leadCompany={activity.leadCompany}
                onClick={handleViewLead}
              />
            )}

            {/* CC count — subtle inline for emails */}
            {isEmail && ccList.length > 0 && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className="font-medium">CC:</span>
                <span className="truncate">{ccList.map(c => c.name).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Content preview */}
          <div>
            {isEmail ? (
              <EmailContentPreview subject={activity.subject} content={activity.content} isExpanded={isExpanded} />
            ) : (
              <div className={cn(!isExpanded && 'line-clamp-2')}>
                <ActivityContent content={activity.content} />
              </div>
            )}
          </div>

          {/* Call status line */}
          {isCall && <CallStatusLine direction={activity.direction} subType={activity.subType} />}

          {/* Action row: primary CTAs left, utility icons right */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isEmail && (
                <>
                  <PrimaryActionButton
                    onClick={handleReply}
                    icon={Reply}
                    label="Reply All"
                    ariaLabel={`Reply to ${activity.leadName}`}
                  />
                  <SecondaryActionButton
                    onClick={handleViewThread}
                    icon={ExternalLink}
                    label="View Thread"
                    ariaLabel="View email thread"
                  />
                </>
              )}
              {isCall && (
                <PrimaryActionButton
                  onClick={handleCallBack}
                  icon={Phone}
                  label="Call Back"
                  ariaLabel={`Call back ${activity.leadName}`}
                />
              )}
              {isSms && (
                <PrimaryActionButton
                  onClick={handleViewLead}
                  icon={MessageSquare}
                  label="View Conversation"
                  ariaLabel={`View SMS conversation with ${activity.leadName}`}
                />
              )}
              {isNote && activity.leadId && (
                <SecondaryActionButton
                  onClick={handleViewLead}
                  icon={User}
                  label="View Contact"
                  ariaLabel={`View contact ${activity.leadName}`}
                />
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowComments(v => !v); }}
                  aria-label="Toggle comments"
                  aria-expanded={showComments}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                    showComments
                      ? 'bg-purple-50 text-[#3b2778]'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                {comments.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-[#3b2778] text-white text-[9px] font-bold ring-2 ring-white">
                    {comments.length}
                  </span>
                )}
              </div>
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v); }}
                  aria-label="Add reaction"
                  aria-expanded={showEmojiPicker}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                    showEmojiPicker
                      ? 'bg-amber-50 text-amber-600'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  )}
                >
                  <SmilePlus className="w-4 h-4" />
                </button>
                {showEmojiPicker && (
                  <div
                    role="listbox"
                    aria-label="Choose a reaction"
                    className="absolute right-0 top-full mt-2 min-w-[200px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-3 animate-in fade-in-0 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji.key}
                          role="option"
                          aria-label={emoji.key}
                          aria-selected="false"
                          onClick={() => handleEmojiClick(emoji.key)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          {emoji.char}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reactions row */}
          {reactions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => toggleReaction.mutate({ activityId: activity.id, emoji: r.emoji })}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                    r.reactedByMe
                      ? 'bg-purple-50 border-purple-200 text-[#3b2778]'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                  title={r.users.join(', ')}
                  aria-label={`${r.count} ${r.emoji} reaction${r.count > 1 ? 's' : ''}`}
                >
                  <span className="text-sm leading-none">{emojiCharMap[r.emoji] || r.emoji}</span>
                  <span className="tabular-nums">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Comments section */}
          <AnimatePresence initial={false}>
            {showComments && (
              <motion.div
                key="comments"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <CommentSection
                  comments={comments}
                  commentsLoading={commentsLoading}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  onSubmit={handleSubmitComment}
                  isPending={addComment.isPending}
                  currentUserInitial={teamMember?.name?.charAt(0)?.toUpperCase() || '?'}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded section */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <ExpandedDetails activity={activity} onViewLead={handleViewLead} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   ExpandedDetails — rich metadata panel shown when card is expanded
   ═══════════════════════════════════════════════════════════ */

function MetaRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
        <div className="text-[13px] text-gray-800 tracking-normal break-words">{children}</div>
      </div>
    </div>
  );
}

function prettifySubType(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ExpandedDetails({
  activity,
  onViewLead,
}: {
  activity: FeedActivity;
  onViewLead: (e: React.MouseEvent) => void;
}) {
  const absoluteTime = activity.rawDate ? format(activity.rawDate, "MMM d, yyyy 'at' h:mm a") : activity.time;
  const isEmail = activity.type === 'email';
  const isCall = activity.type === 'call';
  const isSms = activity.type === 'sms';
  const ccList = activity.ccRecipients ?? [];

  const direction = activity.direction;
  const DirectionIcon = direction === 'outbound' ? ArrowUpRight : ArrowDownLeft;
  const directionLabel = direction ? (direction === 'outbound' ? 'Outgoing' : 'Incoming') : null;

  return (
    <div className="border-t border-gray-100 pt-3 mt-1 space-y-3" onClick={(e) => e.stopPropagation()}>
      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetaRow icon={Clock} label="When">
          {absoluteTime}
        </MetaRow>

        {activity.leadCompany && (
          <MetaRow icon={Building2} label="Company">
            {activity.leadCompany}
          </MetaRow>
        )}

        {directionLabel && (isCall || isEmail || isSms) && (
          <MetaRow icon={DirectionIcon} label="Direction">
            {directionLabel}
          </MetaRow>
        )}

        {activity.subType && (
          <MetaRow icon={Tag} label="Type">
            {prettifySubType(activity.subType)}
          </MetaRow>
        )}

        {activity.source && (
          <MetaRow icon={User} label="Source">
            <span className="capitalize">{activity.source}</span>
          </MetaRow>
        )}

        {(isCall || isSms) && activity.phoneNumber && (
          <MetaRow icon={Phone} label="Phone">
            <a
              href={`tel:${activity.phoneNumber}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[#3b2778] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-sm"
            >
              {activity.phoneNumber}
            </a>
          </MetaRow>
        )}

        {isEmail && activity.toEmail && (
          <MetaRow icon={AtSign} label="To">
            <span className="truncate block">{activity.toEmail}</span>
          </MetaRow>
        )}
      </div>

      {/* Stage badge */}
      {activity.stage && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Stage</span>
          <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-[#3b2778] rounded-full text-[11px] font-semibold">
            {activity.stage}
          </span>
        </div>
      )}

      {/* CC recipients (full list with avatars) */}
      {isEmail && ccList.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">CC ({ccList.length})</span>
          <div className="flex flex-col gap-1.5">
            {ccList.map((cc, i) => {
              const initial = cc.name.charAt(0).toUpperCase() || '?';
              return (
                <div key={i} className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0',
                      getRecipientColor(initial)
                    )}
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-gray-800 truncate tracking-normal">{cc.name}</div>
                    <div className="text-[11px] text-gray-500 truncate tracking-normal">{cc.email}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checklist */}
      {activity.checklistItems && activity.checklistItems.length > 0 && (
        <div className="space-y-1.5">
          {activity.checklistTitle && (
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{activity.checklistTitle}</span>
          )}
          {activity.checklistItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {item.isChecked ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              )}
              <span className={cn('text-[13px] tracking-normal', item.isChecked ? 'line-through text-gray-400' : 'text-gray-700')}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer action */}
      {activity.leadId && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onViewLead}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#3b2778] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-sm"
            aria-label={`Open full record for ${activity.leadName}`}
          >
            Open full record
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CommentSection
   ═══════════════════════════════════════════════════════════ */

function CommentSection({
  comments,
  commentsLoading,
  commentText,
  setCommentText,
  onSubmit,
  isPending,
  currentUserInitial,
}: {
  comments: { id: string; created_by: string | null; created_at: string; content: string }[];
  commentsLoading: boolean;
  commentText: string;
  setCommentText: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  currentUserInitial: string;
}) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
      {commentsLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-2.5">
          {comments.map((c) => {
            const initial = (c.created_by || '?').charAt(0).toUpperCase();
            return (
              <div key={c.id} className="flex items-start gap-2.5">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0', getRecipientColor(initial))}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-gray-900 tracking-normal">{c.created_by || 'Team'}</span>
                    <span className="text-[11px] text-gray-500 tracking-normal">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed tracking-normal">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] text-gray-500 italic tracking-normal">No comments yet</p>
      )}

      <div className="flex items-center gap-2.5">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0', getRecipientColor(currentUserInitial))}>
          {currentUserInitial}
        </div>
        <div className="flex-1 relative">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
            placeholder="Add a comment..."
            aria-label="Add a comment"
            className="w-full h-8 pl-3 pr-9 text-[13px] bg-gray-50 border border-gray-200 rounded-full text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 focus:border-transparent tracking-normal"
          />
          {commentText.trim() && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              aria-label="Submit comment"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[#3b2778] text-white hover:bg-[#2d1d5c] transition-colors duration-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityCard;
