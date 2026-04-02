import { useState, useRef, useEffect } from 'react';
import { Phone, Mail, MessageSquare, StickyNote, UserPlus, CheckSquare, ChevronDown, ChevronUp, Check, Square, Reply, Lock, Forward, Bookmark, ArrowUpRight, ArrowDownLeft, ClipboardList, RefreshCw, SmilePlus, UserRoundPlus, PlusCircle, Loader2, Send, CalendarDays, Video, FileText, FileSignature, HelpCircle, BarChart3, Pause, Mailbox, ListChecks, ExternalLink, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useCall } from '@/contexts/CallContext';
import { HtmlContent } from '@/components/ui/html-content';
import { useFeedComments, useAddFeedComment, useFeedReactions, useToggleFeedReaction } from '@/hooks/useFeedInteractions';
import { formatDistanceToNow } from 'date-fns';
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

/* ── Type-based badge icon + color (small overlay on avatar) ── */
const getTypeIcon = (type: FeedActivity['type'], direction?: string, subType?: string) => {
  // Check subType first for specific icon
  if (subType) {
    const match = SUB_TYPE_ICONS[subType.toLowerCase()];
    if (match) return match;
  }

  // Fallback to broad type
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

/* ── Action label for non-email types ── */
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

/** Parse checklist-style content */
function ActivityContent({ content }: { content: string }) {
  if (!content) return null;

  const hasChecklist = /\[[ xX]\]/.test(content);
  if (!hasChecklist) {
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return <HtmlContent value={content} className="text-[14px] text-gray-700 leading-relaxed" />;
    }
    return <span className="text-[14px] text-gray-700 leading-relaxed">{content}</span>;
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

/* ── Copper-style email content: Subject (bold) + body preview ── */
function EmailContentPreview({ subject, content, isExpanded }: { subject?: string | null; content: string; isExpanded: boolean }) {
  return (
    <div>
      {subject && (
        <p className="text-[14px] font-bold text-gray-900 mb-1">{subject}</p>
      )}
      {content && (
        <p className={cn('text-[14px] text-gray-500 leading-relaxed', !isExpanded && 'line-clamp-2')}>
          {content}
        </p>
      )}
    </div>
  );
}

/* ── Emoji presets for reaction picker ── */
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
   ActivityCard — Copper CRM Style
   ═══════════════════════════════════════════════════════════ */

const ActivityCard = ({ activity, isExpanded, onToggle, onViewLead }: ActivityCardProps) => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const { makeOutboundCall } = useCall();
  const [ccOpen, setCcOpen] = useState(false);
  const ccRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Comment & reaction state
  const [showComments, setShowComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Hooks for persistence
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

  // Close CC popover on outside click
  useEffect(() => {
    if (!ccOpen) return;
    const handler = (e: MouseEvent) => {
      if (ccRef.current && !ccRef.current.contains(e.target as Node)) setCcOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ccOpen]);

  // Close emoji picker on outside click
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

  /** Reply All — opens Gmail on the exact thread with inline reply ready */
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

  /** View thread — opens Gmail on the exact thread without reply */
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

  /** Call back — initiates Twilio call or navigates to contact */
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
  const typeLabel = getTypeLabel(activity.type);
  const entityLabel = getEntityLabel(activity);
  const recipientInitial = activity.leadName?.charAt(0)?.toUpperCase() || '?';
  const typeIconInfo = getTypeIcon(activity.type, activity.direction, activity.subType);
  const TypeIcon = typeIconInfo.icon;
  const ccList = activity.ccRecipients ?? [];

  return (
    <div
      onClick={onToggle}
      className={cn(
        'bg-white rounded-2xl border border-gray-100 px-5 py-3.5 mb-2 cursor-pointer transition-all relative',
        isExpanded ? 'shadow-md ring-1 ring-gray-100' : 'hover:shadow-sm'
      )}
    >
      {/* ── Top-right: Comment & Emoji buttons ── */}
      <div className="absolute top-3 right-4 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowComments(v => !v); }}
            className={cn(
              'inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors overflow-visible',
              showComments
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
            style={{ borderRadius: '9999px' }}
            title="Comments"
          >
            <MessageSquare size={19} style={{ minWidth: 19, minHeight: 19, flexShrink: 0 }} />
          </button>
          {comments.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-bold">
              {comments.length}
            </span>
          )}
        </div>
        <div className="relative" ref={emojiPickerRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v); }}
            className={cn(
              'inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors overflow-visible',
              showEmojiPicker
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
            style={{ borderRadius: '9999px' }}
            title="React"
          >
            <SmilePlus size={19} style={{ minWidth: 19, minHeight: 19, flexShrink: 0 }} />
          </button>
          {showEmojiPicker && (
            <div
              className="absolute right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-3"
              style={{ minWidth: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-4 gap-2">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji.key}
                    onClick={() => handleEmojiClick(emoji.key)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl"
                    title={emoji.key}
                  >
                    {emoji.char}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {/* ── Left: Avatar + type badge ── */}
        <div className="flex-shrink-0" style={{ position: 'relative', width: 40, height: 40, marginTop: 1 }}>
          <div
            className="bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-semibold"
            style={{ borderRadius: '9999px', width: 40, height: 40 }}
          >
            {activity.actorInitial}
          </div>
          {/* Activity type badge — overlapping bottom-right of avatar */}
          <div
            className={cn(
              'flex items-center justify-center ring-2 ring-white',
              typeIconInfo.bg
            )}
            style={{ position: 'absolute', borderRadius: '9999px', width: 22, height: 22, bottom: -3, right: -3 }}
          >
            <TypeIcon className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 min-w-0">

          {/* ── Row 1: Header line ── */}
          <div className="flex items-center gap-2">
            {isEmail ? (
              <>
                {/* "You to [G] Name" pill */}
                <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3.5 py-1.5">
                  <span className="text-[14px] font-semibold text-gray-700">You</span>
                  <span className="text-[14px] text-gray-400">to</span>
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0',
                      getRecipientColor(recipientInitial)
                    )}
                    style={{ borderRadius: '9999px' }}
                  >
                    {recipientInitial}
                  </span>
                  <span onClick={handleViewLead} className="text-[14px] font-semibold text-gray-700 truncate hover:text-blue-600 hover:underline cursor-pointer">{activity.leadName}</span>
                </div>
                {/* CC count pill — always visible for emails */}
                <div className="relative group/cc" ref={ccRef}>
                  <div
                    className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 cursor-default"
                    style={{ borderRadius: '9999px' }}
                  >
                    <span className="text-gray-500 text-[13px]">{ccList.length}</span>
                    <span className={cn('w-2 h-2 rounded-full inline-block', ccList.length > 0 ? 'bg-purple-400' : 'bg-gray-300')} />
                  </div>
                  {/* Hover tooltip */}
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-50 min-w-[250px] py-3 px-4 opacity-0 invisible group-hover/cc:opacity-100 group-hover/cc:visible transition-all duration-150">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      CC ({ccList.length})
                    </span>
                    {ccList.length === 0 ? (
                      <p className="text-[13px] text-gray-400 mt-2">No one CC'd</p>
                    ) : (
                      <div className="mt-2 space-y-2.5">
                        {ccList.map((cc, i) => {
                          const initial = cc.name.charAt(0).toUpperCase();
                          return (
                            <div key={i} className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0',
                                  getRecipientColor(initial)
                                )}
                                style={{ borderRadius: '9999px' }}
                              >
                                {initial}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[13px] font-medium text-gray-700 block truncate">{cc.name}</span>
                                <span className="text-[11px] text-gray-400 block truncate">{cc.email}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Non-email: actor + action in a pill */}
                <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3.5 py-1.5">
                  <span className="text-[14px] font-semibold text-gray-700">{activity.actorName}</span>
                  <span className="text-[14px] text-gray-400">
                    {typeLabel}{entityLabel ? ` to ${entityLabel}` : ''}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── Row 2: Timestamp line ── */}
          <div className="flex items-center gap-1.5 mt-1">
            <Lock className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-[13px] text-gray-400">|</span>
            <span className="text-[13px] text-gray-400 tabular-nums">
              {activity.time}
            </span>
          </div>

          {/* ── Row 2b: Lead/contact link (non-email types) ── */}
          {!isEmail && (
            <div className="mt-1 flex items-center gap-[5px]">
              <span
                className={cn(
                  'w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0',
                  getRecipientColor(recipientInitial)
                )}
              >
                {recipientInitial}
              </span>
              <button
                onClick={handleViewLead}
                className="text-[13px] font-medium text-blue-600 hover:underline leading-none"
              >
                {activity.leadName}
              </button>
              {activity.leadCompany && (
                <span className="text-[12px] text-gray-400 leading-none">— {activity.leadCompany}</span>
              )}
            </div>
          )}

          {/* ── Row 3: Content preview ── */}
          <div className="mt-1.5">
            {isEmail ? (
              <EmailContentPreview subject={activity.subject} content={activity.content} isExpanded={isExpanded} />
            ) : (
              <div className={cn(!isExpanded && 'line-clamp-2')}>
                <ActivityContent content={activity.content} />
              </div>
            )}
          </div>

          {/* ── Row 4: Action buttons — every card type gets a CTA ── */}
          <div className="flex items-center gap-2 mt-2">
            {isEmail && (
              <>
                <button
                  onClick={handleReply}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  style={{ borderRadius: '9999px' }}
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply All
                </button>
                <button
                  onClick={handleViewThread}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  style={{ borderRadius: '9999px' }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Thread
                </button>
              </>
            )}
            {isCall && (
              <button
                onClick={handleCallBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-700 transition-colors"
                style={{ borderRadius: '9999px' }}
              >
                <Phone className="w-3.5 h-3.5" />
                Call Back
              </button>
            )}
            {activity.type === 'sms' && (
              <button
                onClick={handleViewLead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-700 transition-colors"
                style={{ borderRadius: '9999px' }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                View Conversation
              </button>
            )}
            {activity.type === 'note' && activity.leadId && (
              <button
                onClick={handleViewLead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-700 transition-colors"
                style={{ borderRadius: '9999px' }}
              >
                <User className="w-3.5 h-3.5" />
                View Contact
              </button>
            )}
          </div>

          {/* ── Reaction badges ── */}
          {reactions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction.mutate({ activityId: activity.id, emoji: r.emoji })}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors',
                    r.reactedByMe
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  )}
                  title={r.users.join(', ')}
                >
                  <span className="text-sm">{emojiCharMap[r.emoji] || r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Comment section ── */}
          {showComments && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
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
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ borderRadius: '9999px' }}>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-gray-700">{c.created_by || 'Team'}</span>
                            <span className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-[13px] text-gray-600 mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-gray-400 italic">No comments yet</p>
              )}

              {/* Comment input */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ borderRadius: '9999px' }}>
                  {teamMember?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                    placeholder="Add a comment..."
                    className="w-full h-8 pl-3 pr-9 text-[13px] bg-gray-50 border border-gray-200 rounded-full text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
                  />
                  {commentText.trim() && (
                    <button
                      onClick={handleSubmitComment}
                      disabled={addComment.isPending}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Expanded section ── */}
          {isExpanded && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {/* Metadata badges */}
              {activity.stage && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-[11px] font-medium">
                    {activity.stage}
                  </span>
                </div>
              )}

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

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
