import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Inbox, Loader2, ChevronDown, Users, Building, ArrowRight, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GmailComposeDialog, { Attachment } from '@/components/admin/GmailComposeDialog';

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

type FilterType = 'inbox' | 'external' | 'internal';

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
  const { user } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('inbox');
  
  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [generatingDraftForId, setGeneratingDraftForId] = useState<string | null>(null);

  // Check Gmail connection
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
          lead_emails(email),
          lead_phones(phone_number, phone_type),
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

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

  // Filter emails based on CRM classification
  const filteredEmails = useMemo(() => {
    if (activeFilter === 'inbox') return allEmails;
    
    return allEmails.filter(email => {
      const senderEmail = extractEmailAddress(email.from);
      const toEmail = extractEmailAddress(email.to || '');
      
      const isExternal = crmEmails.some(crmEmail => {
        const crmLower = crmEmail.toLowerCase().trim();
        return senderEmail === crmLower || toEmail === crmLower;
      });
      
      if (activeFilter === 'external') return isExternal;
      if (activeFilter === 'internal') return !isExternal;
      return true;
    });
  }, [allEmails, crmEmails, activeFilter]);

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
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="w-48 border-r bg-muted/30 p-3 space-y-1">
          <div 
            onClick={() => { setActiveFilter('inbox'); setSelectedEmailId(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
              activeFilter === 'inbox' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Inbox
          </div>
          <div 
            onClick={() => { setActiveFilter('external'); setSelectedEmailId(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
              activeFilter === 'external' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Building className="w-4 h-4" />
            External
          </div>
          <div 
            onClick={() => { setActiveFilter('internal'); setSelectedEmailId(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
              activeFilter === 'internal' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            Internal
          </div>
        </div>

        {/* Email List / Email View */}
        <div className="flex-1 overflow-hidden">
          {selectedEmailId && selectedEmail ? (
            // Full Email View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmailId(null)}>
                  ← Back
                </Button>
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
                    {selectedLead && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lead</p>
                        <p className="text-sm font-medium">{selectedLead.name}</p>
                        {selectedLead.pipeline_leads?.[0]?.pipeline_stages?.name && (
                          <p className="text-xs text-muted-foreground">
                            {selectedLead.pipeline_leads[0].pipeline_stages.name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{selectedEmail.snippet}</p>
                </div>
              </ScrollArea>
            </div>
          ) : (
            // Email List View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
                <h2 className="font-semibold text-sm">{filterLabels[activeFilter]}</h2>
              </div>
              <ScrollArea className="flex-1">
                {emailsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No emails
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
                          <p className={`truncate ${!email.isRead ? 'font-medium' : ''} ${isExternal ? 'text-base mb-1' : 'text-sm'}`}>
                            {email.subject}
                          </p>
                          <p className={`text-muted-foreground mt-0.5 ${isExternal ? 'text-sm line-clamp-2' : 'text-xs truncate'}`}>
                            {email.snippet}
                          </p>
                          {isExternal && (
                            <div className="mt-2">
                              <div className="flex items-center gap-3">
                                <Button 
                                  size="sm"
                                  className="bg-[#0066FF] hover:bg-[#0052CC] text-white"
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
                                {stageName && (
                                  <span 
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ 
                                      backgroundColor: stageColor ? `${stageColor}20` : 'hsl(var(--muted))',
                                      color: stageColor || 'hsl(var(--muted-foreground))'
                                    }}
                                  >
                                    {stageName}
                                  </span>
                                )}
                              </div>
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
    </AdminLayout>
  );
};

export default EvansGmail;
