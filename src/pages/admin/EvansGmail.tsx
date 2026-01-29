import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Inbox, Loader2, ChevronDown, Users, Building, ArrowRight, ArrowDown, Phone, Tag, Clock, FileText, BarChart3, User, Plus, Maximize2, Search, X, CalendarClock, RefreshCw, Check, MoreHorizontal, MailOpen, ListTodo, MessageSquare, Star } from 'lucide-react';
import { GmailTaskDialog } from '@/components/admin/GmailTaskDialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import GmailComposeDialog, { Attachment } from '@/components/admin/GmailComposeDialog';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { GmailSidebar, FolderType } from '@/components/admin/inbox/GmailSidebar';
import { cn } from '@/lib/utils';

// Import avatar images
import robertMartinezAvatar from '@/assets/avatars/robert-martinez.jpg';
import sarahRichardsonAvatar from '@/assets/avatars/sarah-richardson.jpg';
import michaelChenAvatar from '@/assets/avatars/michael-chen.jpg';
import davidKimAvatar from '@/assets/avatars/david-kim.jpg';
import lisaWongAvatar from '@/assets/avatars/lisa-wong.jpg';
import thomasWrightAvatar from '@/assets/avatars/thomas-wright.jpg';
import rachelAdamsAvatar from '@/assets/avatars/rachel-adams.jpg';
import sophiaLaurentAvatar from '@/assets/avatars/sophia-laurent.jpg';
import andrewFosterAvatar from '@/assets/avatars/andrew-foster.jpg';
import emilyWangAvatar from '@/assets/avatars/emily-wang.jpg';

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  senderPhoto?: string | null;
}

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

// Mock thread messages for Robert Martinez conversation
interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  body: string;
  senderPhoto?: string | null;
}

