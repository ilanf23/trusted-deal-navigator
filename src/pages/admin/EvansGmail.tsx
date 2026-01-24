import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { useEmailThreads } from '@/hooks/useEmailThreads';
import { 
  Mail, 
  Send, 
  Loader2, 
  RefreshCw,
  ArrowLeft,
  Trash2,
  Reply,
  Forward,
  Search,
  Pencil,
  Filter,
  ArrowUpDown,
  Paperclip,
  AlertTriangle,
  Clock,
  Phone,
  Tag,
  Building2,
  ChevronRight,
  Star,
  MoreHorizontal,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isYesterday, differenceInDays, subDays, formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';

// ========== TYPES ==========

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  attachments?: { name: string; type: string }[];
  senderPhoto?: string | null;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  updated_at: string;
  source?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  title?: string | null;
}

// ========== CONSTANTS ==========

const STAGE_CONFIG: Record<string, { label: string; color: string; shortLabel: string }> = {
  discovery: { label: 'Step 1: Discovery', color: '#3B82F6', shortLabel: 'Step 1' },
  questionnaire: { label: 'Step 2: Questionnaire', color: '#8B5CF6', shortLabel: 'Step 2' },
  pre_qualification: { label: 'Step 3: Pre-Qual', color: '#6366F1', shortLabel: 'Step 3' },
  document_collection: { label: 'Step 4: Docs', color: '#F59E0B', shortLabel: 'Step 4' },
  underwriting: { label: 'Step 5: Underwriting', color: '#EF4444', shortLabel: 'Step 5' },
  approval: { label: 'Step 6: Approval', color: '#10B981', shortLabel: 'Step 6' },
  funded: { label: 'Funded', color: '#059669', shortLabel: 'Funded' },
};

const LOAN_TYPES = ['SBA', 'CRE', 'Equipment', 'Working Capital', 'Bridge', 'Construction'];

// ========== HELPERS ==========

const extractSenderName = (from: string) => {
  const match = from.match(/^([^<]+)/);
  if (match) return match[1].trim().replace(/"/g, '');
  return from.split('@')[0];
};

const extractEmailAddress = (value: string) => {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value || '').trim();
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNextTouch = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
  return format(date, 'EEE, h:mm a');
};

const isHtmlEmailContent = (content: string): boolean =>
  /<(?:div|table|span|p|br|img|a|td|tr|th|body|html|head|style)[^>]*>/i.test(content);

const formatEmailBody = (body: string): string => {
  if (!body) return '';
  if (isHtmlEmailContent(body)) return body;
  return body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" class="text-blue-600 hover:underline">$1</a>')
    .replace(/\n/g, '<br />');
};

// ========== COMPONENT ==========

