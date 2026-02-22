import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowRight, ArrowDown, Building, Clock, MessageSquare, Star, MoreHorizontal, MailOpen, ListTodo, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GmailEmail, extractSenderName } from '@/components/gmail/gmailHelpers';
import { getNextStepSuggestion } from '@/components/gmail/EvanGmailFeatures';
import { format, formatDistanceToNow } from 'date-fns';
import { appendSignature } from '@/lib/email-signature';
import type { EvansGmailLogic } from '@/hooks/useEvansGmailLogic';

interface EvansGmailEmailListProps {
  logic: EvansGmailLogic;
}

export function EvansGmailEmailList({ logic }: EvansGmailEmailListProps) {
  const {
    emailsLoading,
    filteredEmails,
    paginatedEmails,
    searchQuery,
    readEmailIds,
    handleSelectEmail,
    handleMarkUnread,
    isExternalEmail,
    findLeadForEmail,
    generatingDraftForId,
    handleMoveForward,
    setTaskDialogOpen,
    setTaskInitialTitle,
    setTaskInitialDescription,
    setTaskInitialLeadId,
  } = logic;

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
              const isExternal = isExternalEmail(email);
              const lead = findLeadForEmail(email);
              const stageName = lead?.pipeline_leads?.[0]?.pipeline_stages?.name;
              const stageColor = lead?.pipeline_leads?.[0]?.pipeline_stages?.color;
              const isRead = email.isRead || readEmailIds[email.id];

              return (
                <div
                  key={email.id}
                  onClick={() => handleSelectEmail(email.id)}
                  className={`border-b border-border cursor-pointer transition-colors ${
                    !isRead
                      ? 'bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                      : 'bg-white dark:bg-background hover:bg-muted/50'
                  } ${isExternal ? 'py-5 px-4' : 'p-3'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="text-amber-400 hover:text-amber-500 transition-colors flex-shrink-0"
                    >
                      <Star className="w-4 h-4 fill-amber-400" />
                    </button>
                    <Avatar className={isExternal ? 'w-8 h-8' : 'w-6 h-6'}>
                      {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                      <AvatarFallback className={isExternal ? 'text-sm' : 'text-xs'}>
                        {extractSenderName(email.from).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`truncate ${!isRead ? 'font-semibold' : ''} ${isExternal ? 'text-base' : 'text-sm'}`}>
                      {extractSenderName(email.from)}
                    </span>
                    {isExternal && stageName && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{
                          backgroundColor: stageColor ? `${stageColor}20` : 'hsl(var(--muted))',
                          color: stageColor || 'hsl(var(--muted-foreground))'
                        }}
                      >
                        {stageName}
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleMarkUnread(email.id)}>
                          <MailOpen className="w-4 h-4 mr-2" />
                          Mark as unread
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const senderName = extractSenderName(email.from);
                          setTaskInitialTitle(`Follow up: ${email.subject}`);
                          setTaskInitialDescription(`From: ${senderName}\n\nEmail snippet: ${email.snippet}`);
                          setTaskInitialLeadId(lead?.id || null);
                          setTaskDialogOpen(true);
                        }}>
                          <ListTodo className="w-4 h-4 mr-2" />
                          Add to do task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.date), 'MMM d')}
                    </span>
                  </div>
                  <p className={`truncate ${!isRead ? 'font-medium' : ''} ${isExternal ? 'text-base mb-1' : 'text-sm'}`}>
                    {email.subject}
                  </p>
                  <p className={`text-muted-foreground mt-0.5 ${isExternal ? 'text-sm line-clamp-2' : 'text-xs truncate'}`}>
                    {email.snippet}
                  </p>
                  {isExternal && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        className="bg-[#0066FF]/80 hover:bg-[#0052CC]/80 text-white"
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
                          {getNextStepSuggestion(stageName, email.snippet, lead)}
                        </span>
                      </div>
                      {lead && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <MessageSquare className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {lead.last_activity_at
                                ? formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })
                                : formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })
                              }
                            </span>
                          </div>
                          {(() => {
                            const stageDate = lead.qualified_at
                              ? new Date(lead.qualified_at)
                              : lead.converted_at
                                ? new Date(lead.converted_at)
                                : new Date(lead.created_at);
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span>In stage {formatDistanceToNow(stageDate)}</span>
                              </div>
                            );
                          })()}
                          {(() => {
                            const response = lead.lead_responses?.[0];
                            const loanAmount = Number(response?.loan_amount) || Number(response?.funding_amount) || 0;
                            if (loanAmount > 0) {
                              const formatted = loanAmount >= 1000000
                                ? `$${(loanAmount / 1000000).toFixed(1)}M`
                                : `$${(loanAmount / 1000).toFixed(0)}K`;
                              return (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
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