const mockThreadMessages: Record<string, ThreadMessage[]> = {
  'thread-mock-1': [
    {
      id: 'msg-1-1',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
      body: `Hi Robert,

Thank you for reaching out about financing for your acquisition. I'm excited to discuss the $2.5M loan opportunity for Capital Ventures.

Based on our initial conversation, it sounds like you're looking to acquire a commercial property in the downtown district. Before we proceed, I wanted to gather some additional information to ensure we can structure the best possible deal for your needs.

Could you please provide the following:

1. Property address and current appraisal (if available)
2. Your most recent 2 years of business tax returns
3. Personal financial statement
4. Executive summary of the acquisition opportunity

Once I have these documents, I can start working with our lending partners to get you pre-qualified. Given current market conditions, we're seeing rates in the 7.25-7.75% range for deals of this size with strong borrower profiles.

I'm available for a call this week if you'd like to discuss the process in more detail. My calendar is open Tuesday and Thursday afternoons.

Looking forward to working together on this.

Best regards,
Evan
Commercial Lending X
(555) 123-4567`,
      senderPhoto: null,
    },
    {
      id: 'msg-1-2',
      from: 'Robert Martinez <robert.martinez@capitalventures.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
      body: `Evan,

Thanks for the quick response. Capital Ventures has been working on this acquisition for the past 6 months and we're finally in a position to move forward.

I've attached the documents you requested:
- Property appraisal (completed last month) showing a value of $3.2M
- 2024 and 2023 business tax returns
- My personal financial statement
- A detailed executive summary of our expansion plans

A few additional details about the deal:

The property is located at 4500 Commerce Boulevard, which is in a prime commercial corridor. The building is currently 85% occupied with stable tenants, including a regional bank branch and a medical office that have both been there for 10+ years.

We're planning to acquire the property and then invest an additional $500K in renovations to modernize the facade and upgrade the HVAC systems. This should allow us to increase rents by approximately 15% when current leases expire.

Our target closing date is March 15th, so we're on a somewhat tight timeline. Is that feasible from your perspective?

I'm free for a call Thursday at 2 PM if that works for you. Please let me know.

Thanks,
Robert Martinez
CEO, Capital Ventures LLC
(555) 987-6543`,
      senderPhoto: robertMartinezAvatar,
    },
    {
      id: 'msg-1-3',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4 days ago
      body: `Robert,

Excellent - I've reviewed all the documents you sent and I'm impressed with the quality of this acquisition opportunity. The property fundamentals look strong and your business financials are well-organized.

A few initial observations:

1. The 80% LTV you're targeting ($2.5M on a $3.2M property) is within our comfort zone for this asset class
2. Your debt service coverage ratio looks healthy based on the current NOI
3. The tenant mix with long-term occupants is exactly what lenders like to see

I spoke with three of our lending partners this morning and have some promising initial feedback:

LENDER A (Regional Bank):
- Rate: 7.35% fixed for 5 years
- Amortization: 25 years
- Prepayment: 3-2-1 step-down
- Timeline: 45 days to close

LENDER B (Credit Union):
- Rate: 7.15% fixed for 7 years
- Amortization: 25 years
- Prepayment: Yield maintenance for 3 years, then 1%
- Timeline: 60 days to close

LENDER C (Private Lender):
- Rate: 8.25% fixed
- Amortization: 30 years
- Prepayment: None after 12 months
- Timeline: 21 days to close

Given your March 15th target, Lender A seems like the best fit - competitive rate with a realistic timeline. Lender B has a slightly better rate but the 60-day timeline cuts it close.

Thursday at 2 PM works perfectly. I'll send a calendar invite. We can review these options in detail and discuss which structure works best for Capital Ventures.

Talk soon,
Evan`,
      senderPhoto: null,
    },
    {
      id: 'msg-1-4',
      from: 'Robert Martinez <robert.martinez@capitalventures.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      body: `Evan,

Great call yesterday! I really appreciated you walking me through all the options in detail. After discussing with my partners, we've decided to move forward with Lender A.

The 7.35% rate with the 5-year fixed term aligns well with our business plan. We're planning to hold this property for at least 7-10 years, so we'll likely refinance when the fixed period ends anyway. The 45-day timeline also gives us a comfortable buffer before our target closing date.

A couple of follow-up items from our discussion:

1. You mentioned that Lender A might be able to include the renovation costs in the loan. Can you confirm if that's possible? We'd love to finance the full $3M ($2.5M acquisition + $500K renovation) if the numbers work.

2. For the renovation draws, what documentation would we need to provide? We have a general contractor lined up but haven't finalized the scope of work yet.

3. Is there any flexibility on the prepayment penalty? The 3-2-1 structure works, but if we could get it waived entirely after year 3, that would be ideal.

Also, I wanted to mention that we have another acquisition opportunity in the pipeline - a retail strip center about 2 miles from this property. It's a smaller deal ($1.8M) but similar quality tenants. Once we close this first deal, I'd love to discuss financing options for that one as well.

Let me know what you need from me to get the formal application submitted.

Thanks,
Robert`,
      senderPhoto: robertMartinezAvatar,
    },
    {
      id: 'msg-1-5',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      body: `Robert,

Great news on all fronts! I'm excited to get this deal across the finish line for you.

Regarding your questions:

1. RENOVATION FINANCING: Yes, Lender A can absolutely include the renovation costs. They offer a "purchase plus improvement" loan structure. The total loan would be $3M with the renovation portion held in escrow and released in draws as work is completed. This will require a detailed scope of work and contractor bids before closing, but it's very doable.

2. RENOVATION DRAWS: You'll need to provide:
   - Signed contractor agreement with detailed line-item budget
   - Contractor's license and insurance certificates  
   - Draw schedule (typically 3-4 draws for a project this size)
   - Lender will do inspections before each draw release

3. PREPAYMENT: I pushed back on this with my contact at Lender A. Best they can do is 3-2-1-0, meaning no penalty in year 4 or later. Given that you're planning to hold long-term, this should work well.

For the formal application, please send me:
- Signed LOI or purchase agreement for the property
- Updated rent roll (dated within 30 days)
- 3 months of property operating statements
- Phase I environmental (if you have one; if not, lender can order)
- Your operating agreement for Capital Ventures LLC

Once I have these, I'll submit to Lender A and we should have an approval within 5-7 business days.

And definitely let's talk about the retail strip center! Send me the details when you're ready - address, asking price, current occupancy, and rent roll. If the quality is similar to this deal, I'm confident we can get it done.

Let me know if you have any questions. We're on track for a smooth closing!

Best,
Evan
Commercial Lending X`,
      senderPhoto: null,
    },
  ],
};

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
    isRead: false,
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
    isRead: false,
    senderPhoto: davidKimAvatar,
  },
  {
    id: 'mock-5',
    threadId: 'thread-mock-5',
    subject: 'Healthcare Facility Refinance Question',
    from: 'Lisa Wong <lisa@pacificmedgroup.com>',
    to: 'evan@commerciallendingx.com',
    date: '2026-01-10T11:45:00.000Z', // Jan 10
    snippet: 'Our current loan matures in 6 months and we are exploring refinance options. The facility is valued at $8.2M...',
    isRead: false,
    senderPhoto: lisaWongAvatar,
  },
  {
    id: 'mock-6',
    threadId: 'thread-mock-6',
    subject: 'Manufacturing Equipment Loan Application',
    from: 'Thomas Wright <twright@wrightmanufacturing.com>',
    to: 'evan@commerciallendingx.com',
    date: '2026-01-10T16:20:00.000Z', // Jan 10
    snippet: 'Following up on our call about equipment financing. We need approximately $1.8M for new CNC machines and automation...',
    isRead: false,
    senderPhoto: thomasWrightAvatar,
  },
  {
    id: 'mock-7',
    threadId: 'thread-mock-7',
    subject: 'Senior Living Facility Acquisition',
    from: 'Rachel Adams <rachel@sunriseseniorliving.com>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    snippet: 'Great news - the seller accepted our offer! Now we need to move quickly on the financing. The purchase price is $12.5M...',
    isRead: false,
    senderPhoto: rachelAdamsAvatar,
  },
  {
    id: 'mock-8',
    threadId: 'thread-mock-8',
    subject: 'Boutique Hotel Expansion Plans',
    from: 'Sophia Laurent <sophia@luxestays.co>',
    to: 'evan@commerciallendingx.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    snippet: 'We are looking to add 40 more rooms to our property in Napa. I have attached our revenue projections and construction estimates...',
    isRead: false,
    senderPhoto: sophiaLaurentAvatar,
  },
  {
    id: 'mock-9',
    threadId: 'thread-mock-9',
    subject: 'Commercial Property Portfolio Review',
    from: 'Andrew Foster <afoster@greenleafprops.com>',
    to: 'evan@commerciallendingx.com',
    date: '2026-01-10T14:30:00.000Z', // Jan 10
    snippet: 'Can we schedule a call to review our portfolio? We have 5 properties that may need refinancing before year end...',
    isRead: false,
    senderPhoto: andrewFosterAvatar,
  },
  {
    id: 'mock-10',
    threadId: 'thread-mock-10',
    subject: 'Healthcare Expansion Financing Inquiry',
    from: 'Emily Wang <ewang@sunrisehealthcare.com>',
    to: 'evan@commerciallendingx.com',
    date: '2026-01-10T09:15:00.000Z', // Jan 10
    snippet: 'Sunrise Healthcare is planning to open a new urgent care center. We are looking at properties in the $3-4M range...',
    isRead: false,
    senderPhoto: emilyWangAvatar,
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

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Lightweight sanitization: strip scripts/iframes, inline event handlers,
// and inline color styles so dark mode prose-invert can apply proper contrast.
const sanitizeEmailHtml = (html: string) => {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'")
    // Strip inline color styles so dark mode text colors work
    .replace(/\bcolor\s*:\s*[^;}"']+;?/gi, '')
    .replace(/\bbackground-color\s*:\s*[^;}"']+;?/gi, '')
    .replace(/\bbackground\s*:\s*[^;}"']+;?/gi, '');
};

const toRenderableHtml = (value: string) => {
  const v = value ?? '';
  if (!v.trim()) return '';
  if (looksLikeHtml(v)) return sanitizeEmailHtml(v);
  return escapeHtml(v).replace(/\r\n/g, '\n').replace(/\n/g, '<br />');
};

const EvansGmail = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [readEmailIds, setReadEmailIds] = useState<Record<string, boolean>>({});
  
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
  const [currentPage, setCurrentPage] = useState(1);
  const EMAILS_PER_PAGE = 50;
  // Task creation dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskInitialTitle, setTaskInitialTitle] = useState('');
  const [taskInitialDescription, setTaskInitialDescription] = useState('');
  const [taskInitialLeadId, setTaskInitialLeadId] = useState<string | null>(null);
  
  // Move Forward flow tracking
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentLeadIdForEmail, setCurrentLeadIdForEmail] = useState<string | null>(null);
  const [currentBodyPlain, setCurrentBodyPlain] = useState<string>('');
  const [currentBodyHtml, setCurrentBodyHtml] = useState<string>('');

  // URL params compose handling moved below allLeads query to avoid reference before declaration

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
  };

  // Mark email as unread
  const handleMarkUnread = (emailId: string) => {
    setReadEmailIds(prev => {
      const newState = { ...prev };
      delete newState[emailId];
      return newState;
    });
  };
  
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

  // Handle URL params to open compose dialog from dashboard nudges or tasks
  useEffect(() => {
    const compose = searchParams.get('compose');
    const to = searchParams.get('to');
    const draftId = searchParams.get('draftId');
    const leadId = searchParams.get('leadId');
    const template = searchParams.get('template');
    
    if (compose === 'draft' && draftId) {
      // Draft was already created - switch to Drafts folder to show it
      setActiveFolder('drafts');
      toast.success('Draft created! Check your Drafts folder.');
      // Clear the URL params to prevent reopening on refresh
      setSearchParams({});
    } else if (compose === 'new' && to) {
      // Open compose dialog for a new email
      setComposeTo(decodeURIComponent(to));
      setComposeSubject('');
      setComposeBody('');
      setComposeOpen(true);
      setSearchParams({});
    } else if (compose === 'true') {
      // Open compose dialog with optional lead and template context
      let recipientEmail = '';
      let subject = '';
      let body = '';
      
      // If leadId is provided, find the lead and pre-fill recipient
      if (leadId && allLeads.length > 0) {
        const lead = allLeads.find((l: any) => l.id === leadId);
        if (lead) {
          recipientEmail = lead.email || '';
          
          // Check for template type and pre-fill accordingly
          if (template === 'closing') {
            subject = `Closing Documents - ${lead.company_name || lead.name}`;
            body = `Hi ${lead.name?.split(' ')[0] || 'there'},

Congratulations! We're approaching the closing stage for your financing. Please find attached the closing documents that require your signature.

Please review the following documents carefully:
1. Loan Agreement
2. Promissory Note
3. Security Agreement
4. Personal Guarantee (if applicable)

Once you've reviewed everything, please sign where indicated and return the documents at your earliest convenience. If you have any questions or need clarification on any terms, don't hesitate to reach out.

Looking forward to completing this transaction with you.

Best regards,
Evan
Commercial Lending X`;
          } else if (template === 'follow_up') {
            subject = `Following Up - ${lead.company_name || lead.name}`;
            body = `Hi ${lead.name?.split(' ')[0] || 'there'},

I wanted to check in and see how things are progressing on your end. It's been a little while since we last connected, and I wanted to make sure you have everything you need.

If there's anything I can help with or if you have any questions about the process, please don't hesitate to reach out.

Looking forward to hearing from you.

Best regards,
Evan
Commercial Lending X`;
          }
        }
      } else if (template === 'closing') {
        // Template without specific lead
        subject = 'Closing Documents';
        body = `Hi,

Congratulations! We're approaching the closing stage for your financing. Please find attached the closing documents that require your signature.

Please review the documents carefully and sign where indicated. If you have any questions, please reach out.

Best regards,
Evan
Commercial Lending X`;
      } else if (template === 'follow_up') {
        subject = 'Following Up';
        body = `Hi,

I wanted to check in and see how things are progressing. Please let me know if there's anything I can help with.

Best regards,
Evan
Commercial Lending X`;
      }
      
      setComposeTo(recipientEmail);
      setComposeSubject(subject);
      setComposeBody(body);
      setComposeOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, allLeads]);

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

  // Fetch inbox emails
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
        body: msg.body || '',
        isRead: !msg.isUnread,
        senderPhoto: msg.senderPhoto || null,
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

  // Fetch sent emails separately (only emails sent by Evan)
  const { data: sentEmails = [], isLoading: sentEmailsLoading } = useQuery({
    queryKey: ['evan-gmail-sent-emails'],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        console.error('Session refresh failed:', sessionError);
        return [];
      }

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=in:sent&maxResults=50&fetchPhotos=true`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch sent emails');

      return (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        to: msg.to || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        body: msg.body || '',
        isRead: !msg.isUnread,
        senderPhoto: msg.senderPhoto || null,
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

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
      // For now, show empty drafts (would be connected to Gmail drafts API)
      result = [];
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
  }, [allEmails, crmEmails, activeFolder, searchQuery, allLeads, sentEmails]);

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
      drafts: 0, // Would be fetched from Gmail API
      external: externalCount,
      internal: internalCount,
      followup: followupCount,
    };
  }, [allEmails, crmEmails, allLeads, readEmailIds]);

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

