import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowRight, ArrowDown, Building, Clock, MessageSquare, Star, MailOpen, ListTodo, FileText, EyeOff, Eye, Users, Paperclip } from 'lucide-react';
import { useHiddenThreads } from '@/hooks/useHiddenThreads';
import { useTeamMember } from '@/hooks/useTeamMember';
import { GmailEmail, extractSenderName } from '@/components/gmail/gmailHelpers';
import { getNextStepSuggestion } from '@/components/gmail/GmailFeatures';
import { format, formatDistanceToNow } from 'date-fns';
import { appendSignature } from '@/lib/email-signature';
import type { GmailLogic } from '@/hooks/useGmailLogic';

const contactTypeConfig: Record<string, { bg: string; text: string }> = {
  Client: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Prospect: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Referral Partner': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Lender: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Other: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

interface GmailEmailListProps {
  logic: GmailLogic;
}

export function GmailEmailList({ logic }: GmailEmailListProps) {
  const {
    emailsLoading,
    filteredEmails,
    paginatedEmails,
    searchQuery,
    readEmailIds,
    handleSelectEmail,
    handleMarkUnread,
    getCRMContext,
    findLeadForEmail,
    generatingDraftForId,
    handleMoveForward,
    setTaskDialogOpen,
    setTaskInitialTitle,
    setTaskInitialDescription,
    setTaskInitialLeadId,
  } = logic;

  const { teamMember } = useTeamMember();
  const { isHiddenByMe, hideThread, unhideThread } = useHiddenThreads(teamMember?.id);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        {emailsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {searchQuery ? 'No emails match your search' : 'No emails'}
          </div>
        ) : (
          <div>
            {paginatedEmails.map((email) => {
              const crm = getCRMContext(email);
              const isElevated = crm.type === 'lead' || crm.type === 'person';
              const isRead = email.isRead || readEmailIds[email.id];

              const contactType = crm.type === 'person' ? (crm.person?.contact_type || 'Prospect') : null;
              const pillStyle = contactType ? (contactTypeConfig[contactType] || contactTypeConfig.Other) : null;

              return (
                <div
                  key={email.id}
                  onClick={() => handleSelectEmail(email.id)}
                  className={`group border-b border-border/50 cursor-pointer transition-colors duration-150 px-4 py-3.5 ${
                    !isRead
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-primary'
                      : 'bg-background hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors flex-shrink-0"
                    >
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </button>
                    <Avatar className="w-8 h-8">
                      {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                      <AvatarFallback className="text-xs">
                        {extractSenderName(email.from).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`truncate text-sm ${!isRead ? 'font-semibold' : 'font-medium'}`}>
                      {extractSenderName(email.from)}
                    </span>
                    {/* Lead stage badge */}
                    {crm.type === 'lead' && crm.stageName && (
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{
                          backgroundColor: crm.stageColor ? `${crm.stageColor}20` : 'hsl(var(--muted))',
                          color: crm.stageColor || 'hsl(var(--muted-foreground))'
                        }}
                      >
                        {crm.stageName}
                      </span>
                    )}
                    {/* Person contact type badge */}
                    {crm.type === 'person' && pillStyle && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${pillStyle.bg} ${pillStyle.text}`}>
                        {contactType}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md flex-shrink-0" title="Mark as unread" onClick={(e) => { e.stopPropagation(); handleMarkUnread(email.id); }}>
                        <MailOpen className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md flex-shrink-0" title="Add to do task" onClick={(e) => {
                        e.stopPropagation();
                        const senderName = extractSenderName(email.from);
                        setTaskInitialTitle(`Follow up: ${email.subject}`);
                        setTaskInitialDescription(`From: ${senderName}\n\nEmail snippet: ${email.snippet}`);
                        setTaskInitialLeadId(crm.lead?.id || null);
                        setTaskDialogOpen(true);
                      }}>
                        <ListTodo className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md flex-shrink-0" title={isHiddenByMe(email.threadId) ? 'Unhide thread' : 'Hide from others'} onClick={(e) => {
                        e.stopPropagation();
                        if (isHiddenByMe(email.threadId)) {
                          unhideThread(email.threadId);
                        } else {
                          hideThread(email.threadId);
                        }
                      }}>
                        {isHiddenByMe(email.threadId) ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    <span className="flex-1" />
                    {email.attachments && email.attachments.length > 0 && (
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.date), 'MMM d')}
                    </span>
                  </div>
                  <p className={`truncate text-sm ${!isRead ? 'font-medium' : ''}`}>
                    {email.subject}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {email.snippet}
                  </p>
                  {/* Lead-specific: Move Forward + metadata chips */}
                  {crm.type === 'lead' && (
                    <div className="mt-2.5">
                      <Button
                        size="sm"
                        className="bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg h-8 text-xs font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveForward(email);
                        }}
                        disabled={generatingDraftForId === email.id}
                      >
                        {generatingDraftForId === email.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        Move Forward
                      </Button>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <ArrowDown className="w-3 h-3 flex-shrink-0 rotate-[-90deg]" />
                        <span className="italic">
                          {getNextStepSuggestion(crm.stageName, email.snippet, crm.lead)}
                        </span>
                      </div>
                      {crm.lead && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <MessageSquare className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {crm.lead.last_activity_at
                                ? formatDistanceToNow(new Date(crm.lead.last_activity_at), { addSuffix: true })
                                : formatDistanceToNow(new Date(crm.lead.created_at), { addSuffix: true })
                              }
                            </span>
                          </div>
                          {(() => {
                            const stageDate = crm.lead.qualified_at
                              ? new Date(crm.lead.qualified_at)
                              : crm.lead.converted_at
                                ? new Date(crm.lead.converted_at)
                                : new Date(crm.lead.created_at);
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span>In stage {formatDistanceToNow(stageDate)}</span>
                              </div>
                            );
                          })()}
                          {(() => {
                            const response = crm.lead.lead_responses?.[0];
                            const loanAmount = Number(response?.loan_amount) || Number(response?.funding_amount) || 0;
                            if (loanAmount > 0) {
                              const formatted = loanAmount >= 1000000
                                ? `$${(loanAmount / 1000000).toFixed(1)}M`
                                : `$${(loanAmount / 1000).toFixed(0)}K`;
                              return (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                  <Building className="w-3 h-3 flex-shrink-0" />
                                  <span>{formatted}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
