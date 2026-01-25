import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Inbox, Loader2, ChevronDown, Users, Building, ArrowRight, ArrowDown, Phone, Tag, Clock, FileText, BarChart3, User, Plus, Maximize2, Search, X, CalendarClock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GmailComposeDialog, { Attachment } from '@/components/admin/GmailComposeDialog';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { cn } from '@/lib/utils';

// Import avatar images
import robertMartinezAvatar from '@/assets/avatars/robert-martinez.jpg';
import sarahRichardsonAvatar from '@/assets/avatars/sarah-richardson.jpg';
import michaelChenAvatar from '@/assets/avatars/michael-chen.jpg';
import davidKimAvatar from '@/assets/avatars/david-kim.jpg';

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  isRead: boolean;
  senderPhoto?: string | null;
}

type FilterType = 'inbox' | 'external' | 'internal' | 'followup' | 'templates';

// Email templates
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const emailTemplates: EmailTemplate[] = [
  {
    id: 'template-1',
    name: 'Initial Outreach',
    subject: 'Commercial Lending Opportunity',
    body: 'Hi, I wanted to reach out about financing options that could help grow your business.',
  },
  {
    id: 'template-2',
    name: 'Follow-Up',
    subject: 'Following Up on Our Conversation',
    body: 'Just checking in to see if you had any questions about the loan options we discussed.',
  },
  {
    id: 'template-3',
    name: 'Document Request',
    subject: 'Documents Needed for Your Application',
    body: 'To move forward with your application, please provide the following documents at your earliest convenience.',
  },
  {
    id: 'template-4',
    name: 'Rate Update',
    subject: 'Great News - Rates Have Changed',
    body: 'I wanted to let you know that rates have moved favorably and now might be a good time to revisit your financing.',
  },
  {
    id: 'template-5',
    name: 'Thank You',
    subject: 'Thank You for Your Business',
    body: 'Thank you for choosing us for your financing needs - please don\'t hesitate to reach out if you need anything.',
  },
];

// Mock external emails using CRM lead email addresses
const mockExternalEmails: Email[] = [
  {
    id: 'mock-1',
    threadId: 'thread-mock-1',
    subject: 'RE: Loan Application Status Update',
    from: 'Robert Martinez <robert.martinez@capitalventures.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    snippet: 'Hi Evan, Just following up on our conversation about the $2.5M acquisition loan. We have completed the due diligence...',
    isRead: false,
    senderPhoto: robertMartinezAvatar,
  },
  {
    id: 'mock-2',
    threadId: 'thread-mock-2',
    subject: 'Documents for Property Appraisal',
    from: 'Sarah Richardson <sarah.r@meridiangroup.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    snippet: 'Please find attached the property appraisal documents for the Meridian Plaza project. Let me know if you need anything else.',
    isRead: true,
    senderPhoto: sarahRichardsonAvatar,
  },
  {
    id: 'mock-3',
    threadId: 'thread-mock-3',
    subject: 'Urgent: Term Sheet Review Required',
    from: 'Michael Chen <mchen@techvest.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    snippet: 'Evan, I need your input on the term sheet before our meeting tomorrow. The interest rate seems higher than discussed...',
    isRead: false,
    senderPhoto: michaelChenAvatar,
  },
  {
    id: 'mock-4',
    threadId: 'thread-mock-4',
    subject: 'New Restaurant Location Financing',
    from: 'David Kim <dkim@seoulfoodgroup.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    snippet: 'Looking to expand Seoul Food Group with 3 new locations in the downtown area. Would love to discuss financing options...',
    isRead: true,
    senderPhoto: davidKimAvatar,
  },
  {
    id: 'mock-5',
    threadId: 'thread-mock-5',
    subject: 'Healthcare Facility Refinance Question',
    from: 'Lisa Wong <lisa@pacificmedgroup.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    snippet: 'Our current loan matures in 6 months and we are exploring refinance options. The facility is valued at $8.2M...',
    isRead: true,
  },
  {
    id: 'mock-6',
    threadId: 'thread-mock-6',
    subject: 'Manufacturing Equipment Loan Application',
    from: 'Thomas Wright <twright@wrightmanufacturing.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    snippet: 'Following up on our call about equipment financing. We need approximately $1.8M for new CNC machines and automation...',
    isRead: false,
  },
  {
    id: 'mock-7',
    threadId: 'thread-mock-7',
    subject: 'Senior Living Facility Acquisition',
    from: 'Rachel Adams <rachel@sunriseseniorliving.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    snippet: 'Great news - the seller accepted our offer! Now we need to move quickly on the financing. The purchase price is $12.5M...',
    isRead: true,
  },
  {
    id: 'mock-8',
    threadId: 'thread-mock-8',
    subject: 'Boutique Hotel Expansion Plans',
    from: 'Sophia Laurent <sophia@luxestays.co>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    snippet: 'We are looking to add 40 more rooms to our property in Napa. I have attached our revenue projections and construction estimates...',
    isRead: true,
  },
  {
    id: 'mock-9',
    threadId: 'thread-mock-9',
    subject: 'Commercial Property Portfolio Review',
    from: 'Andrew Foster <afoster@greenleafprops.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    snippet: 'Can we schedule a call to review our portfolio? We have 5 properties that may need refinancing before year end...',
    isRead: true,
  },
  {
    id: 'mock-10',
    threadId: 'thread-mock-10',
    subject: 'Healthcare Expansion Financing Inquiry',
    from: 'Emily Wang <ewang@sunrisehealthcare.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    snippet: 'Sunrise Healthcare is planning to open a new urgent care center. We are looking at properties in the $3-4M range...',
    isRead: true,
  },
];