const EvansGmail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [activeStage, setActiveStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'date' | 'amount'>('urgency');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  
  // Email threads hook
  const { threadMap, setWaitingOn: setThreadWaitingOn } = useEmailThreads();
  
  // Gmail connection
  const { data: gmailConnection, isLoading: connectionLoading } = useQuery({
    queryKey: ['gmail-connection'],
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
  
  // Fetch emails
  const { data: emailsData, isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['gmail-emails-deal-view'],
    queryFn: async () => {
      if (!gmailConnection) return { emails: [] };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { emails: [] };
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=in:inbox&maxResults=50&fetchPhotos=true`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch emails');
      
      return {
        emails: (data?.messages || []).map((msg: any) => ({
          id: msg.id,
          threadId: msg.threadId,
          subject: msg.subject || '(No Subject)',
          from: msg.from || '',
          to: msg.to || '',
          date: msg.date || new Date().toISOString(),
          snippet: msg.snippet || '',
          body: msg.body || '',
          isRead: !msg.isUnread,
          isStarred: msg.labelIds?.includes('STARRED') || false,
          labels: msg.labelIds || [],
          attachments: msg.attachments || [],
          senderPhoto: msg.senderPhoto || null,
        })) as Email[]
      };
    },
    enabled: !!gmailConnection,
  });
  
  // Fetch Evan's team member
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });
  
  const evanId = evanTeamMember?.id;
  
  // Fetch leads with full data
  const { data: allLeads = [] } = useQuery({
    queryKey: ['crm-leads-full', evanId],
    queryFn: async () => {
      if (!evanId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, company_name, status, updated_at, source, notes, tags, title')
        .eq('assigned_to', evanId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!evanId,
  });
  
  // Fetch lead responses for loan amounts
  const { data: leadResponses = [] } = useQuery({
    queryKey: ['lead-responses-for-inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_responses')
        .select('lead_id, loan_amount, loan_type, funding_purpose');
      if (error) throw error;
      return data || [];
    },
  });
  
  // Build lead response map
  const leadResponseMap = useMemo(() => {
    const map = new Map<string, { loanAmount?: number; loanType?: string; purpose?: string }>();
    leadResponses.forEach(r => {
      if (r.lead_id) {
        map.set(r.lead_id, {
          loanAmount: r.loan_amount || undefined,
          loanType: r.loan_type || undefined,
          purpose: r.funding_purpose || undefined,
        });
      }
    });
    return map;
  }, [leadResponses]);
  
  // Build email-to-lead map
  const emailToLeadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    allLeads.forEach(lead => {
      if (lead.email) {
        map.set(lead.email.toLowerCase().trim(), lead);
      }
    });
    return map;
  }, [allLeads]);
  
  // Find lead from email
  const findLeadFromEmail = (emailStr: string): Lead | null => {
    const extracted = extractEmailAddress(emailStr).toLowerCase().trim();
    return emailToLeadMap.get(extracted) || null;
  };
  
  // Build deal cards from emails + leads
  const dealCards = useMemo(() => {
    const emails = emailsData?.emails || [];
    const dealMap = new Map<string, {
      leadId: string;
      lead: Lead;
      emails: Email[];
      latestEmail: Email;
      loanAmount?: number;
      loanType?: string;
      purpose?: string;
      daysSinceActivity: number;
      isUrgent: boolean;
      nextAction?: string;
    }>();
    
    // Group emails by lead
    emails.forEach(email => {
      const lead = findLeadFromEmail(email.from) || findLeadFromEmail(email.to);
      if (!lead) return;
      
      const existing = dealMap.get(lead.id);
      const threadData = threadMap.get(email.threadId);
      const response = leadResponseMap.get(lead.id);
      const daysSince = differenceInDays(new Date(), new Date(email.date));
      
      if (existing) {
        existing.emails.push(email);
        if (new Date(email.date) > new Date(existing.latestEmail.date)) {
          existing.latestEmail = email;
          existing.daysSinceActivity = daysSince;
        }
      } else {
        dealMap.set(lead.id, {
          leadId: lead.id,
          lead,
          emails: [email],
          latestEmail: email,
          loanAmount: response?.loanAmount,
          loanType: response?.loanType,
          purpose: response?.purpose,
          daysSinceActivity: daysSince,
          isUrgent: daysSince > 3 || (threadData?.waiting_on && threadData.waiting_on !== 'none'),
          nextAction: threadData?.next_action || undefined,
        });
      }
    });
    
    return Array.from(dealMap.values());
  }, [emailsData?.emails, findLeadFromEmail, threadMap, leadResponseMap]);
  
  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    let deals = [...dealCards];
    
    // Filter by stage
    if (activeStage !== 'all') {
      deals = deals.filter(d => d.lead.status === activeStage);
    }
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      deals = deals.filter(d =>
        d.lead.name.toLowerCase().includes(q) ||
        d.lead.company_name?.toLowerCase().includes(q) ||
        d.latestEmail.subject.toLowerCase().includes(q)
      );
    }
    
    // Sort
    deals.sort((a, b) => {
      if (sortBy === 'urgency') {
        // Urgent first, then by days since activity
        if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
        return b.daysSinceActivity - a.daysSinceActivity;
      }
      if (sortBy === 'date') {
        return new Date(b.latestEmail.date).getTime() - new Date(a.latestEmail.date).getTime();
      }
      if (sortBy === 'amount') {
        return (b.loanAmount || 0) - (a.loanAmount || 0);
      }
      return 0;
    });
    
    return deals;
  }, [dealCards, activeStage, searchQuery, sortBy]);
  
  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dealCards.forEach(d => {
      counts[d.lead.status] = (counts[d.lead.status] || 0) + 1;
    });
    return counts;
  }, [dealCards]);
  
  // Selected deal
  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return dealCards.find(d => d.leadId === selectedDealId) || null;
  }, [selectedDealId, dealCards]);
  
  // Auto-select first deal
  useEffect(() => {
    if (!selectedDealId && filteredDeals.length > 0) {
      setSelectedDealId(filteredDeals[0].leadId);
    }
  }, [filteredDeals, selectedDealId]);
  
  // Connect Gmail handler
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
      toast.error('Failed to start Gmail connection: ' + error.message);
    }
  };
  
  // Loading state
  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }
  
  // Connect prompt
  if (!gmailConnection) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-slate-600 dark:text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Connect Your Email</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Connect your email to see your deals inbox
            </p>
            <Button onClick={handleConnectGmail} size="lg" className="gap-2">
              <Mail className="w-4 h-4" />
              Connect Email
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  // Email detail view
  if (selectedEmail) {
    return (
      <AdminLayout>
        <div className="h-[calc(100vh-80px)] flex flex-col bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl">
              <h1 className="text-lg font-semibold mb-4">{selectedEmail.subject}</h1>
              <div className="flex items-start gap-3 mb-6">
                <Avatar className="w-10 h-10">
                  {selectedEmail.senderPhoto && <AvatarImage src={selectedEmail.senderPhoto} />}
                  <AvatarFallback>{extractSenderName(selectedEmail.from).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{extractSenderName(selectedEmail.from)}</p>
                  <p className="text-xs text-slate-500">{format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}</p>
                </div>
              </div>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: formatEmailBody(selectedEmail.body || selectedEmail.snippet) }}
              />
              <div className="flex gap-2 mt-6">
                <Button variant="outline" size="sm"><Reply className="w-4 h-4 mr-1" />Reply</Button>
                <Button variant="outline" size="sm"><Forward className="w-4 h-4 mr-1" />Forward</Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </AdminLayout>
    );
  }
  
  const sortLabels = { urgency: 'needs action soonest', date: 'most recent', amount: 'highest amount' };
  
  return (
    <AdminLayout>
      <div className="h-[calc(100vh-80px)] flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Left Panel - Deal List */}
        <div className="w-[420px] flex flex-col border-r border-slate-200 dark:border-slate-800">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {activeStage === 'all' ? 'All Deals' : STAGE_CONFIG[activeStage]?.label || 'Deals'}
                </h1>
                <p className="text-[11px] text-slate-500">
                  {filteredDeals.length} deals · Sorted by {sortLabels[sortBy]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <Filter className="w-3 h-3" />Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => setActiveStage('all')}>All Deals</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
                      <DropdownMenuItem key={key} onClick={() => setActiveStage(key)}>
                        <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: cfg.color }} />
                        {cfg.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <ArrowUpDown className="w-3 h-3" />Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setSortBy('urgency')}>
                      Needs action soonest {sortBy === 'urgency' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('date')}>
                      Most recent {sortBy === 'date' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('amount')}>
                      Highest amount {sortBy === 'amount' && '✓'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchEmails()}>
                  {emailsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
          
          {/* Deal List */}
          <ScrollArea className="flex-1">
            {emailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No deals found</p>
              </div>
            ) : (
              filteredDeals.map((deal) => {
                const stage = STAGE_CONFIG[deal.lead.status];
                const response = leadResponseMap.get(deal.leadId);
                const isSelected = selectedDealId === deal.leadId;
                
                return (
                  <div
                    key={deal.leadId}
                    onClick={() => setSelectedDealId(deal.leadId)}
                    className={`
                      relative px-4 py-3 cursor-pointer transition-all border-b border-slate-100 dark:border-slate-800
                      ${isSelected ? 'bg-slate-50 dark:bg-slate-800/80' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}
                      ${deal.isUrgent ? 'border-l-2 border-l-red-500' : ''}
                    `}
                  >
                    {/* Unread dot */}
                    {!deal.latestEmail.isRead && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                    
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Company */}
                        <h3 className="font-semibold text-[14px] text-slate-900 dark:text-slate-100 truncate leading-tight">
                          {deal.lead.company_name || deal.lead.name}
                        </h3>
                        
                        {/* Contact */}
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                          {deal.lead.name}
                          {deal.lead.company_name && deal.lead.company_name !== deal.lead.name && (
                            <span className="text-slate-400"> · {deal.lead.company_name}</span>
                          )}
                        </p>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1">
                          {response?.loanType && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 rounded-sm">
                              {response.loanType}
                            </Badge>
                          )}
                          {stage && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border-0 rounded-sm">
                              {stage.shortLabel}
                            </Badge>
                          )}
                          {deal.isUrgent && deal.daysSinceActivity > 3 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 rounded-sm gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {deal.daysSinceActivity > 7 ? 'Needs follow-up' : 'Overdue'}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Next Action */}
                        {deal.nextAction && (
                          <p className="flex items-center gap-1 text-[12px] text-slate-700 dark:text-slate-300">
                            <span className="text-slate-400">→</span>
                            <span className="truncate">{deal.nextAction}</span>
                          </p>
                        )}
                      </div>
                      
                      {/* Right: Avatar + Meta */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Avatar className="w-9 h-9 border border-slate-200 dark:border-slate-700">
                          {deal.latestEmail.senderPhoto && <AvatarImage src={deal.latestEmail.senderPhoto} />}
                          <AvatarFallback className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {deal.lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Next touch</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            {isToday(new Date(deal.latestEmail.date)) 
                              ? `Today, ${format(new Date(deal.latestEmail.date), 'h:mm a')}`
                              : format(new Date(deal.latestEmail.date), 'MMM d, h:mm a')
                            }
                          </p>
                        </div>
                        
                        {deal.latestEmail.attachments && deal.latestEmail.attachments.length > 0 && (
                          <div className="flex items-center gap-0.5 text-slate-400">
                            <Paperclip className="w-3 h-3" />
                            <span className="text-[10px]">{deal.latestEmail.attachments.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>
        
        {/* Right Panel - Deal Summary */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-800/20">
          {selectedDeal ? (
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Header */}
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Deal Summary</p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-3">
                    {selectedDeal.lead.company_name || selectedDeal.lead.name}
                  </h2>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {selectedDeal.loanType && (
                      <Badge variant="secondary" className="text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 rounded px-2 py-0.5">
                        {selectedDeal.loanType}
                      </Badge>
                    )}
                    {STAGE_CONFIG[selectedDeal.lead.status] && (
                      <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border-0 rounded px-2 py-0.5">
                        {STAGE_CONFIG[selectedDeal.lead.status].label}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Metrics */}
                <div className="space-y-3 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  {selectedDeal.loanAmount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Loan Amount</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(selectedDeal.loanAmount)}
                      </span>
                    </div>
                  )}
                  
                  {selectedDeal.purpose && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Purpose</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right max-w-[180px] truncate">
                        {selectedDeal.purpose}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Urgency</span>
                    <span className={`text-sm font-semibold ${selectedDeal.isUrgent ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedDeal.isUrgent ? 'High' : 'Normal'} - {selectedDeal.daysSinceActivity} days
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Confidence</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                </div>
                
                {/* CTA Button */}
                {selectedDeal.nextAction && (
                  <Button
                    className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 rounded-lg shadow-sm"
                    onClick={() => toast.success('Action triggered')}
                  >
                    {selectedDeal.nextAction}
                  </Button>
                )}
                
                {/* Primary Contact */}
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Primary Contact</p>
                  
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar className="w-11 h-11 border border-slate-200 dark:border-slate-700">
                      {selectedDeal.latestEmail.senderPhoto && <AvatarImage src={selectedDeal.latestEmail.senderPhoto} />}
                      <AvatarFallback className="text-sm font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                        {selectedDeal.lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedDeal.lead.name}</p>
                      <p className="text-xs text-slate-500">
                        {selectedDeal.lead.title || 'Contact'}, {selectedDeal.lead.company_name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedDeal.lead.email && (
                      <a href={`mailto:${selectedDeal.lead.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {selectedDeal.lead.email}
                      </a>
                    )}
                    
                    {selectedDeal.lead.phone && (
                      <a href={`tel:${selectedDeal.lead.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {selectedDeal.lead.phone}
                      </a>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Last touch: {formatDistanceToNow(new Date(selectedDeal.latestEmail.date), { addSuffix: true })}
                    </div>
                    
                    {selectedDeal.lead.source && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Tag className="w-4 h-4 text-slate-400" />
                        Source: {selectedDeal.lead.source}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tags */}
                {selectedDeal.lead.tags && selectedDeal.lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedDeal.lead.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs font-medium text-blue-600 border-blue-200 rounded">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Notes */}
                {selectedDeal.lead.notes && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Quick Notes</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedDeal.lead.notes}
                    </p>
                  </div>
                )}
                
                {/* Recent Emails */}
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Recent Emails</p>
                  <div className="space-y-2">
                    {selectedDeal.emails.slice(0, 3).map((email) => (
                      <button
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className="w-full text-left p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                            {email.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                            {format(new Date(email.date), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{email.snippet}</p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setComposeOpen(true)}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/team/evan/pipeline?leadId=${selectedDeal.leadId}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Deal
                    </Link>
                  </Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">Select a deal to view details</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Compose Dialog */}
      <GmailComposeDialog
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        to={composeTo || selectedDeal?.lead.email || ''}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={async () => {
          setSending(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');
            
            const response = await fetch(
              `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody }),
              }
            );
            if (!response.ok) throw new Error('Failed to send');
            toast.success('Email sent');
            setComposeOpen(false);
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');
          } catch (e: any) {
            toast.error(e.message);
          } finally {
            setSending(false);
          }
        }}
        sending={sending}
        recipientName={selectedDeal?.lead.name}
      />
    </AdminLayout>
  );
};

export default EvansGmail;
