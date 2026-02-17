import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import EvanLayout from '@/components/evan/EvanLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Inbox, Loader2, ChevronDown, Users, Building, ArrowRight, ArrowDown, Phone, Tag, Clock, FileText, BarChart3, User, Plus, Maximize2, Search, X, CalendarClock, RefreshCw, Check, MoreHorizontal, MailOpen, ListTodo, MessageSquare, Star, Reply, ReplyAll, Forward } from 'lucide-react';
import { GmailTaskDialog } from '@/components/admin/GmailTaskDialog';
import { Badge } from '@/components/ui/badge';
import InlineReplyBox, { InlineAttachment } from '@/components/admin/inbox/InlineReplyBox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDraft } from '@/contexts/DraftContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import GmailComposeDialog, { Attachment } from '@/components/admin/GmailComposeDialog';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { GmailSidebar, FolderType } from '@/components/admin/inbox/GmailSidebar';
import { cn } from '@/lib/utils';
import { EVAN_SIGNATURE_HTML, appendSignature } from '@/lib/email-signature';
// Shared Gmail modules
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { GmailEmail, ThreadMessage, extractSenderName, extractEmailAddress, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import {
  mockExternalEmails,
  mockThreadMessages,
  evanEmailTemplates as emailTemplates,
  findLeadForEmail as findLeadForEmailFn,
  getNextStepSuggestion,
} from '@/components/gmail/EvanGmailFeatures';


const EvansGmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Shared Gmail connection & email data
  const gmail = useGmailConnection({
    userKey: 'evan',
    callbackPrefix: 'admin',
    maxResults: 50,
    fetchPhotos: true,
    returnPath: '/team/evan/gmail',
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
  const EMAILS_PER_PAGE = 50;
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


  // URL params compose handling moved below allLeads query to avoid reference before declaration

  // Debug: log route transitions (helps identify unexpected redirects/resets)
  useEffect(() => {
    console.debug('[EvansGmail] route', `${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  const clearComposeParams = () => {
    const next = new URLSearchParams(searchParams);
    ['compose', 'to', 'draftId', 'leadId', 'template', 'taskId'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  // Mark email as read when selected
  const handleSelectEmail = (emailId: string) => {
    const email = filteredEmails.find((e) => e.id === emailId);
    if (email) {
      const body = (email.body || '').toString();
      console.log('[gmail-view] open email', {
        id: email.id,
        subject: email.subject,
        snippetLength: (email.snippet || '').length,
        bodyLength: body.length,
        bodyPreview: body.substring(0, 200),
      });
    }
    setSelectedEmailId(emailId);
    setReadEmailIds(prev => ({ ...prev, [emailId]: true }));
    // Reset inline reply when switching emails
    setShowInlineReply(false);
  };

  // Mark email as unread
  const handleMarkUnread = (emailId: string) => {
    setReadEmailIds(prev => {
      const newState = { ...prev };
      delete newState[emailId];
      return newState;
    });
  };
  

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

  // State for tracking email generation loading
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // Handle URL params to open compose dialog from dashboard nudges or tasks
  useEffect(() => {
    const compose = searchParams.get('compose');
    const to = searchParams.get('to');
    const draftId = searchParams.get('draftId');
    const leadId = searchParams.get('leadId');
    const template = searchParams.get('template');
    const taskId = searchParams.get('taskId'); // Track originating task for auto-completion

    // If there's no explicit target, allow future targets to be processed.
    if (!compose) {
      handledComposeKeyRef.current = null;
      return;
    }

    // If we need lead data to build the draft, wait until it's available.
    if (compose === 'true' && leadId && allLeads.length === 0) {
      return;
    }

    const intentKey = searchParams.toString();
    if (handledComposeKeyRef.current === intentKey) return;
    handledComposeKeyRef.current = intentKey;

    // Store the originating task ID so we can mark it complete after sending
    if (taskId) {
      setOriginatingTaskId(taskId);
      console.debug('[EvansGmail] Task linked to compose', { taskId });
    }

    console.debug('[EvansGmail] compose intent', {
      from: `${location.pathname}${location.search}`,
      compose,
      to,
      draftId,
      leadId,
      template,
      taskId,
    });
    
    if (compose === 'draft' && draftId) {
      // Draft was already created - keep target in URL so it can be restored after refresh.
      setActiveFolder('drafts');
      // Refetch drafts to ensure the new one is available
      refetchDrafts();
      toast.success('Draft ready');
    } else if (compose === 'new' && to) {
      // Open compose dialog for a new email
      setComposeTo(decodeURIComponent(to));
      setComposeSubject('');
      setComposeBody(EVAN_SIGNATURE_HTML);
      setComposeOpen(true);
    } else if (compose === 'true') {
      // Open compose dialog with optional lead and template context
      // Use AI to generate email content if leadId is provided
      
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
              // Call AI to generate email content
              const response = await supabase.functions.invoke('generate-lead-email', {
                body: {
                  leadId: lead.id,
                  emailType: template || 'follow_up',
                },
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
              // Fall back to basic template
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
          // Template without specific lead - use static template
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
          // Just open empty compose
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
      
      const allEmails = new Set<string>();
      
      leads?.forEach(l => l.email && allEmails.add(l.email.toLowerCase()));
      leadEmails?.forEach(e => e.email && allEmails.add(e.email.toLowerCase()));
      leadContacts?.forEach(c => c.email && allEmails.add(c.email.toLowerCase()));
      
      return Array.from(allEmails);
    },
  });


  // If the URL explicitly targets a draft, open it in the compose popup and keep it open until user closes.
  useEffect(() => {
    const compose = searchParams.get('compose');
    const draftId = searchParams.get('draftId');
    if (compose !== 'draft' || !draftId) return;

    // Prevent re-opening loops.
    if (openedDraftIdRef.current === draftId && composeOpen) return;

    const draft = draftEmails.find((d) => d.id === draftId);
    if (!draft) return;

    openedDraftIdRef.current = draftId;

    console.debug('[EvansGmail] opening draft in compose modal', {
      draftId,
      to: draft.to,
      subject: draft.subject,
    });

    setActiveFolder('drafts');
    setComposeTo(draft.to || '');
    setComposeSubject(draft.subject || '');
    setComposeBody(draft.body || EVAN_SIGNATURE_HTML);
    setComposeOpen(true);
  }, [draftEmails, composeOpen, searchParams]);

  // Combine real emails with mock external emails and sort by date (newest first)
  const allEmails = useMemo(() => {
    const combined = [...mockExternalEmails, ...emails];
    // Sort by date, newest first
    return combined.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [emails]);

  // Filter emails based on CRM classification, folder, and search query
  const filteredEmails = useMemo(() => {
    let result = allEmails;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Apply folder filter
    if (activeFolder === 'sent') {
      // Use the dedicated sent emails from Gmail API (not inbox emails)
      result = sentEmails.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    } else if (activeFolder === 'drafts') {
      // Use the dedicated drafts from Gmail API
      result = draftEmails.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    } else if (activeFolder === 'starred') {
      // Would be connected to Gmail starred
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
          // Show external leads where last activity is older than 7 days
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
    
    // Apply search filter
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
    const endIndex = startIndex + EMAILS_PER_PAGE;
    return filteredEmails.slice(startIndex, endIndex);
  }, [filteredEmails, currentPage, EMAILS_PER_PAGE]);

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
      
      // Count unread emails (not read via Gmail API AND not marked read locally)
      const isUnread = !email.isRead && !readEmailIds[email.id];
      if (isUnread) {
        unreadCount++;
      }
      
      const isExternal = crmEmails.some(crmEmail => {
        const crmLower = crmEmail.toLowerCase().trim();
        return senderEmail === crmLower || toEmail === crmLower;
      });
      
      if (isExternal) {
        externalCount++;
        // Check for follow-up
        const lead = allLeads.find(l => {
          if (l.email?.toLowerCase() === senderEmail) return true;
          if (l.lead_emails?.some((e: any) => e.email?.toLowerCase() === senderEmail)) return true;
          return false;
        });
        if (lead) {
          const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date(lead.created_at);
          if (lastActivity < sevenDaysAgo) {
            followupCount++;
          }
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
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);
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
      // First check if lead has a pipeline_leads entry
      const { data: existing } = await supabase
        .from('pipeline_leads')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('pipeline_leads')
          .update({ stage_id: stageId })
          .eq('lead_id', leadId);
        if (error) throw error;
      } else {
        // Create new pipeline_leads entry with default pipeline
        const { data: defaultPipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('is_main', true)
          .maybeSingle();
        
        const { error } = await supabase
          .from('pipeline_leads')
          .insert({
            lead_id: leadId,
            stage_id: stageId,
            pipeline_id: defaultPipeline?.id,
          });
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

  // Lead matching wrappers using shared helpers
  const findLeadForEmail = (email: GmailEmail) => findLeadForEmailFn(email, allLeads);

  const isExternalEmail = (email: GmailEmail) => {
    const senderEmail = extractEmailAddress(email.from);
    return crmEmails.some(crmEmail => senderEmail === crmEmail.toLowerCase());
  };

// Generate AI draft for moving deal forward - with persist-first pattern
  const handleMoveForward = async (email: GmailEmail) => {
    const lead = findLeadForEmail(email);
    if (!lead) {
      toast.error('Could not find matching lead');
      return;
    }

    // Generate unique flow_id for end-to-end tracking
    const flowId = `mf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[${flowId}] Move Forward initiated for lead: ${lead.name}`);
    
    setGeneratingDraftForId(email.id);
    setCurrentFlowId(flowId);
    setCurrentLeadIdForEmail(lead.id);
    
    try {
      // Get pipeline stage info
      const pipelineLead = lead.pipeline_leads?.[0];
      const stageName = pipelineLead?.pipeline_stages?.name || 'Unknown';
      const pipelineName = pipelineLead?.pipelines?.name || 'Unknown';
      
      // Get lead response data (loan details)
      const response = lead.lead_responses?.[0];
      
      // Build context for AI
      const leadContext = {
        name: lead.name,
        company: lead.company_name,
        email: lead.email,
        phone: lead.phone,
        stage: stageName,
        pipeline: pipelineName,
        loanAmount: response?.loan_amount,
        loanType: response?.loan_type,
        fundingPurpose: response?.funding_purpose,
        fundingTimeline: response?.funding_timeline,
        notes: lead.notes,
        lastEmailSubject: email.subject,
        lastEmailSnippet: email.snippet,
      };

      console.log(`[${flowId}] Calling generate-lead-email API...`);
      
      // Call AI to generate email
      const { data: { session } } = await supabase.auth.getSession();
      const aiResponse = await fetch(
        'https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/generate-lead-email',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadContext,
            emailType: 'move_forward',
            currentStage: stageName,
          }),
        }
      );

      if (!aiResponse.ok) {
        throw new Error('Failed to generate email');
      }

      const { subject, body: generatedBody } = await aiResponse.json();
      
      console.log(`[${flowId}] AI generated content:`, {
        subject,
        generatedBodyLength: generatedBody?.length || 0,
        generatedBodyPreview: generatedBody?.substring(0, 200) || 'EMPTY',
      });
      
      // Normalize: plain text (from AI) and HTML (for sending)
      const bodyPlain = generatedBody || '';
      // Convert plain text to HTML (replace newlines with <br>)
      const bodyHtml = bodyPlain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      
      console.log(`[${flowId}] Normalized content:`, {
        bodyPlainLength: bodyPlain.length,
        bodyHtmlLength: bodyHtml.length,
        bodyPlainPreview: bodyPlain.substring(0, 100),
        bodyHtmlPreview: bodyHtml.substring(0, 100),
      });
      
      // Store in state for sending
      setCurrentBodyPlain(bodyPlain);
      setCurrentBodyHtml(bodyHtml);
      
      // Persist to outbound_emails table BEFORE showing to user
      const toEmail = extractEmailAddress(email.from);
      const finalSubject = subject || `Re: ${email.subject}`;
      
      const { error: persistError } = await supabase
        .from('outbound_emails')
        .insert({
          user_id: session?.user?.id,
          flow_id: flowId,
          source: 'move_forward',
          lead_id: lead.id,
          to_email: toEmail,
          subject: finalSubject,
          body_html: bodyHtml,
          body_plain: bodyPlain,
          status: 'queued',
        });
      
      if (persistError) {
        console.error(`[${flowId}] Failed to persist to outbound_emails:`, persistError);
        // Continue anyway - we still have the content in memory
      } else {
        console.log(`[${flowId}] Persisted to outbound_emails with status=queued`);
      }
      
      // Open compose dialog with generated content (HTML version)
      setComposeTo(toEmail);
      setComposeSubject(finalSubject);
      setComposeBody(appendSignature(bodyHtml)); // Use HTML so it renders correctly
      setComposeOpen(true);
      
    } catch (error: any) {
      console.error(`[${flowId}] Error generating email:`, error);
      // Fallback to basic template
      const firstName = lead?.name?.split(' ')[0] || extractSenderName(email.from).split(' ')[0];
      const fallbackPlain = `Hi ${firstName},\n\nThank you for your message. I wanted to follow up and discuss the next steps for moving your loan application forward.\n\nPlease let me know a good time to connect this week.\n\nBest regards,\nEvan`;
      const fallbackHtml = fallbackPlain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      
      setCurrentBodyPlain(fallbackPlain);
      setCurrentBodyHtml(fallbackHtml);
      setComposeTo(extractEmailAddress(email.from));
      setComposeSubject(`Re: ${email.subject}`);
      setComposeBody(appendSignature(fallbackHtml));
      setComposeOpen(true);
    } finally {
      setGeneratingDraftForId(null);
    }
  };

// Send email - with flow_id tracking and persist-first verification
  const handleSendEmail = async (attachments: Attachment[]) => {
    // Validate first before any async operations
    if (!composeTo.trim()) {
      toast.error('Recipient is required');
      return;
    }
    if (!composeSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!composeBody.trim()) {
      toast.error('Message body is required');
      return;
    }

    setComposeSending(true);
    
    // Use existing flow_id if from Move Forward, otherwise generate new one
    const flowId = currentFlowId || `send_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Capture values BEFORE closing dialog
    const toSend = composeTo;
    const subjectSend = composeSubject;
    const bodySend = composeBody;
    const bodyPlainSend = currentBodyPlain || composeBody; // Fallback to current body
    const threadIdSend = replyThreadId;
    const inReplyToSend = replyInReplyTo;
    const attachmentsSend = attachments.map(a => ({
      filename: a.name,
      mimeType: a.type,
      data: a.base64,
    }));
    
    // CRITICAL: Comprehensive logging with flow_id
    console.log(`[${flowId}] SEND EMAIL - Captured values:`, {
      to: toSend,
      subject: subjectSend,
      bodyHtmlLength: bodySend?.length || 0,
      bodyPlainLength: bodyPlainSend?.length || 0,
      bodyHtmlPreview: bodySend?.substring(0, 200) || 'EMPTY',
      bodyPlainPreview: bodyPlainSend?.substring(0, 200) || 'EMPTY',
      attachmentsCount: attachmentsSend.length,
      leadId: currentLeadIdForEmail,
      threadId: threadIdSend,
      inReplyTo: inReplyToSend,
    });
    
    // HARD FAIL: Block if body is empty
    if (!bodySend || bodySend.trim() === '') {
      console.error(`[${flowId}] HARD FAIL - Body is empty!`);
      toast.error(`Move Forward failed: email body was empty. See flow_id: ${flowId}`);
      setComposeSending(false);
      return;
    }
    
    // Clear any compose/draft URL params so we don't reopen after send.
    clearComposeParams();

    // Clear form immediately using context clearCompose
    clearCompose();
    
    // Show sending toast
    const toastId = toast.loading('Sending email...');
    
    try {
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload: Record<string, any> = {
        to: toSend,
        subject: subjectSend,
        body: bodySend,
        bodyPlain: bodyPlainSend,
        flowId,
        attachments: attachmentsSend,
      };
      
      // Include thread context for replies
      if (threadIdSend) {
        payload.threadId = threadIdSend;
      }
      if (inReplyToSend) {
        payload.inReplyTo = inReplyToSend;
      }
      
      console.log(`[${flowId}] Sending to gmail-api edge function:`, {
        payloadBodyLength: payload.body.length,
        payloadBodyPreview: payload.body.substring(0, 300),
      });

      const response = await fetch(
        'https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to send email');
      }
      
      console.log(`[${flowId}] Gmail API response:`, {
        success: responseData.success,
        messageId: responseData.id,
        threadId: responseData.threadId,
        verified: responseData.verified,
        verificationDetails: responseData.verificationDetails,
      });
      
      // Update outbound_emails record with success
      if (currentFlowId) {
        await supabase
          .from('outbound_emails')
          .update({
            status: 'sent',
            gmail_message_id: responseData.id,
            gmail_thread_id: responseData.threadId,
            sent_at: new Date().toISOString(),
          })
          .eq('flow_id', currentFlowId);
        
        console.log(`[${flowId}] Updated outbound_emails to status=sent`);
      }
      
      // Show verification result
      if (responseData.verified === false) {
        console.warn(`[${flowId}] WARNING: Email may have empty body - verification failed`);
        toast.warning('Email sent, but body verification failed. Check Gmail to confirm.', { id: toastId });
      } else {
        toast.success('Email sent successfully', { id: toastId });
      }
      
      // Mark originating task as complete if this email was triggered from "Go To"
      if (originatingTaskId) {
        console.log(`[${flowId}] Marking task ${originatingTaskId} as complete`);
        try {
          await supabase
            .from('evan_tasks')
            .update({ 
              status: 'done', 
              is_completed: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', originatingTaskId);
          
          // Also update lead_tasks if it exists there
          await supabase
            .from('lead_tasks')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', originatingTaskId);
          
          // Invalidate task queries so the UI updates
          queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
          
          toast.success('Task marked complete', { duration: 2000 });
        } catch (taskError) {
          console.error('Failed to mark task complete:', taskError);
          // Don't show error toast - email was still sent successfully
        }
      }
      
      // Refresh sent emails in background
      queryClient.invalidateQueries({ queryKey: ['evan-gmail-sent-emails'] });
      
    } catch (error: any) {
      console.error(`[${flowId}] Send email error:`, error);
      
      // Update outbound_emails record with error
      if (currentFlowId) {
        await supabase
          .from('outbound_emails')
          .update({
            status: 'failed',
            error: error.message,
          })
          .eq('flow_id', currentFlowId);
      }
      
      toast.error(`Failed to send: ${error.message}`, { id: toastId });
    } finally {
      setComposeSending(false);
      // Clear flow state
      setCurrentFlowId(null);
      setCurrentLeadIdForEmail(null);
      setCurrentBodyPlain('');
      setCurrentBodyHtml('');
      // Clear reply context
      setReplyThreadId(null);
      setReplyInReplyTo(null);
    }
  };

  // Connect Gmail - delegates to shared hook
  const handleConnectGmail = () => gmail.connectGmail();

  // Handle reply to email thread
  const handleReply = (email: GmailEmail) => {
    // Extract sender email for reply
    const senderEmail = extractEmailAddress(email.from);
    
    // Build reply subject (add Re: if not already present)
    const replySubject = email.subject.toLowerCase().startsWith('re:') 
      ? email.subject 
      : `Re: ${email.subject}`;
    
    // Get the last message body for quoting
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
      // Quote the email snippet/body
      const messageDate = format(new Date(email.date), 'EEE, MMM d, yyyy \'at\' h:mm a');
      const bodyToQuote = email.body || email.snippet || '';
      quotedContent = `
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;">
<p style="margin: 0 0 8px 0; font-size: 12px;">On ${messageDate}, ${extractSenderName(email.from)} wrote:</p>
<div style="white-space: pre-wrap;">${bodyToQuote.replace(/\n/g, '<br>')}</div>
</div>`;
    }
    
    // Set reply context
    setReplyThreadId(email.threadId);
    setReplyInReplyTo(email.id);
    
    // Find the lead for this email
    const lead = findLeadForEmail(email);
    if (lead) {
      setCurrentLeadIdForEmail(lead.id);
    }
    
    // Open compose with reply content
    setComposeTo(senderEmail);
    setComposeSubject(replySubject);
    setComposeBody(appendSignature('') + quotedContent);
    setComposeOpen(true);
    
    console.debug('[EvansGmail] Reply initiated', {
      threadId: email.threadId,
      inReplyTo: email.id,
      to: senderEmail,
      subject: replySubject,
    });
  };

  if (connectionLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </EvanLayout>
    );
  }

  // Not connected
  if (!gmailConnection) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="text-center">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Gmail account to view emails
            </p>
            <Button onClick={handleConnectGmail}>
              Connect Gmail
            </Button>
          </div>
        </div>
      </EvanLayout>
    );
  }

  const selectedEmail = filteredEmails.find(e => e.id === selectedEmailId);
  const selectedLead = selectedEmail ? findLeadForEmail(selectedEmail) : null;

  return (
    <EvanLayout>
      {/* Email generation loading overlay */}
      {isGeneratingEmail && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-xl p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Generating email draft...</p>
            <p className="text-xs text-muted-foreground">Using AI to craft your message</p>
          </div>
        </div>
      )}
      <div className="flex h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background">
        {/* Sidebar */}
        <GmailSidebar
          activeFolder={activeFolder}
          onFolderChange={(folder) => {
            setActiveFolder(folder);
            setSelectedEmailId(null);
          }}
          onComposeClick={() => {
            setComposeTo('');
            setComposeSubject('');
            setComposeBody(EVAN_SIGNATURE_HTML);
            setComposeOpen(true);
          }}
          counts={folderCounts}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header with Search and Refresh */}
          <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
            <Button 
              variant="outline"
              size="icon"
              onClick={async () => {
                setIsRefreshing(true);
                setSelectedEmailId(null);
                // Small delay to show the loading state
                await new Promise(resolve => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
                await queryClient.invalidateQueries({ queryKey: ['gmail-connection'] });
                await queryClient.invalidateQueries({ queryKey: ['crm-emails'] });
                await queryClient.invalidateQueries({ queryKey: ['all-leads'] });
                await queryClient.refetchQueries({ queryKey: ['gmail-emails'] });
                setIsRefreshing(false);
                toast.success('Emails refreshed');
              }}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8 h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            
            {/* Pagination Controls */}
            {filteredEmails.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                <span>
                  {startEmailIndex}-{endEmailIndex} of {filteredEmails.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </Button>
              </div>
            )}
          </div>

        {/* Email List / Email View */}
        <div className="flex-1 overflow-hidden relative">
          {/* Refresh overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary/80" />
                <p className="text-sm text-muted-foreground">Refreshing emails...</p>
              </div>
            </div>
          )}
          {selectedEmailId && selectedEmail ? (
            // Full Email View with Deal Summary Sidebar for External
            <div className="h-full flex">
              {/* Email Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedEmailId(null); setShowDealSidebar(false); }}>
                      ← Back
                    </Button>
                  </div>
                  
                  {/* Email Action Buttons */}
                  <div className="flex items-center gap-1">
                    {/* Reply Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInlineReply(true)}
                      className="gap-2"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </Button>
                    
                    {/* Reply All - show only if there are CC recipients */}
                    {selectedEmail.cc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Reply All: include CC recipients
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
                        }}
                        className="gap-2"
                      >
                        <ReplyAll className="w-4 h-4" />
                      </Button>
                    )}
                    
                    {/* Forward */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const fwdSubject = selectedEmail.subject.toLowerCase().startsWith('fwd:') 
                          ? selectedEmail.subject 
                          : `Fwd: ${selectedEmail.subject}`;
                        
                        // Get the message body for forwarding
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
                        
                        setReplyThreadId(null); // New thread for forward
                        setReplyInReplyTo(null);
                        setComposeTo('');
                        setComposeSubject(fwdSubject);
                        setComposeBody(appendSignature('') + forwardContent);
                        setComposeOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Forward className="w-4 h-4" />
                    </Button>
                    
                    {/* Add to do task - available for borrower threads */}
                    {selectedLead && isExternalEmail(selectedEmail) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const senderName = extractSenderName(selectedEmail.from);
                          const taskTitle = `Follow up: ${selectedEmail.subject}`;
                          const taskDescription = `From: ${senderName}\n\nEmail snippet: ${selectedEmail.snippet}`;
                          setTaskInitialTitle(taskTitle);
                          setTaskInitialDescription(taskDescription);
                          setTaskInitialLeadId(selectedLead.id);
                          setTaskDialogOpen(true);
                        }}
                        className="gap-2"
                      >
                        <ListTodo className="w-4 h-4" />
                        Add Task
                      </Button>
                    )}
                    
                    {/* Toggle Deal Sidebar button - only for external leads */}
                    {selectedLead && isExternalEmail(selectedEmail) && (
                      <Button
                        variant={showDealSidebar ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowDealSidebar(!showDealSidebar)}
                        className="gap-2 ml-2"
                      >
                        <User className="w-4 h-4" />
                        {showDealSidebar ? 'Hide Lead Info' : 'Show Lead Info'}
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <h1 className="text-xl font-semibold mb-6 leading-tight">{selectedEmail.subject}</h1>
                    
                    {/* Thread Messages */}
                    {(() => {
                      const threadKey = selectedEmail.threadId || selectedEmail.id;
                      const baseMessages = mockThreadMessages[selectedEmail.threadId] || [];
                      const sentReplies = localReplies[threadKey] || [];
                      const allMessages = [...baseMessages, ...sentReplies];
                      
                      if (allMessages.length > 0) {
                        return (
                          <div className="divide-y divide-border">
                            {allMessages.map((msg, index) => {
                              const isFromEvan = msg.from.toLowerCase().includes('evan');
                              return (
                                <div key={msg.id} className={cn(
                                  "py-6",
                                  index === 0 && "pt-0"
                                )}>
                                  <div className="p-4 rounded-lg">
                                    <div className="flex items-start gap-3 mb-4">
                                      <Avatar className="w-10 h-10 flex-shrink-0">
                                        {msg.senderPhoto ? (
                                          <AvatarImage src={msg.senderPhoto} />
                                        ) : null}
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
                                        <p className="text-xs text-muted-foreground">
                                          To: {msg.to}
                                        </p>
                                      </div>
                                    </div>
                                    <div 
                                      className="text-sm whitespace-pre-wrap leading-relaxed pl-[52px]"
                                      dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body) }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    })() || (
                      // Fallback for emails without thread messages - show original + any local replies
                      <>
                        <div className="divide-y divide-border">
                          {/* Original email */}
                          <div className="pb-6">
                            <div className="flex items-center gap-3 mb-4">
                              <Avatar className="w-10 h-10 flex-shrink-0">
                                {selectedEmail.senderPhoto ? (
                                  <AvatarImage src={selectedEmail.senderPhoto} />
                                ) : null}
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
                                {/* Show To, CC, BCC for sent emails */}
                                {activeFolder === 'sent' && (
                                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                    {selectedEmail.to && (
                                      <p><span className="font-medium">To:</span> {selectedEmail.to}</p>
                                    )}
                                    {selectedEmail.cc && (
                                      <p><span className="font-medium">Cc:</span> {selectedEmail.cc}</p>
                                    )}
                                    {selectedEmail.bcc && (
                                      <p><span className="font-medium">Bcc:</span> {selectedEmail.bcc}</p>
                                    )}
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
                                  (selectedEmail.body && selectedEmail.body.trim())
                                    ? selectedEmail.body
                                    : selectedEmail.snippet
                                ),
                              }}
                            />
                          </div>
                          
                          {/* Local replies for this thread */}
                          {(localReplies[selectedEmail.threadId || selectedEmail.id] || []).map((msg) => {
                            const isFromEvan = msg.from.toLowerCase().includes('evan');
                            return (
                              <div key={msg.id} className="py-6">
                                <div className="p-4 rounded-lg">
                                  <div className="flex items-start gap-3 mb-4">
                                    <Avatar className="w-10 h-10 flex-shrink-0">
                                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                                        E
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium text-sm">{extractSenderName(msg.from)}</p>
                                        <p className="text-xs text-muted-foreground flex-shrink-0">
                                          {format(new Date(msg.date), 'MMM d, yyyy, h:mm a')}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        To: {msg.to}
                                      </p>
                                    </div>
                                  </div>
                                  <div 
                                    className="text-sm whitespace-pre-wrap leading-relaxed pl-[52px]"
                                    dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body) }}
                                  />
                                </div>
                              </div>
                            );
                          })}
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
                          setInlineReplySending(true);
                          try {
                            // Get auth header
                            const { data: { session } } = await supabase.auth.getSession();
                            const authHeader = session?.access_token ? `Bearer ${session.access_token}` : null;
                            if (!authHeader) {
                              toast.error('Not authenticated');
                              return;
                            }

                            // Build reply subject
                            const replySubject = selectedEmail.subject.toLowerCase().startsWith('re:') 
                              ? selectedEmail.subject 
                              : `Re: ${selectedEmail.subject}`;

                            // Get signature and build full body
                            const fullBody = appendSignature(body);

                            // Detect if this is a mock email (not a real Gmail thread)
                            const isMockEmail = selectedEmail.id.startsWith('mock-') || selectedEmail.threadId.startsWith('thread-mock-');
                            
                            // Build request payload - don't include threadId/inReplyTo for mock emails
                            const sendPayload: any = {
                              to: extractEmailAddress(selectedEmail.from),
                              subject: replySubject,
                              body: fullBody,
                              attachments: attachments.map(att => ({
                                filename: att.name,
                                mimeType: att.type,
                                data: att.base64,
                              })),
                            };
                            
                            // Only add threading info for real Gmail messages
                            if (!isMockEmail) {
                              sendPayload.threadId = selectedEmail.threadId;
                              sendPayload.inReplyTo = selectedEmail.id;
                            }

                            // Send the email
                            const response = await fetch(
                              `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send`,
                              {
                                method: 'POST',
                                headers: {
                                  Authorization: authHeader,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(sendPayload),
                              }
                            );

                            if (!response.ok) {
                              const data = await response.json();
                              throw new Error(data.error || 'Failed to send email');
                            }

                            // Add the sent reply to local state so it appears in the thread
                            const threadKey = selectedEmail.threadId || selectedEmail.id;
                            const newReply: ThreadMessage = {
                              id: `sent-${Date.now()}`,
                              from: 'Evan <evan@commerciallendingx.com>',
                              to: extractEmailAddress(selectedEmail.from),
                              date: new Date().toISOString(),
                              body: body, // Use the original body without signature for cleaner display
                              senderPhoto: null,
                            };
                            
                            setLocalReplies(prev => ({
                              ...prev,
                              [threadKey]: [...(prev[threadKey] || []), newReply],
                            }));
                            
                            toast.success('Reply sent!');
                            setShowInlineReply(false);
                            
                            // Update lead's last_activity_at
                            const lead = findLeadForEmail(selectedEmail);
                            if (lead) {
                              await supabase
                                .from('leads')
                                .update({ last_activity_at: new Date().toISOString() })
                                .eq('id', lead.id);
                            }

                            // If originated from a task, mark it complete
                            if (originatingTaskId) {
                              await supabase
                                .from('evan_tasks')
                                .update({ status: 'done', is_completed: true })
                                .eq('id', originatingTaskId);
                              
                              await supabase
                                .from('lead_tasks')
                                .update({ status: 'completed', completed_at: new Date().toISOString() })
                                .eq('id', originatingTaskId);
                              
                              queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
                              queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
                              setOriginatingTaskId(null);
                            }

                            // Refresh emails
                            queryClient.invalidateQueries({ queryKey: ['gmail-messages'] });
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to send reply');
                          } finally {
                            setInlineReplySending(false);
                          }
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
                        {/* Show Reply all if there are CC recipients */}
                        {(selectedEmail.cc || (selectedEmail.to && selectedEmail.to.includes(','))) && (
                          <Button
                            variant="outline"
                            className="flex-1 justify-center gap-2 h-11 rounded-full"
                            onClick={() => {
                              // Get all recipients for reply all
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
              
              {/* Deal Summary Sidebar for External Leads - Only shown when toggled */}
              {showDealSidebar && selectedLead && isExternalEmail(selectedEmail) && (
                <div className="w-80 border-l border-border bg-background dark:bg-slate-900 overflow-y-auto">
                  {/* Header Title */}
                  <div className="px-3 pt-3 pb-2">
                    <h3 className="text-sm font-semibold text-foreground">CRM Lead Info</h3>
                  </div>
                  {/* Stage and Assignment Row */}
                  <div className="px-3 pb-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Stage</p>
                        <Select
                          value={selectedLead.pipeline_leads?.[0]?.stage_id || ''}
                          onValueChange={(value) => {
                            updateStageMutation.mutate({
                              leadId: selectedLead.id,
                              stageId: value,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-sm bg-background">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: selectedLead.pipeline_leads?.[0]?.pipeline_stages?.color || '#0066FF' }}
                              />
                              <SelectValue placeholder="Select stage">
                                {selectedLead.pipeline_leads?.[0]?.pipeline_stages?.name || 'Discovery'}
                              </SelectValue>
                            </div>
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {pipelineStages.map((stage: any) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: stage.color || '#0066FF' }}
                                  />
                                  {stage.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 bg-emerald-600">
                            <AvatarFallback className="text-xs text-white bg-emerald-600">E</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">Evan</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedLeadIdForDetail(selectedLead.id);
                        setLeadDetailOpen(true);
                      }}
                      title="View full details"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100%-70px)]">
                    <div className="p-4 space-y-2">
                      {/* Contact Info Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">Contact Info</span>
                        </div>
                        <div className="space-y-3 pl-6">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Contact Name</p>
                            <Input
                              className="h-8 text-sm bg-background"
                              defaultValue={selectedLead.name}
                              onBlur={(e) => {
                                if (e.target.value !== selectedLead.name) {
                                  updateLeadMutation.mutate({
                                    leadId: selectedLead.id,
                                    updates: { name: e.target.value },
                                  });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Known As</p>
                            <Input
                              className="h-8 text-sm bg-background"
                              placeholder="Nickname or alias"
                              defaultValue={selectedLead.known_as || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (selectedLead.known_as || '')) {
                                  updateLeadMutation.mutate({
                                    leadId: selectedLead.id,
                                    updates: { known_as: e.target.value || null },
                                  });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Company</p>
                            <Input
                              className="h-8 text-sm bg-background"
                              placeholder="Company name"
                              defaultValue={selectedLead.company_name || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (selectedLead.company_name || '')) {
                                  updateLeadMutation.mutate({
                                    leadId: selectedLead.id,
                                    updates: { company_name: e.target.value || null },
                                  });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Title</p>
                            <Input
                              className="h-8 text-sm bg-background"
                              placeholder="Job title"
                              defaultValue={selectedLead.title || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (selectedLead.title || '')) {
                                  updateLeadMutation.mutate({
                                    leadId: selectedLead.id,
                                    updates: { title: e.target.value || null },
                                  });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Contact Type</p>
                            <Select
                              value={selectedLead.contact_type || 'potential_customer'}
                              onValueChange={(value) => {
                                updateLeadMutation.mutate({
                                  leadId: selectedLead.id,
                                  updates: { contact_type: value },
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="potential_customer">Potential Customer</SelectItem>
                                <SelectItem value="existing_customer">Existing Customer</SelectItem>
                                <SelectItem value="referral_partner">Referral Partner</SelectItem>
                                <SelectItem value="vendor">Vendor</SelectItem>
                                <SelectItem value="lender">Lender</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Contacts Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">Contacts</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {selectedLead.lead_contacts?.length || 0}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {(!selectedLead.lead_contacts || selectedLead.lead_contacts.length === 0) ? (
                            <p className="text-sm text-muted-foreground italic">No contacts added yet</p>
                          ) : (
                            selectedLead.lead_contacts.map((contact: any) => (
                              <div key={contact.id} className="py-2 border-b border-border last:border-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{contact.name}</p>
                                  {contact.is_primary && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
                                  )}
                                </div>
                                {contact.title && (
                                  <p className="text-xs text-muted-foreground">{contact.title}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-1">
                                  {contact.email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="w-3 h-3" />
                                      <span>{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="w-3 h-3" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                          <Button variant="link" className="text-primary text-sm p-0 h-auto">
                            <Plus className="w-4 h-4 mr-1" />
                            Add contact
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Phone Numbers Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">Phone Numbers</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {(selectedLead.lead_phones?.length || 0) + (selectedLead.phone && !selectedLead.lead_phones?.length ? 1 : 0)}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                            <div className="py-1">
                              <p className="text-sm text-foreground">{selectedLead.phone}</p>
                              <p className="text-xs text-muted-foreground">Primary</p>
                            </div>
                          )}
                          {selectedLead.lead_phones?.map((phone: any) => (
                            <div key={phone.id} className="py-1">
                              <p className="text-sm text-foreground">{phone.phone_number}</p>
                              <p className="text-xs text-muted-foreground capitalize">{phone.phone_type || 'Primary'}</p>
                            </div>
                          ))}
                          {!selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                            <p className="text-sm text-muted-foreground italic">No phone numbers</p>
                          )}
                          <Button variant="link" className="text-primary text-sm p-0 h-auto">
                            <Plus className="w-4 h-4 mr-1" />
                            Add phone
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Email Addresses Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">Email Addresses</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {(selectedLead.lead_emails?.length || 0) + (selectedLead.email && !selectedLead.lead_emails?.length ? 1 : 0)}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                            <div className="py-1">
                              <p className="text-sm text-foreground">{selectedLead.email}</p>
                              <p className="text-xs text-muted-foreground">Primary</p>
                            </div>
                          )}
                          {selectedLead.lead_emails?.map((email: any) => (
                            <div key={email.id} className="py-1">
                              <p className="text-sm text-foreground">{email.email}</p>
                              <p className="text-xs text-muted-foreground capitalize">{email.email_type || 'Primary'}</p>
                            </div>
                          ))}
                          {!selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                            <p className="text-sm text-muted-foreground italic">No email addresses</p>
                          )}
                          <Button variant="link" className="text-primary text-sm p-0 h-auto">
                            <Plus className="w-4 h-4 mr-1" />
                            Add email
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Action Button */}
                      <div className="pt-4">
                        <Button 
                          className="w-full bg-[#0066FF]/80 hover:bg-[#0052CC]/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveForward(selectedEmail);
                          }}
                          disabled={generatingDraftForId === selectedEmail.id}
                        >
                          {generatingDraftForId === selectedEmail.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4 mr-2" />
                          )}
                          Move Forward
                        </Button>
                      </div>

                      {/* Quick Notes */}
                      {selectedLead.notes && (
                        <div className="pt-4">
                          <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-2">NOTES</p>
                          <p className="text-sm text-foreground/80 leading-relaxed">{selectedLead.notes}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : activeFolder === 'templates' ? (
            // Templates View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b border-border">
                <h2 className="font-semibold text-sm">Email Templates</h2>
                <p className="text-xs text-muted-foreground mt-1">Click a template to use it in a new email</p>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {emailTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => {
                        setComposeTo('');
                        setComposeSubject(template.subject);
                        setComposeBody(appendSignature(template.body));
                        setComposeOpen(true);
                      }}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{template.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">Subject:</span> {template.subject}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            // Email List View
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
                              onClick={(e) => {
                                e.stopPropagation();
                                // Star toggle functionality - for now just visual
                              }}
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
                                  const taskTitle = `Follow up: ${email.subject}`;
                                  const taskDescription = `From: ${senderName}\n\nEmail snippet: ${email.snippet}`;
                                  setTaskInitialTitle(taskTitle);
                                  setTaskInitialDescription(taskDescription);
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
                              {/* Last Touch, Stage Age & Loan Size indicators */}
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
                                  {/* Stage Age badge */}
                                  {(() => {
                                    // Use qualified_at for qualified+ stages, converted_at for converted, otherwise created_at
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
          )}
          </div>
        </div>
      </div>

      {/* Compose Dialog */}
      <GmailComposeDialog
        isOpen={composeOpen}
        onClose={() => {
          // Just close the dialog - DON'T clear the content
          // This allows the draft to persist when navigating away and back
          setComposeOpen(false);
          openedDraftIdRef.current = null;
          handledComposeKeyRef.current = null;
          clearComposeParams();
        }}
        onDiscard={() => {
          // User explicitly discards - clear everything
          clearCompose();
          openedDraftIdRef.current = null;
          handledComposeKeyRef.current = null;
          clearComposeParams();
        }}
        to={composeTo}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        sending={composeSending}
        templates={emailTemplates}
      />

      {/* Lead Detail Dialog */}
      {selectedLeadIdForDetail && (
        <LeadDetailDialog
          lead={allLeads.find(l => l.id === selectedLeadIdForDetail) || null}
          open={leadDetailOpen}
          onOpenChange={(open) => {
            setLeadDetailOpen(open);
            if (!open) setSelectedLeadIdForDetail(null);
          }}
        />
      )}
      
      {/* Task Creation Dialog */}
      <GmailTaskDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        initialTitle={taskInitialTitle}
        initialDescription={taskInitialDescription}
        initialLeadId={taskInitialLeadId}
      />
    </EvanLayout>
  );
};

export default EvansGmail;