const extractSenderName = (from: string) => {
  const match = from.match(/^([^<]+)/);
  if (match) return match[1].trim().replace(/"/g, '');
  return from.split('@')[0];
};

const extractEmailAddress = (from: string): string => {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  if (from.includes('@')) return from.toLowerCase();
  return '';
};

const EvansGmail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('inbox');
  
  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [generatingDraftForId, setGeneratingDraftForId] = useState<string | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [selectedLeadIdForDetail, setSelectedLeadIdForDetail] = useState<string | null>(null);
  const [showDealSidebar, setShowDealSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: gmailConnection, isLoading: connectionLoading } = useQuery({
    queryKey: ['evan-gmail-connection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

  // Fetch CRM lead emails for classification
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

  // Fetch emails
  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['evan-gmail-emails'],
    queryFn: async () => {
      // Refresh the session to get a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        console.error('Session refresh failed:', sessionError);
        return [];
      }

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=in:inbox&maxResults=50&fetchPhotos=true`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch emails');

      return (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        to: msg.to || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        isRead: !msg.isUnread,
        senderPhoto: msg.senderPhoto || null,
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

  // Combine real emails with mock external emails
  const allEmails = useMemo(() => {
    return [...mockExternalEmails, ...emails];
  }, [emails]);

  // Filter emails based on CRM classification and search query
  const filteredEmails = useMemo(() => {
    let result = allEmails;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Apply category filter
    if (activeFilter !== 'inbox') {
      result = result.filter(email => {
        const senderEmail = extractEmailAddress(email.from);
        const toEmail = extractEmailAddress(email.to || '');
        
        const isExternal = crmEmails.some(crmEmail => {
          const crmLower = crmEmail.toLowerCase().trim();
          return senderEmail === crmLower || toEmail === crmLower;
        });
        
        if (activeFilter === 'external') return isExternal;
        if (activeFilter === 'internal') return !isExternal;
        if (activeFilter === 'followup') {
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
  }, [allEmails, crmEmails, activeFilter, searchQuery, allLeads]);

  // Find matching lead for an email
  const findLeadForEmail = (email: Email) => {
    const senderEmail = extractEmailAddress(email.from);
    return allLeads.find(lead => {
      if (lead.email?.toLowerCase() === senderEmail) return true;
      if (lead.lead_emails?.some((e: any) => e.email?.toLowerCase() === senderEmail)) return true;
      return false;
    });
  };

  // Generate next step suggestion based on stage and email context
  const getNextStepSuggestion = (stageName: string | undefined, emailSnippet: string, lead: any): string => {
    const snippet = emailSnippet.toLowerCase();
    
    // Check for specific keywords in the email
    if (snippet.includes('document') || snippet.includes('appraisal') || snippet.includes('attached')) {
      return 'Review attached documents and update deal status';
    }
    if (snippet.includes('question') || snippet.includes('clarif')) {
      return 'Address borrower questions and provide clarification';
    }
    if (snippet.includes('urgent') || snippet.includes('asap')) {
      return 'Prioritize response - time-sensitive request';
    }
    if (snippet.includes('term sheet') || snippet.includes('terms')) {
      return 'Review and discuss term sheet with borrower';
    }
    if (snippet.includes('follow') || snippet.includes('status') || snippet.includes('update')) {
      return 'Send status update and outline next milestones';
    }
    
    // Stage-based default suggestions
    switch (stageName) {
      case 'Discovery':
        return 'Schedule discovery call to understand borrower needs';
      case 'Pre-Qualification':
        return 'Gather preliminary financials for pre-qual assessment';
      case 'Doc Collection':
        return 'Request outstanding documents for underwriting package';
      case 'Underwriting':
        return 'Follow up with lender on underwriting status';
      case 'Approval':
        return 'Coordinate closing timeline and final conditions';
      case 'Funded':
        return 'Confirm funding details and send thank you note';
      default:
        return 'Review email and determine appropriate next action';
    }
  };

  // Check if email is external (from CRM lead)
  const isExternalEmail = (email: Email) => {
    const senderEmail = extractEmailAddress(email.from);
    return crmEmails.some(crmEmail => senderEmail === crmEmail.toLowerCase());
  };

  // Generate AI draft for moving deal forward
  const handleMoveForward = async (email: Email) => {
    const lead = findLeadForEmail(email);
    if (!lead) {
      toast.error('Could not find matching lead');
      return;
    }

    setGeneratingDraftForId(email.id);
    
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

      const { subject, body } = await aiResponse.json();
      
      // Open compose dialog with generated content
      setComposeTo(extractEmailAddress(email.from));
      setComposeSubject(subject || `Re: ${email.subject}`);
      setComposeBody(body || '');
      setComposeOpen(true);
      
    } catch (error: any) {
      console.error('Error generating email:', error);
      // Fallback to basic template
      const lead = findLeadForEmail(email);
      const firstName = lead?.name?.split(' ')[0] || extractSenderName(email.from).split(' ')[0];
      
      setComposeTo(extractEmailAddress(email.from));
      setComposeSubject(`Re: ${email.subject}`);
      setComposeBody(`Hi ${firstName},\n\nThank you for your message. I wanted to follow up and discuss the next steps for moving your loan application forward.\n\nPlease let me know a good time to connect this week.\n\nBest regards,\nEvan`);
      setComposeOpen(true);
    } finally {
      setGeneratingDraftForId(null);
    }
  };

  // Send email
  const handleSendEmail = async (attachments: Attachment[]) => {
    setComposeSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            body: composeBody,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send email');
      
      toast.success('Email sent successfully');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (error: any) {
      toast.error('Failed to send: ' + error.message);
    } finally {
      setComposeSending(false);
    }
  };

  // Connect Gmail
  const handleConnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      const redirectUri = `${window.location.origin}/admin/inbox/callback`;
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=get-oauth-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ redirect_uri: redirectUri }),
        }
      );

      const data = await response.json();
      if (data?.url) {
        localStorage.setItem('gmail_return_path', '/team/evan/gmail');
        window.location.href = data.url;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (error: any) {
      toast.error('Failed to connect: ' + error.message);
    }
  };

  // Loading
  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Not connected
  if (!gmailConnection) {
    return (
      <AdminLayout>
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
      </AdminLayout>
    );
  }

  const selectedEmail = filteredEmails.find(e => e.id === selectedEmailId);
  const selectedLead = selectedEmail ? findLeadForEmail(selectedEmail) : null;

  const filterLabels: Record<FilterType, string> = {
    inbox: 'Inbox',
    external: 'External',
    internal: 'Internal',
    followup: '7 Day Follow Up',
    templates: 'Templates',
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background">
        {/* Top Header with Compose, Filter, and Search */}
        <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
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
          <Button 
            className="gap-2"
            onClick={() => {
              setComposeTo('');
              setComposeSubject('');
              setComposeBody('');
              setComposeOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Compose
          </Button>
          
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[140px] justify-between">
                <span className="flex items-center gap-2">
                  {activeFilter === 'inbox' && <Inbox className="w-4 h-4" />}
                  {activeFilter === 'external' && <Building className="w-4 h-4" />}
                  {activeFilter === 'internal' && <Users className="w-4 h-4" />}
                  {activeFilter === 'followup' && <CalendarClock className="w-4 h-4" />}
                  {activeFilter === 'templates' && <FileText className="w-4 h-4" />}
                  {filterLabels[activeFilter]}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuItem onClick={() => { setActiveFilter('inbox'); setSelectedEmailId(null); }}>
                <Inbox className="w-4 h-4 mr-2" />
                Inbox
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Building className="w-4 h-4 mr-2" />
                  External
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[160px]">
                  <DropdownMenuItem onClick={() => { setActiveFilter('external'); setSelectedEmailId(null); }}>
                    <Building className="w-4 h-4 mr-2" />
                    All External
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/team/evan/email-templates')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Templates
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => { setActiveFilter('internal'); setSelectedEmailId(null); }}>
                <Users className="w-4 h-4 mr-2" />
                Internal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveFilter('followup'); setSelectedEmailId(null); }}>
                <CalendarClock className="w-4 h-4 mr-2" />
                7 Day Follow Up
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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
                <div className="p-3 border-b flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedEmailId(null); setShowDealSidebar(false); }}>
                    ← Back
                  </Button>
                  {/* Toggle Deal Sidebar button - only for external leads */}
                  {selectedLead && isExternalEmail(selectedEmail) && (
                    <Button
                      variant={showDealSidebar ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowDealSidebar(!showDealSidebar)}
                      className="gap-2"
                    >
                      <User className="w-4 h-4" />
                      {showDealSidebar ? 'Hide Lead Info' : 'Show Lead Info'}
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <h1 className="text-xl font-semibold mb-4 leading-tight">{selectedEmail.subject}</h1>
                    <div className="flex items-center gap-3 mb-6">
                      <Avatar className="w-10 h-10 border">
                        {selectedEmail.senderPhoto ? (
                          <AvatarImage src={selectedEmail.senderPhoto} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {extractSenderName(selectedEmail.from).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">{extractSenderName(selectedEmail.from)}</p>
                          <ChevronDown 
                            className={`w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-transform ${showEmailAddress ? 'rotate-180' : ''}`}
                            onClick={() => setShowEmailAddress(!showEmailAddress)}
                          />
                        </div>
                        {showEmailAddress && (
                          <p className="text-xs text-muted-foreground">{selectedEmail.from}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{selectedEmail.snippet}</p>
                  </div>
                </ScrollArea>
              </div>
              
              {/* Deal Summary Sidebar for External Leads - Only shown when toggled */}
              {showDealSidebar && selectedLead && isExternalEmail(selectedEmail) && (
                <div className="w-80 border-l bg-white overflow-y-auto">
                  {/* Header with expand button */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Stage</p>
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedLead.pipeline_leads?.[0]?.pipeline_stages?.color || '#0066FF' }}
                          />
                          <span className="text-sm font-medium">
                            {selectedLead.pipeline_leads?.[0]?.pipeline_stages?.name || 'Discovery'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Assigned To</p>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 bg-emerald-600">
                            <AvatarFallback className="text-xs text-white bg-emerald-600">E</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">Evan</span>
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
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm text-slate-700">Contact Info</span>
                        </div>
                        <div className="space-y-3 pl-6">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Contact Name</p>
                            <p className="text-sm text-slate-900 font-medium">{selectedLead.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Known As</p>
                            <p className="text-sm text-slate-500">{selectedLead.known_as || 'Nickname or alias'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Company</p>
                            <p className="text-sm text-slate-900">{selectedLead.company_name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Title</p>
                            <p className="text-sm text-slate-500">{selectedLead.title || 'Job title'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Contact Type</p>
                            <p className="text-sm text-slate-900 capitalize">
                              {(selectedLead.contact_type || 'potential_customer').replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Contacts Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm text-slate-700">Contacts</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {selectedLead.lead_contacts?.length || 0}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {(!selectedLead.lead_contacts || selectedLead.lead_contacts.length === 0) ? (
                            <p className="text-sm text-slate-400 italic">No contacts added yet</p>
                          ) : (
                            selectedLead.lead_contacts.map((contact: any) => (
                              <div key={contact.id} className="py-2 border-b border-slate-100 last:border-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                                  {contact.is_primary && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
                                  )}
                                </div>
                                {contact.title && (
                                  <p className="text-xs text-slate-500">{contact.title}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-1">
                                  {contact.email && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <Mail className="w-3 h-3" />
                                      <span>{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <Phone className="w-3 h-3" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                          <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                            <Plus className="w-4 h-4 mr-1" />
                            Add contact
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Phone Numbers Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm text-slate-700">Phone Numbers</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {(selectedLead.lead_phones?.length || 0) + (selectedLead.phone && !selectedLead.lead_phones?.length ? 1 : 0)}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                            <div className="py-1">
                              <p className="text-sm text-slate-900">{selectedLead.phone}</p>
                              <p className="text-xs text-slate-400">Primary</p>
                            </div>
                          )}
                          {selectedLead.lead_phones?.map((phone: any) => (
                            <div key={phone.id} className="py-1">
                              <p className="text-sm text-slate-900">{phone.phone_number}</p>
                              <p className="text-xs text-slate-400 capitalize">{phone.phone_type || 'Primary'}</p>
                            </div>
                          ))}
                          {!selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                            <p className="text-sm text-slate-400 italic">No phone numbers</p>
                          )}
                          <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                            <Plus className="w-4 h-4 mr-1" />
                            Add phone
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Email Addresses Section */}
                      <div className="py-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm text-slate-700">Email Addresses</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {(selectedLead.lead_emails?.length || 0) + (selectedLead.email && !selectedLead.lead_emails?.length ? 1 : 0)}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                            <div className="py-1">
                              <p className="text-sm text-slate-900">{selectedLead.email}</p>
                              <p className="text-xs text-slate-400">Primary</p>
                            </div>
                          )}
                          {selectedLead.lead_emails?.map((email: any) => (
                            <div key={email.id} className="py-1">
                              <p className="text-sm text-slate-900">{email.email}</p>
                              <p className="text-xs text-slate-400 capitalize">{email.email_type || 'Primary'}</p>
                            </div>
                          ))}
                          {!selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                            <p className="text-sm text-slate-400 italic">No email addresses</p>
                          )}
                          <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
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
                          <p className="text-xs font-semibold text-slate-400 tracking-wider mb-2">NOTES</p>
                          <p className="text-sm text-slate-600 leading-relaxed">{selectedLead.notes}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : activeFilter === 'templates' ? (
            // Templates View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
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
                        setComposeBody(template.body);
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
                    {filteredEmails.map((email) => {
                      const isExternal = isExternalEmail(email);
                      const lead = findLeadForEmail(email);
                      const stageName = lead?.pipeline_leads?.[0]?.pipeline_stages?.name;
                      const stageColor = lead?.pipeline_leads?.[0]?.pipeline_stages?.color;
                      
                      return (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmailId(email.id)}
                          className={`border-b cursor-pointer hover:bg-muted/50 ${
                            !email.isRead ? 'bg-primary/5' : ''
                          } ${isExternal ? 'py-5 px-4' : 'p-3'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className={isExternal ? 'w-8 h-8' : 'w-6 h-6'}>
                              {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                              <AvatarFallback className={isExternal ? 'text-sm' : 'text-xs'}>
                                {extractSenderName(email.from).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`truncate flex-1 ${!email.isRead ? 'font-semibold' : ''} ${isExternal ? 'text-base' : 'text-sm'}`}>
                              {extractSenderName(email.from)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(email.date), 'MMM d')}
                            </span>
                          </div>
                          <div className={`flex items-center gap-2 ${isExternal ? 'mb-1' : ''}`}>
                            <p className={`truncate flex-1 ${!email.isRead ? 'font-medium' : ''} ${isExternal ? 'text-base' : 'text-sm'}`}>
                              {email.subject}
                            </p>
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
                          </div>
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
                                <ArrowDown className="w-3 h-3 flex-shrink-0" />
                                <span className="italic">
                                  {getNextStepSuggestion(stageName, email.snippet, lead)}
                                </span>
                              </div>
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

      {/* Compose Dialog */}
      <GmailComposeDialog
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        to={composeTo}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        sending={composeSending}
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
    </AdminLayout>
  );
};

export default EvansGmail;
