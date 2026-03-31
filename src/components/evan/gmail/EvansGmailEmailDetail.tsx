import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, ChevronDown, Reply, ReplyAll, Forward, ListTodo, User, Users, Paperclip, FileText, FileImage, File, Download, Loader2 } from 'lucide-react';
import InlineReplyBox from '@/components/admin/inbox/InlineReplyBox';
import { GmailEmail, ThreadMessage, extractSenderName, extractEmailAddress, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import { mockThreadMessages } from '@/components/gmail/EvanGmailFeatures';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { appendSignature } from '@/lib/email-signature';
import { EvansGmailDealSidebar } from './EvansGmailDealSidebar';
import { EvansGmailContactSidebar } from './EvansGmailContactSidebar';
import type { EvansGmailLogic } from '@/hooks/useEvansGmailLogic';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
}

function AttachmentList({ attachments }: { attachments: GmailEmail['attachments'] }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(async (attachment: NonNullable<GmailEmail['attachments']>[number]) => {
    if (!attachment.id) {
      toast.error('Attachment not downloadable');
      return;
    }
    setDownloadingId(attachment.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        action: 'get-attachment',
        messageId: attachment.messageId,
        attachmentId: attachment.id,
      });
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to download attachment');
      const result = await response.json();

      // Gmail returns base64url encoded data — convert to standard base64
      const base64 = result.data.replace(/-/g, '+').replace(/_/g, '/');
      const byteChars = atob(base64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: attachment.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Attachment download failed:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-4 pl-[52px]">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Paperclip className="w-3.5 h-3.5" />
        <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.type);
          const isDownloading = downloadingId === att.id;
          return (
            <button
              key={`${att.messageId}-${att.id}-${att.name}`}
              onClick={() => handleDownload(att)}
              disabled={isDownloading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors text-left max-w-[240px] group"
            >
              <Icon className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{att.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
              </div>
              {isDownloading ? (
                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Download className="w-4 h-4 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EvansGmailEmailDetailProps {
  logic: EvansGmailLogic;
}

export function EvansGmailEmailDetail({ logic }: EvansGmailEmailDetailProps) {
  const {
    selectedEmail,
    selectedLead,
    activeFolder,
    showDealSidebar, setShowDealSidebar,
    showEmailAddress, setShowEmailAddress,
    showInlineReply, setShowInlineReply,
    inlineReplySending,
    handleInlineReplySend,
    localReplies,
    setSelectedEmailId,
    handleReply,
    setReplyThreadId, setReplyInReplyTo,
    setComposeTo, setComposeSubject, setComposeBody, setComposeOpen,
    isExternalEmail,
    taskDialogOpen, setTaskDialogOpen,
    setTaskInitialTitle, setTaskInitialDescription, setTaskInitialLeadId,
    generatingDraftForId,
    emailTemplates,
    getCRMContext,
  } = logic;

  if (!selectedEmail) return null;

  const crm = getCRMContext(selectedEmail);

  const handleReplyAll = () => {
    const senderEmail = extractEmailAddress(selectedEmail.from);
    const ccEmails = selectedEmail.cc;
    const allRecipients = ccEmails ? `${senderEmail}, ${ccEmails}` : senderEmail;
    const replySubject = selectedEmail.subject.toLowerCase().startsWith('re:')
      ? selectedEmail.subject
      : `Re: ${selectedEmail.subject}`;
    setReplyThreadId(selectedEmail.threadId);
    setReplyInReplyTo(selectedEmail.id);
    setComposeTo(allRecipients);
    setComposeSubject(replySubject);
    setComposeBody(appendSignature(''));
    setComposeOpen(true);
  };

  const handleForward = () => {
    const fwdSubject = selectedEmail.subject.toLowerCase().startsWith('fwd:')
      ? selectedEmail.subject
      : `Fwd: ${selectedEmail.subject}`;
    const messageDate = format(new Date(selectedEmail.date), 'EEE, MMM d, yyyy \'at\' h:mm a');
    const bodyToForward = selectedEmail.body || selectedEmail.snippet || '';
    const forwardContent = `
<br><br>
---------- Forwarded message ---------<br>
From: ${selectedEmail.from}<br>
Date: ${messageDate}<br>
Subject: ${selectedEmail.subject}<br>
To: ${selectedEmail.to || 'evan@commerciallendingx.com'}<br>
<br>
${bodyToForward.replace(/\n/g, '<br>')}`;
    setReplyThreadId(null);
    setReplyInReplyTo(null);
    setComposeTo('');
    setComposeSubject(fwdSubject);
    setComposeBody(appendSignature('') + forwardContent);
    setComposeOpen(true);
  };

  const handleAddTask = () => {
    if (!selectedLead) return;
    const senderName = extractSenderName(selectedEmail.from);
    setTaskInitialTitle(`Follow up: ${selectedEmail.subject}`);
    setTaskInitialDescription(`From: ${senderName}\n\nEmail snippet: ${selectedEmail.snippet}`);
    setTaskInitialLeadId(selectedLead.id);
    setTaskDialogOpen(true);
  };

  const threadKey = selectedEmail.threadId || selectedEmail.id;
  const baseMessages = mockThreadMessages[selectedEmail.threadId] || [];
  const sentReplies = localReplies[threadKey] || [];
  const allMessages = [...baseMessages, ...sentReplies];

  const showContactButton = crm.type === 'lead' || crm.type === 'person';

  const renderThreadMessage = (msg: ThreadMessage, index: number) => {
    const isFromEvan = msg.from.toLowerCase().includes('evan');
    return (
      <div key={msg.id} className={cn("py-6", index === 0 && "pt-0")}>
        <div className={cn("p-4 rounded-lg", isFromEvan && "border-l-2 border-emerald-400")}>
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-10 h-10 flex-shrink-0">
              {msg.senderPhoto ? <AvatarImage src={msg.senderPhoto} /> : null}
              <AvatarFallback className={cn(
                "font-semibold",
                isFromEvan ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"
              )}>
                {extractSenderName(msg.from).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{extractSenderName(msg.from)}</p>
                <p className="text-xs text-muted-foreground flex-shrink-0">
                  {format(new Date(msg.date), 'MMM d, yyyy, h:mm a')}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">To: {msg.to}</p>
            </div>
          </div>
          <div
            className="text-sm whitespace-pre-wrap leading-relaxed pl-[52px]"
            dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body) }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Email Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5 h-8 text-xs font-medium" onClick={() => { setSelectedEmailId(null); setShowDealSidebar(false); }}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </div>

          {/* Email Action Buttons */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setShowInlineReply(true)} className="gap-1.5 h-8 rounded-lg text-xs font-medium">
              <Reply className="w-3.5 h-3.5" />
              Reply
            </Button>

            {selectedEmail.cc && (
              <Button variant="outline" size="sm" onClick={handleReplyAll} className="gap-1.5 h-8 rounded-lg text-xs font-medium">
                <ReplyAll className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleForward} className="gap-1.5 h-8 rounded-lg text-xs font-medium">
              <Forward className="w-3.5 h-3.5" />
            </Button>

            {selectedLead && isExternalEmail(selectedEmail) && (
              <Button variant="outline" size="sm" onClick={handleAddTask} className="gap-1.5 h-8 rounded-lg text-xs font-medium">
                <ListTodo className="w-3.5 h-3.5" />
                Add Task
              </Button>
            )}

            {showContactButton && (
              <Button
                variant={showDealSidebar ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowDealSidebar(!showDealSidebar)}
                className="gap-1.5 ml-2 h-8 rounded-lg text-xs font-medium"
              >
                {crm.type === 'lead' ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {showDealSidebar
                  ? (crm.type === 'lead' ? 'Hide Lead Info' : 'Hide Contact Info')
                  : (crm.type === 'lead' ? 'Show Lead Info' : 'Show Contact Info')
                }
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6">
            <h1 className="text-xl font-semibold mb-4 leading-tight">{selectedEmail.subject}</h1>

            {/* CRM Label Badge */}
            {crm.type === 'lead' && crm.stageName && (
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: crm.stageColor }}
                />
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: `${crm.stageColor}20`,
                    color: crm.stageColor,
                  }}
                >
                  {crm.stageName}
                </span>
                {crm.pipelineName && (
                  <span className="text-xs text-muted-foreground">in {crm.pipelineName}</span>
                )}
              </div>
            )}
            {crm.type === 'person' && (
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                  {crm.person?.contact_type || 'Prospect'}
                </span>
              </div>
            )}

            {/* Thread Messages */}
            {allMessages.length > 0 ? (
              <div className="divide-y divide-border">
                {allMessages.map((msg, index) => renderThreadMessage(msg, index))}
              </div>
            ) : (
              /* Fallback for emails without thread messages */
              <>
                <div className="divide-y divide-border">
                  {/* Original email */}
                  <div className="pb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        {selectedEmail.senderPhoto ? <AvatarImage src={selectedEmail.senderPhoto} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {extractSenderName(selectedEmail.from).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{extractSenderName(selectedEmail.from)}</p>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-transform ${showEmailAddress ? 'rotate-180' : ''}`}
                              onClick={() => setShowEmailAddress(!showEmailAddress)}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                          </p>
                        </div>
                        {showEmailAddress && (
                          <p className="text-xs text-muted-foreground">{selectedEmail.from}</p>
                        )}
                        {activeFolder === 'sent' && (
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            {selectedEmail.to && <p><span className="font-medium">To:</span> {selectedEmail.to}</p>}
                            {selectedEmail.cc && <p><span className="font-medium">Cc:</span> {selectedEmail.cc}</p>}
                            {selectedEmail.bcc && <p><span className="font-medium">Bcc:</span> {selectedEmail.bcc}</p>}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          To: {selectedEmail.to || 'evan@commerciallendingx.com'}
                        </p>
                      </div>
                    </div>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed pl-[52px]"
                      dangerouslySetInnerHTML={{
                        __html: toRenderableHtml(
                          (selectedEmail.body && selectedEmail.body.trim()) ? selectedEmail.body : selectedEmail.snippet
                        ),
                      }}
                    />
                    <AttachmentList attachments={selectedEmail.attachments} />
                  </div>

                  {/* Local replies for this thread */}
                  {(localReplies[selectedEmail.threadId || selectedEmail.id] || []).map((msg) => (
                    <div key={msg.id} className="py-6">
                      <div className="p-4 rounded-lg">
                        <div className="flex items-start gap-3 mb-4">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">E</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{extractSenderName(msg.from)}</p>
                              <p className="text-xs text-muted-foreground flex-shrink-0">
                                {format(new Date(msg.date), 'MMM d, yyyy, h:mm a')}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">To: {msg.to}</p>
                          </div>
                        </div>
                        <div
                          className="text-sm whitespace-pre-wrap leading-relaxed pl-[52px]"
                          dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Inline Reply Box */}
            {showInlineReply ? (
              <InlineReplyBox
                recipientEmail={extractEmailAddress(selectedEmail.from)}
                recipientName={extractSenderName(selectedEmail.from)}
                recipientPhoto={selectedEmail.senderPhoto}
                onSend={async (body, attachments) => {
                  await handleInlineReplySend(selectedEmail, body, attachments);
                }}
                onDiscard={() => setShowInlineReply(false)}
                sending={inlineReplySending}
                placeholder="Write your reply..."
                templates={emailTemplates}
              />
            ) : (
              <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1 justify-center gap-2 h-11 rounded-full"
                  onClick={() => setShowInlineReply(true)}
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </Button>
                {(selectedEmail.cc || (selectedEmail.to && selectedEmail.to.includes(','))) && (
                  <Button
                    variant="outline"
                    className="flex-1 justify-center gap-2 h-11 rounded-full"
                    onClick={() => {
                      const toAddresses = selectedEmail.to?.split(',').map(e => e.trim()) || [];
                      const ccAddresses = selectedEmail.cc?.split(',').map(e => e.trim()) || [];
                      const fromAddress = extractEmailAddress(selectedEmail.from);
                      const allRecipients = [fromAddress, ...toAddresses, ...ccAddresses]
                        .filter(e => e && !e.toLowerCase().includes('evan'))
                        .join(', ');
                      const replySubject = selectedEmail.subject.toLowerCase().startsWith('re:')
                        ? selectedEmail.subject
                        : `Re: ${selectedEmail.subject}`;
                      setReplyThreadId(selectedEmail.threadId);
                      setReplyInReplyTo(selectedEmail.id);
                      setComposeTo(allRecipients);
                      setComposeSubject(replySubject);
                      setComposeBody(appendSignature(''));
                      setComposeOpen(true);
                    }}
                  >
                    <ReplyAll className="w-4 h-4" />
                    Reply all
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 justify-center gap-2 h-11 rounded-full"
                  onClick={() => {
                    const fwdSubject = selectedEmail.subject.toLowerCase().startsWith('fwd:')
                      ? selectedEmail.subject
                      : `Fwd: ${selectedEmail.subject}`;
                    const messageDate = format(new Date(selectedEmail.date), 'EEE, MMM d, yyyy \'at\' h:mm a');
                    const bodyToForward = selectedEmail.body || selectedEmail.snippet || '';
                    const forwardContent = `
<br><br>
---------- Forwarded message ---------<br>
From: ${selectedEmail.from}<br>
Date: ${messageDate}<br>
Subject: ${selectedEmail.subject}<br>
To: ${selectedEmail.to || 'evan@commerciallendingx.com'}<br>
<br>
${bodyToForward.replace(/\n/g, '<br>')}`;
                    setReplyThreadId(null);
                    setReplyInReplyTo(null);
                    setComposeTo('');
                    setComposeSubject(fwdSubject);
                    setComposeBody(appendSignature('') + forwardContent);
                    setComposeOpen(true);
                  }}
                >
                  <Forward className="w-4 h-4" />
                  Forward
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Deal Summary Sidebar (leads) */}
      {showDealSidebar && crm.type === 'lead' && selectedLead && (
        <EvansGmailDealSidebar
          selectedLead={selectedLead}
          selectedEmail={selectedEmail}
          logic={logic}
        />
      )}

      {/* Contact Sidebar (people) */}
      {showDealSidebar && crm.type === 'person' && crm.person && (
        <EvansGmailContactSidebar
          person={crm.person}
          onClose={() => setShowDealSidebar(false)}
        />
      )}
    </div>
  );
}
