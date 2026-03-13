import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDraft } from '@/contexts/DraftContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Attachment } from '@/components/admin/GmailComposeDialog';
import { FolderType } from '@/components/admin/inbox/GmailSidebar';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { GmailEmail, ThreadMessage, extractSenderName, extractEmailAddress } from '@/components/gmail/gmailHelpers';
import {
  mockExternalEmails,
  mockThreadMessages,
  evanEmailTemplates as emailTemplates,
  findLeadForEmail as findLeadForEmailFn,
  getNextStepSuggestion,
} from '@/components/gmail/EvanGmailFeatures';
import { EVAN_SIGNATURE_HTML, appendSignature } from '@/lib/email-signature';
import { useGmailPeopleSync } from '@/hooks/useGmailPeopleSync';

const EMAILS_PER_PAGE = 50;

export interface CRMGmailConfig {
  userKey: string;
  callbackPrefix: 'admin' | 'superadmin';
  returnPath?: string;
}

export function useEvansGmailLogic(config?: CRMGmailConfig) {
  const userKey = config?.userKey ?? 'evan';
  const callbackPrefix = config?.callbackPrefix ?? 'admin';
  const returnPath = config?.returnPath ?? '/admin/gmail';

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Shared Gmail connection & email data
  const gmail = useGmailConnection({
    userKey,
    callbackPrefix,
    maxResults: 100,
    fetchPhotos: false,
    returnPath,
  });
  const { data: inboxData, isLoading: emailsLoading } = gmail.useEmails('in:inbox');
  const { data: sentData, isLoading: sentEmailsLoading } = gmail.useEmails('in:sent');
  const { data: draftsData, isLoading: draftsLoading, refetch: refetchDrafts } = gmail.useEmails('in:drafts');
  const emails = (inboxData?.emails || []) as GmailEmail[];
  const sentEmails = (sentData?.emails || []) as GmailEmail[];
  const draftEmails = (draftsData?.emails || []) as GmailEmail[];
  const gmailConnection = gmail.gmailConnection;
  const connectionLoading = gmail.connectionLoading;

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [readEmailIds, setReadEmailIds] = useState<Record<string, boolean>>({});

  // Compose dialog state - use context for persistence across navigation
  const {
    composeOpen,
    setComposeOpen,
    composeTo,
    setComposeTo,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeLeadId: currentLeadIdForEmail,
    setComposeLeadId: setCurrentLeadIdForEmail,
    replyThreadId,
    setReplyThreadId,
    replyInReplyTo,
    setReplyInReplyTo,
    originatingTaskId,
    setOriginatingTaskId,
    clearCompose,
  } = useDraft();

  const [composeSending, setComposeSending] = useState(false);
  const [generatingDraftForId, setGeneratingDraftForId] = useState<string | null>(null);
  const handledComposeKeyRef = useRef<string | null>(null);
  const openedDraftIdRef = useRef<string | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [selectedLeadIdForDetail, setSelectedLeadIdForDetail] = useState<string | null>(null);
  const [showDealSidebar, setShowDealSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Task creation dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskInitialTitle, setTaskInitialTitle] = useState('');
  const [taskInitialDescription, setTaskInitialDescription] = useState('');
  const [taskInitialLeadId, setTaskInitialLeadId] = useState<string | null>(null);

  // Move Forward flow tracking
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentBodyPlain, setCurrentBodyPlain] = useState<string>('');
  const [currentBodyHtml, setCurrentBodyHtml] = useState<string>('');

  // Inline reply state
  const [showInlineReply, setShowInlineReply] = useState(false);
  const [inlineReplySending, setInlineReplySending] = useState(false);

  // Local sent replies to show in thread (keyed by threadId or emailId)
  const [localReplies, setLocalReplies] = useState<Record<string, ThreadMessage[]>>({});

  // State for tracking email generation loading
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // Debug: log route transitions
  useEffect(() => {
    console.debug('[EvansGmail] route', `${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  const clearComposeParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    ['compose', 'to', 'draftId', 'leadId', 'template', 'taskId'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Mark email as read when selected
  const handleSelectEmail = useCallback((emailId: string) => {
    setSelectedEmailId(emailId);
    setReadEmailIds(prev => ({ ...prev, [emailId]: true }));
    setShowInlineReply(false);
  }, []);

  // Mark email as unread
  const handleMarkUnread = useCallback((emailId: string) => {
    setReadEmailIds(prev => {
      const newState = { ...prev };
      delete newState[emailId];
      return newState;
    });
  }, []);

  // Fetch all leads for matching
  const { data: allLeads = [] } = useQuery({
    queryKey: ['gmail-all-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select(`
          *,
          lead_emails(email, email_type),
          lead_phones(id, phone_number, phone_type),
          lead_contacts(id, name, title, email, phone, is_primary),
          lead_responses(*),
          pipeline_leads(
            stage_id,
            pipeline_id,
            pipeline_stages(name, color),
            pipelines(name)
          )
        `);
      return data || [];
    },
  });

  // Handle URL params to open compose dialog from dashboard nudges or tasks
  useEffect(() => {
    const compose = searchParams.get('compose');
    const to = searchParams.get('to');
    const draftId = searchParams.get('draftId');
    const leadId = searchParams.get('leadId');
    const template = searchParams.get('template');
    const taskId = searchParams.get('taskId');

    if (!compose) {
      handledComposeKeyRef.current = null;
      return;
    }

    if (compose === 'true' && leadId && allLeads.length === 0) {
      return;
    }

    const intentKey = searchParams.toString();
    if (handledComposeKeyRef.current === intentKey) return;
    handledComposeKeyRef.current = intentKey;

    if (taskId) {
      setOriginatingTaskId(taskId);
      console.debug('[EvansGmail] Task linked to compose', { taskId });
    }

    console.debug('[EvansGmail] compose intent', {
      from: `${location.pathname}${location.search}`,
      compose, to, draftId, leadId, template, taskId,
    });

    if (compose === 'draft' && draftId) {
      setActiveFolder('drafts');
      refetchDrafts();
      toast.success('Draft ready');
    } else if (compose === 'new' && to) {
      setComposeTo(decodeURIComponent(to));
      setComposeSubject('');
      setComposeBody(EVAN_SIGNATURE_HTML);
      setComposeOpen(true);
    } else if (compose === 'true') {
      const generateAndOpenCompose = async () => {
        if (leadId && allLeads.length > 0) {
          const lead = allLeads.find((l: any) => l.id === leadId);
          if (lead) {
            const recipientEmail = lead.email || '';
            if (!recipientEmail) {
              toast.error('Contact has no email address');
              clearComposeParams();
              return;
            }

            setIsGeneratingEmail(true);
            setComposeTo(recipientEmail);
            setCurrentLeadIdForEmail(lead.id);

            try {
              const response = await supabase.functions.invoke('generate-lead-email', {
                body: { leadId: lead.id, emailType: template || 'follow_up' },
              });
              if (response.error) throw response.error;
              const { subject, body } = response.data;
              setComposeSubject(subject || `Following up - ${lead.company_name || lead.name}`);
              setComposeBody(appendSignature(body || ''));
              setComposeOpen(true);
              toast.success('Email draft generated');
            } catch (error: any) {
              console.error('Failed to generate email:', error);
              toast.error('Failed to generate email: ' + error.message);
              const fallbackSubject = template === 'closing'
                ? `Closing Documents - ${lead.company_name || lead.name}`
                : `Following Up - ${lead.company_name || lead.name}`;
              const fallbackBody = template === 'closing'
                ? `Hi ${lead.name?.split(' ')[0] || 'there'},\n\nCongratulations! We're approaching the closing stage for your financing. Please find attached the closing documents that require your signature.\n\nBest regards,\nEvan\nCommercial Lending X`
                : `Hi ${lead.name?.split(' ')[0] || 'there'},\n\nI wanted to check in and see how things are progressing on your end.\n\nBest regards,\nEvan\nCommercial Lending X`;
              setComposeSubject(fallbackSubject);
              setComposeBody(appendSignature(fallbackBody));
              setComposeOpen(true);
            } finally {
              setIsGeneratingEmail(false);
            }
          } else {
            toast.error('Contact not found');
            clearComposeParams();
          }
        } else if (template) {
          let subject = '';
          let body = '';
          if (template === 'closing') {
            subject = 'Closing Documents';
            body = `Hi,\n\nCongratulations! We're approaching the closing stage for your financing. Please find attached the closing documents that require your signature.\n\nPlease review the documents carefully and sign where indicated. If you have any questions, please reach out.\n\nBest regards,\nEvan\nCommercial Lending X`;
          } else if (template === 'follow_up') {
            subject = 'Following Up';
            body = `Hi,\n\nI wanted to check in and see how things are progressing. Please let me know if there's anything I can help with.\n\nBest regards,\nEvan\nCommercial Lending X`;
          }
          setComposeTo('');
          setComposeSubject(subject);
          setComposeBody(appendSignature(body));
          setComposeOpen(true);
        } else {
          setComposeTo('');
          setComposeSubject('');
          setComposeBody(EVAN_SIGNATURE_HTML);
          setComposeOpen(true);
        }
      };
      generateAndOpenCompose();
    }
  }, [searchParams, allLeads, location.pathname, location.search]);

  const { data: crmEmails = [] } = useQuery({
    queryKey: ['crm-lead-emails'],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('email')
        .not('email', 'is', null);
      const { data: leadEmails } = await supabase
        .from('lead_emails')
        .select('email');
      const { data: leadContacts } = await supabase
        .from('lead_contacts')
        .select('email')
        .not('email', 'is', null);
      const allEmailsSet = new Set<string>();
      leads?.forEach(l => l.email && allEmailsSet.add(l.email.toLowerCase()));
      leadEmails?.forEach(e => e.email && allEmailsSet.add(e.email.toLowerCase()));
      leadContacts?.forEach(c => c.email && allEmailsSet.add(c.email.toLowerCase()));
      return Array.from(allEmailsSet);
    },
  });

  // If the URL explicitly targets a draft, open it in the compose popup
  useEffect(() => {
    const compose = searchParams.get('compose');
    const draftId = searchParams.get('draftId');
    if (compose !== 'draft' || !draftId) return;
    if (openedDraftIdRef.current === draftId && composeOpen) return;
    const draft = draftEmails.find((d) => d.id === draftId);
    if (!draft) return;
    openedDraftIdRef.current = draftId;
    console.debug('[EvansGmail] opening draft in compose modal', { draftId, to: draft.to, subject: draft.subject });
    setActiveFolder('drafts');
    setComposeTo(draft.to || '');
    setComposeSubject(draft.subject || '');
    setComposeBody(draft.body || EVAN_SIGNATURE_HTML);
    setComposeOpen(true);
  }, [draftEmails, composeOpen, searchParams]);

  // Combine real emails with mock external emails and sort by date (newest first)
  const allEmails = useMemo(() => {
    const combined = [...mockExternalEmails, ...emails];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [emails]);

  // Filter emails based on CRM classification, folder, and search query
  const filteredEmails = useMemo(() => {
    let result = allEmails;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (activeFolder === 'sent') {
      result = sentEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (activeFolder === 'drafts') {
      result = draftEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (activeFolder === 'starred') {
      result = [];
    } else if (activeFolder === 'spam' || activeFolder === 'trash') {
      result = [];
    } else if (activeFolder !== 'inbox' && activeFolder !== 'templates') {
      result = result.filter(email => {
        const senderEmail = extractEmailAddress(email.from);
        const toEmail = extractEmailAddress(email.to || '');
        const isExternal = crmEmails.some(crmEmail => {
          const crmLower = crmEmail.toLowerCase().trim();
          return senderEmail === crmLower || toEmail === crmLower;
        });
        if (activeFolder === 'external') return isExternal;
        if (activeFolder === 'internal') return !isExternal;
        if (activeFolder === 'followup') {
          if (!isExternal) return false;
          const lead = allLeads.find(l => {
            if (l.email?.toLowerCase() === senderEmail) return true;
            if (l.lead_emails?.some((e: any) => e.email?.toLowerCase() === senderEmail)) return true;
            return false;
          });
          if (!lead) return false;
          const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date(lead.created_at);
          return lastActivity < sevenDaysAgo;
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(email =>
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.snippet.toLowerCase().includes(query) ||
        (email.to && email.to.toLowerCase().includes(query))
      );
    }

    return result;
  }, [allEmails, crmEmails, activeFolder, searchQuery, allLeads, sentEmails, draftEmails]);

  // Reset page when folder or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFolder, searchQuery]);

  // Paginated emails
  const paginatedEmails = useMemo(() => {
    const startIndex = (currentPage - 1) * EMAILS_PER_PAGE;
    return filteredEmails.slice(startIndex, startIndex + EMAILS_PER_PAGE);
  }, [filteredEmails, currentPage]);

  const totalPages = Math.ceil(filteredEmails.length / EMAILS_PER_PAGE);
  const startEmailIndex = (currentPage - 1) * EMAILS_PER_PAGE + 1;
  const endEmailIndex = Math.min(currentPage * EMAILS_PER_PAGE, filteredEmails.length);

  // Calculate folder counts
  const folderCounts = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let externalCount = 0;
    let internalCount = 0;
    let followupCount = 0;
    let unreadCount = 0;

    allEmails.forEach(email => {
      const senderEmail = extractEmailAddress(email.from);
      const toEmail = extractEmailAddress(email.to || '');
      const isUnread = !email.isRead && !readEmailIds[email.id];
      if (isUnread) unreadCount++;
      const isExternal = crmEmails.some(crmEmail => {
        const crmLower = crmEmail.toLowerCase().trim();
        return senderEmail === crmLower || toEmail === crmLower;
      });
      if (isExternal) {
        externalCount++;
        const lead = allLeads.find(l => {
          if (l.email?.toLowerCase() === senderEmail) return true;
          if (l.lead_emails?.some((e: any) => e.email?.toLowerCase() === senderEmail)) return true;
          return false;
        });
        if (lead) {
          const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date(lead.created_at);
          if (lastActivity < sevenDaysAgo) followupCount++;
        }
      } else {
        internalCount++;
      }
    });

    return {
      inbox: unreadCount,
      drafts: draftEmails.length,
      external: externalCount,
      internal: internalCount,
      followup: followupCount,
    };
  }, [allEmails, crmEmails, allLeads, readEmailIds, draftEmails]);

  // Fetch pipeline stages for dropdown
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages-for-gmail'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, position')
        .order('position');
      return data || [];
    },
  });

  // Mutation to update lead
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, updates }: { leadId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
      toast.success('Lead updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Mutation to update pipeline lead stage
  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const { data: existing } = await supabase
        .from('pipeline_leads')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from('pipeline_leads').update({ stage_id: stageId }).eq('lead_id', leadId);
        if (error) throw error;
      } else {
        const { data: defaultPipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('is_main', true)
          .maybeSingle();
        const { error } = await supabase
          .from('pipeline_leads')
          .insert({ lead_id: leadId, stage_id: stageId, pipeline_id: defaultPipeline?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
      toast.success('Stage updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update stage: ' + error.message);
    },
  });

  // Lead matching wrappers
  const findLeadForEmail = useCallback((email: GmailEmail) => findLeadForEmailFn(email, allLeads), [allLeads]);

  const isExternalEmail = useCallback((email: GmailEmail) => {
    const senderEmail = extractEmailAddress(email.from);
    return crmEmails.some(crmEmail => senderEmail === crmEmail.toLowerCase());
  }, [crmEmails]);

  // People sync + CRM context
  const { allPeople, findPersonForEmail, isInternalSender, getCRMContext } = useGmailPeopleSync({
    allEmails,
    allLeads,
    findLeadForEmail,
  });

  // Generate AI draft for moving deal forward
  const handleMoveForward = useCallback(async (email: GmailEmail) => {
    const lead = findLeadForEmail(email);
    if (!lead) {
      toast.error('Could not find matching lead');
      return;
    }
    const flowId = `mf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[${flowId}] Move Forward initiated for lead: ${lead.name}`);
    setGeneratingDraftForId(email.id);
    setCurrentFlowId(flowId);
    setCurrentLeadIdForEmail(lead.id);

    try {
      const pipelineLead = lead.pipeline_leads?.[0];
      const stageName = pipelineLead?.pipeline_stages?.name || 'Unknown';
      const pipelineName = pipelineLead?.pipelines?.name || 'Unknown';
      const response = lead.lead_responses?.[0];
      const leadContext = {
        name: lead.name, company: lead.company_name, email: lead.email, phone: lead.phone,
        stage: stageName, pipeline: pipelineName, loanAmount: response?.loan_amount,
        loanType: response?.loan_type, fundingPurpose: response?.funding_purpose,
        fundingTimeline: response?.funding_timeline, notes: lead.notes,
        lastEmailSubject: email.subject, lastEmailSnippet: email.snippet,
      };

      console.log(`[${flowId}] Calling generate-lead-email API...`);
      const { data: { session } } = await supabase.auth.getSession();
      const aiResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lead-email`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadContext, emailType: 'move_forward', currentStage: stageName }),
        }
      );
      if (!aiResponse.ok) throw new Error('Failed to generate email');
      const { subject, body: generatedBody } = await aiResponse.json();

      console.log(`[${flowId}] AI generated content:`, {
        subject, generatedBodyLength: generatedBody?.length || 0,
        generatedBodyPreview: generatedBody?.substring(0, 200) || 'EMPTY',
      });

      const bodyPlain = generatedBody || '';
      const bodyHtml = bodyPlain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

      setCurrentBodyPlain(bodyPlain);
      setCurrentBodyHtml(bodyHtml);

      const toEmail = extractEmailAddress(email.from);
      const finalSubject = subject || `Re: ${email.subject}`;

      const { error: persistError } = await supabase
        .from('outbound_emails')
        .insert({
          user_id: session?.user?.id, flow_id: flowId, source: 'move_forward',
          lead_id: lead.id, to_email: toEmail, subject: finalSubject,
          body_html: bodyHtml, body_plain: bodyPlain, status: 'queued',
        });
      if (persistError) {
        console.error(`[${flowId}] Failed to persist to outbound_emails:`, persistError);
      } else {
        console.log(`[${flowId}] Persisted to outbound_emails with status=queued`);
      }

      setComposeTo(toEmail);
      setComposeSubject(finalSubject);
      setComposeBody(appendSignature(bodyHtml));
      setComposeOpen(true);
    } catch (error: any) {
      console.error(`[${flowId}] Error generating email:`, error);
      const firstName = lead?.name?.split(' ')[0] || extractSenderName(email.from).split(' ')[0];
      const fallbackPlain = `Hi ${firstName},\n\nThank you for your message. I wanted to follow up and discuss the next steps for moving your loan application forward.\n\nPlease let me know a good time to connect this week.\n\nBest regards,\nEvan`;
      const fallbackHtml = fallbackPlain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      setCurrentBodyPlain(fallbackPlain);
      setCurrentBodyHtml(fallbackHtml);
      setComposeTo(extractEmailAddress(email.from));
      setComposeSubject(`Re: ${email.subject}`);
      setComposeBody(appendSignature(fallbackHtml));
      setComposeOpen(true);
    } finally {
      setGeneratingDraftForId(null);
    }
  }, [findLeadForEmail, setComposeTo, setComposeSubject, setComposeBody, setComposeOpen, setCurrentLeadIdForEmail]);

  // Send email
  const handleSendEmail = useCallback(async (attachments: Attachment[]) => {
    if (!composeTo.trim()) { toast.error('Recipient is required'); return; }
    if (!composeSubject.trim()) { toast.error('Subject is required'); return; }
    if (!composeBody.trim()) { toast.error('Message body is required'); return; }

    setComposeSending(true);
    const flowId = currentFlowId || `send_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const toSend = composeTo;
    const subjectSend = composeSubject;
    const bodySend = composeBody;
    const bodyPlainSend = currentBodyPlain || composeBody;
    const threadIdSend = replyThreadId;
    const inReplyToSend = replyInReplyTo;
    const attachmentsSend = attachments.map(a => ({ filename: a.name, mimeType: a.type, data: a.base64 }));

    console.log(`[${flowId}] SEND EMAIL - Captured values:`, {
      to: toSend, subject: subjectSend,
      bodyHtmlLength: bodySend?.length || 0, bodyPlainLength: bodyPlainSend?.length || 0,
      attachmentsCount: attachmentsSend.length, leadId: currentLeadIdForEmail,
      threadId: threadIdSend, inReplyTo: inReplyToSend,
    });

    if (!bodySend || bodySend.trim() === '') {
      console.error(`[${flowId}] HARD FAIL - Body is empty!`);
      toast.error(`Move Forward failed: email body was empty. See flow_id: ${flowId}`);
      setComposeSending(false);
      return;
    }

    clearComposeParams();
    clearCompose();
    const toastId = toast.loading('Sending email...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload: Record<string, any> = {
        to: toSend, subject: subjectSend, body: bodySend,
        bodyPlain: bodyPlainSend, flowId, attachments: attachmentsSend,
      };
      if (threadIdSend) payload.threadId = threadIdSend;
      if (inReplyToSend) payload.inReplyTo = inReplyToSend;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api?action=send`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to send email');

      console.log(`[${flowId}] Gmail API response:`, {
        success: responseData.success, messageId: responseData.id,
        threadId: responseData.threadId, verified: responseData.verified,
      });

      if (currentFlowId) {
        await supabase.from('outbound_emails').update({
          status: 'sent', gmail_message_id: responseData.id,
          gmail_thread_id: responseData.threadId, sent_at: new Date().toISOString(),
        }).eq('flow_id', currentFlowId);
        console.log(`[${flowId}] Updated outbound_emails to status=sent`);
      }

      if (responseData.verified === false) {
        console.warn(`[${flowId}] WARNING: Email may have empty body`);
        toast.warning('Email sent, but body verification failed. Check Gmail to confirm.', { id: toastId });
      } else {
        toast.success('Email sent successfully', { id: toastId });
      }

      if (originatingTaskId) {
        console.log(`[${flowId}] Marking task ${originatingTaskId} as complete`);
        try {
          await supabase.from('evan_tasks').update({
            status: 'done', is_completed: true, updated_at: new Date().toISOString()
          }).eq('id', originatingTaskId);
          await supabase.from('lead_tasks').update({
            status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
          }).eq('id', originatingTaskId);
          queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
          toast.success('Task marked complete', { duration: 2000 });
        } catch (taskError) {
          console.error('Failed to mark task complete:', taskError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['evan-gmail-sent-emails'] });
    } catch (error: any) {
      console.error(`[${flowId}] Send email error:`, error);
      if (currentFlowId) {
        await supabase.from('outbound_emails').update({ status: 'failed', error: error.message }).eq('flow_id', currentFlowId);
      }
      toast.error(`Failed to send: ${error.message}`, { id: toastId });
    } finally {
      setComposeSending(false);
      setCurrentFlowId(null);
      setCurrentLeadIdForEmail(null);
      setCurrentBodyPlain('');
      setCurrentBodyHtml('');
      setReplyThreadId(null);
      setReplyInReplyTo(null);
    }
  }, [composeTo, composeSubject, composeBody, currentFlowId, currentBodyPlain, replyThreadId, replyInReplyTo, currentLeadIdForEmail, originatingTaskId, clearComposeParams, clearCompose, queryClient, setCurrentLeadIdForEmail, setReplyThreadId, setReplyInReplyTo]);

  const handleConnectGmail = useCallback(() => gmail.connectGmail(), [gmail]);

  // Handle reply to email thread
  const handleReply = useCallback((email: GmailEmail) => {
    const senderEmail = extractEmailAddress(email.from);
    const replySubject = email.subject.toLowerCase().startsWith('re:')
      ? email.subject
      : `Re: ${email.subject}`;

    const threadMessages = mockThreadMessages[email.threadId];
    let quotedContent = '';

    if (threadMessages && threadMessages.length > 0) {
      const lastMessage = threadMessages[threadMessages.length - 1];
      const messageDate = format(new Date(lastMessage.date), 'EEE, MMM d, yyyy \'at\' h:mm a');
      quotedContent = `
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;">
<p style="margin: 0 0 8px 0; font-size: 12px;">On ${messageDate}, ${extractSenderName(lastMessage.from)} wrote:</p>
<div style="white-space: pre-wrap;">${lastMessage.body.replace(/\n/g, '<br>')}</div>
</div>`;
    } else {
      const messageDate = format(new Date(email.date), 'EEE, MMM d, yyyy \'at\' h:mm a');
      const bodyToQuote = email.body || email.snippet || '';
      quotedContent = `
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;">
<p style="margin: 0 0 8px 0; font-size: 12px;">On ${messageDate}, ${extractSenderName(email.from)} wrote:</p>
<div style="white-space: pre-wrap;">${bodyToQuote.replace(/\n/g, '<br>')}</div>
</div>`;
    }

    setReplyThreadId(email.threadId);
    setReplyInReplyTo(email.id);
    const lead = findLeadForEmail(email);
    if (lead) setCurrentLeadIdForEmail(lead.id);
    setComposeTo(senderEmail);
    setComposeSubject(replySubject);
    setComposeBody(appendSignature('') + quotedContent);
    setComposeOpen(true);

    console.debug('[EvansGmail] Reply initiated', {
      threadId: email.threadId, inReplyTo: email.id, to: senderEmail, subject: replySubject,
    });
  }, [findLeadForEmail, setReplyThreadId, setReplyInReplyTo, setCurrentLeadIdForEmail, setComposeTo, setComposeSubject, setComposeBody, setComposeOpen]);

  // Inline reply send handler
  const handleInlineReplySend = useCallback(async (selectedEmail: GmailEmail, body: string, attachments: { name: string; type: string; base64?: string }[]) => {
    setInlineReplySending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : null;
      if (!authHeader) { toast.error('Not authenticated'); return; }

      const replySubject = selectedEmail.subject.toLowerCase().startsWith('re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`;
      const fullBody = appendSignature(body);
      const isMockEmail = selectedEmail.id.startsWith('mock-') || selectedEmail.threadId.startsWith('thread-mock-');

      const sendPayload: any = {
        to: extractEmailAddress(selectedEmail.from),
        subject: replySubject,
        body: fullBody,
        attachments: attachments.map(att => ({ filename: att.name, mimeType: att.type, data: att.base64 })),
      };
      if (!isMockEmail) {
        sendPayload.threadId = selectedEmail.threadId;
        sendPayload.inReplyTo = selectedEmail.id;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api?action=send`,
        { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(sendPayload) }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      const threadKey = selectedEmail.threadId || selectedEmail.id;
      const newReply: ThreadMessage = {
        id: `sent-${Date.now()}`,
        from: 'Evan <evan@commerciallendingx.com>',
        to: extractEmailAddress(selectedEmail.from),
        date: new Date().toISOString(),
        body: body,
        senderPhoto: null,
      };
      setLocalReplies(prev => ({ ...prev, [threadKey]: [...(prev[threadKey] || []), newReply] }));
      toast.success('Reply sent!');
      setShowInlineReply(false);

      const lead = findLeadForEmail(selectedEmail);
      if (lead) {
        await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id);
      }

      if (originatingTaskId) {
        await supabase.from('evan_tasks').update({ status: 'done', is_completed: true }).eq('id', originatingTaskId);
        await supabase.from('lead_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', originatingTaskId);
        queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
        setOriginatingTaskId(null);
      }

      queryClient.invalidateQueries({ queryKey: ['gmail-messages'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setInlineReplySending(false);
    }
  }, [findLeadForEmail, originatingTaskId, queryClient, setOriginatingTaskId]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSelectedEmailId(null);
    await new Promise(resolve => setTimeout(resolve, 300));
    await queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-emails`] });
    await queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-connection`] });
    await queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-count`] });
    await queryClient.invalidateQueries({ queryKey: ['crm-lead-emails'] });
    await queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
    await queryClient.refetchQueries({ queryKey: [`${userKey}-gmail-emails`] });
    setIsRefreshing(false);
    toast.success('Emails refreshed');
  }, [queryClient, userKey]);

  // Selected email + lead
  const selectedEmail = filteredEmails.find(e => e.id === selectedEmailId) || null;
  const selectedLead = selectedEmail ? findLeadForEmail(selectedEmail) : null;

  return {
    // Connection
    gmailConnection, connectionLoading, handleConnectGmail,
    disconnectGmail: gmail.disconnectGmail,

    // Folders
    activeFolder, setActiveFolder, folderCounts,

    // Email data
    emailsLoading, filteredEmails, paginatedEmails,
    totalPages, startEmailIndex, endEmailIndex, currentPage, setCurrentPage,
    EMAILS_PER_PAGE,

    // Selection
    selectedEmailId, setSelectedEmailId, selectedEmail, selectedLead,
    handleSelectEmail, handleMarkUnread,
    readEmailIds,

    // Search
    searchQuery, setSearchQuery,

    // Refresh
    isRefreshing, handleRefresh,

    // Compose
    composeOpen, setComposeOpen, composeTo, setComposeTo,
    composeSubject, setComposeSubject, composeBody, setComposeBody,
    composeSending, handleSendEmail,
    clearCompose, clearComposeParams,
    openedDraftIdRef, handledComposeKeyRef,

    // Reply
    handleReply,
    setReplyThreadId, setReplyInReplyTo,
    showInlineReply, setShowInlineReply,
    inlineReplySending, handleInlineReplySend,
    localReplies,

    // Deal sidebar
    showDealSidebar, setShowDealSidebar,
    showEmailAddress, setShowEmailAddress,

    // Lead detail
    leadDetailOpen, setLeadDetailOpen,
    selectedLeadIdForDetail, setSelectedLeadIdForDetail,
    allLeads,

    // Move forward
    generatingDraftForId, handleMoveForward,
    isGeneratingEmail,

    // Mutations
    updateLeadMutation, updateStageMutation,
    pipelineStages,

    // Tasks
    taskDialogOpen, setTaskDialogOpen,
    taskInitialTitle, setTaskInitialTitle,
    taskInitialDescription, setTaskInitialDescription,
    taskInitialLeadId, setTaskInitialLeadId,

    // Email templates
    emailTemplates,

    // Draft context passthrough
    currentLeadIdForEmail, setCurrentLeadIdForEmail,

    // Helpers
    findLeadForEmail, isExternalEmail,
    getNextStepSuggestion,
    extractSenderName, extractEmailAddress,

    // People / CRM context
    allPeople, findPersonForEmail, isInternalSender, getCRMContext,

    // Raw gmail hook for reconnect etc
    gmail,
  };
}

export type EvansGmailLogic = ReturnType<typeof useEvansGmailLogic>;