// Generate AI draft for moving deal forward - with persist-first pattern
  const handleMoveForward = async (email: Email) => {
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
      setComposeBody(bodyHtml); // Use HTML so it renders correctly
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
      setComposeBody(fallbackHtml);
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
    });
    
    // HARD FAIL: Block if body is empty
    if (!bodySend || bodySend.trim() === '') {
      console.error(`[${flowId}] HARD FAIL - Body is empty!`);
      toast.error(`Move Forward failed: email body was empty. See flow_id: ${flowId}`);
      setComposeSending(false);
      return;
    }
    
    // Clear form immediately
    setComposeOpen(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    
    // Show sending toast
    const toastId = toast.loading('Sending email...');
    
    try {
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Log the exact payload being sent to the edge function
      const payload = {
        to: toSend,
        subject: subjectSend,
        body: bodySend,
        bodyPlain: bodyPlainSend,
        flowId,
        attachments: attachmentsSend,
      };
      
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

  return (
    <AdminLayout>
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
            setComposeBody('');
            setComposeOpen(true);
          }}
          counts={folderCounts}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header with Search and Refresh */}
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
                    <h1 className="text-xl font-semibold mb-6 leading-tight">{selectedEmail.subject}</h1>
                    
                    {/* Thread Messages */}
                    {mockThreadMessages[selectedEmail.threadId] ? (
                      <div className="space-y-6">
                        {mockThreadMessages[selectedEmail.threadId].map((msg, index) => {
                          const isFromEvan = msg.from.toLowerCase().includes('evan');
                          return (
                            <div key={msg.id} className="relative">
                              {/* Connector line between messages */}
                              {index < mockThreadMessages[selectedEmail.threadId].length - 1 && (
                                <div className="absolute left-5 top-12 bottom-0 w-px bg-border" style={{ height: 'calc(100% + 1.5rem)' }} />
                              )}
                              <div className={cn(
                                "rounded-lg border p-4",
                                isFromEvan ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : "bg-background"
                              )}>
                                <div className="flex items-start gap-3 mb-4">
                                  <Avatar className="w-10 h-10 border flex-shrink-0">
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
                                <div className="text-sm whitespace-pre-wrap leading-relaxed pl-[52px]">
                                  {msg.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Fallback for emails without thread messages
                      <>
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
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: toRenderableHtml(
                              (selectedEmail.body && selectedEmail.body.trim())
                                ? selectedEmail.body
                                : selectedEmail.snippet
                            ),
                          }}
                        />
                      </>
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
                          className={`border-b cursor-pointer transition-colors ${
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
      
      {/* Task Creation Dialog */}
      <GmailTaskDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        initialTitle={taskInitialTitle}
        initialDescription={taskInitialDescription}
        initialLeadId={taskInitialLeadId}
      />
    </AdminLayout>
  );
};

export default EvansGmail;
