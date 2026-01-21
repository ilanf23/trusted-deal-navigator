import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Mail, Phone, Building2, Calendar, FileText, User, Clock, 
  PhoneCall, ChevronDown, ChevronUp, Play, PhoneIncoming, PhoneOutgoing, 
  MessageSquare, History, Plus, Trash2, Globe, Linkedin, Twitter, MapPin,
  Link2, Users, ListTodo, Tag, CheckCircle2, Circle, X, GripVertical,
  Briefcase, FileSpreadsheet, MessagesSquare, Video, Sparkles, HelpCircle, Columns
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type LeadStatus = Database['public']['Enums']['lead_status'];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  questionnaire_sent_at: string | null;
  questionnaire_completed_at: string | null;
  known_as: string | null;
  title: string | null;
  contact_type: string | null;
  tags: string[] | null;
  about: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
}

interface LeadPhone {
  id: string;
  lead_id: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface LeadEmail {
  id: string;
  lead_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface LeadAddress {
  id: string;
  lead_id: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  title: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
}

interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  phone_number: string | null;
  content: string | null;
  duration_seconds: number | null;
  status: string | null;
  transcript: string | null;
  created_at: string;
}

const stages = [
  { status: 'discovery', title: 'Discovery', color: '#0066FF' },
  { status: 'pre_qualification', title: 'Pre-Qual', color: '#1a75ff' },
  { status: 'document_collection', title: 'Doc Collection', color: '#3385ff' },
  { status: 'underwriting', title: 'Underwriting', color: '#FF8000' },
  { status: 'approval', title: 'Approval', color: '#e67300' },
  { status: 'funded', title: 'Funded', color: '#059669' },
];

// Placeholder data for Evan's CRM leads
const leadPlaceholderData: Record<string, {
  address: string;
  loanType: string;
  loanAmount: string;
  businessType: string;
  propertyType: string;
  urgency: string;
  notes: string;
}> = {
  // Ilan Samuel Fridman
  '6f00ff2c-4a3a-43af-9f68-88c99411fb59': {
    address: '2847 Lake Shore Dr, Chicago, IL 60614',
    loanType: 'SBA 7(a)',
    loanAmount: '$850,000',
    businessType: 'Tech Startup',
    propertyType: 'Office Space',
    urgency: 'High',
    notes: 'Initial discovery call completed. Technical difficulties during first call - needs follow-up.',
  },
  // Sarah Rodriguez - Meridian Development Group
  '7768d0c3-ca10-4955-bee0-2af42f0a061a': {
    address: '1250 N Clark St, Chicago, IL 60610',
    loanType: 'Bridge Loan',
    loanAmount: '$3,200,000',
    businessType: 'Real Estate Development',
    propertyType: 'Multi-Family (24 units)',
    urgency: 'Medium',
    notes: 'Multi-family project in Lincoln Park. Needs bridge financing for 18 months until permanent financing.',
  },
  // James Patterson - Patterson Holdings LLC
  'b6329460-e111-4f61-bf18-fc892dab614b': {
    address: '445 Park Ave, New York, NY 10022',
    loanType: 'SBA 504',
    loanAmount: '$1,800,000',
    businessType: 'Restaurant Franchise',
    propertyType: 'Retail/Restaurant',
    urgency: 'High',
    notes: 'Expanding Chipotle franchise - 3 new locations in NYC metro. Strong financials, 10+ years experience.',
  },
  // Michael Chen - TechVest Capital
  'e20d9ba8-18dd-4190-8f7b-c7081c8e1f2b': {
    address: '580 California St, San Francisco, CA 94104',
    loanType: 'Commercial Real Estate',
    loanAmount: '$2,500,000',
    businessType: 'Investment Firm',
    propertyType: 'Class A Office',
    urgency: 'Medium',
    notes: 'Commercial property acquisition in Financial District. Pre-qualified, waiting on additional docs.',
  },
  // Emily Wang - Sunrise Healthcare Partners
  '341f4f1c-fbdb-43b6-a25a-7f0e38a7237e': {
    address: '9500 Gilman Dr, La Jolla, CA 92093',
    loanType: 'Medical Practice Loan',
    loanAmount: '$4,200,000',
    businessType: 'Healthcare',
    propertyType: 'Medical Office Building',
    urgency: 'High',
    notes: 'Acquiring existing MOB near UCSD. Deal in underwriting - strong cash flow, excellent credit.',
  },
};

// Default placeholder for leads not in the mapping
const defaultPlaceholder = {
  address: '',
  loanType: 'Conventional',
  loanAmount: '',
  businessType: '',
  propertyType: '',
  urgency: 'Medium',
  notes: '',
};

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: () => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange, onLeadUpdated }: LeadDetailDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  
  // Collapsible sections state
  const [customColumnsOpen, setCustomColumnsOpen] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [magicColumnsOpen, setMagicColumnsOpen] = useState(true);

  // Get placeholder data for current lead
  const getPlaceholderData = () => {
    if (!lead) return defaultPlaceholder;
    return leadPlaceholderData[lead.id] || defaultPlaceholder;
  };

  // Custom column values (local state for demo)
  const [customFields, setCustomFields] = useState({
    address: '',
    loanType: '',
    loanAmount: '',
    businessType: '',
    propertyType: '',
    urgency: false,
  });

  // Notes state
  const [notesContent, setNotesContent] = useState('');

  // Reset when lead changes
  useEffect(() => {
    if (lead && open) {
      setActiveTab('all');
      const placeholder = getPlaceholderData();
      setCustomFields({
        address: placeholder.address,
        loanType: placeholder.loanType,
        loanAmount: placeholder.loanAmount,
        businessType: placeholder.businessType,
        propertyType: placeholder.propertyType,
        urgency: placeholder.urgency === 'High',
      });
      setNotesContent(placeholder.notes || lead.notes || '');
    }
  }, [lead, open]);

  // Queries
  const { data: phones = [] } = useQuery({
    queryKey: ['lead-phones', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadPhone[];
    },
    enabled: !!lead && open,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ['lead-emails', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadEmail[];
    },
    enabled: !!lead && open,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['lead-addresses', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadAddress[];
    },
    enabled: !!lead && open,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as LeadActivity[];
    },
    enabled: !!lead && open,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['lead-tasks', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_tasks').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as LeadTask[];
    },
    enabled: !!lead && open,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name, avatar_url').eq('is_active', true);
      return (data || []) as TeamMember[];
    },
    enabled: open,
  });

  const { data: communications = [] } = useQuery({
    queryKey: ['lead-communications', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('evan_communications').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as Communication[];
    },
    enabled: !!lead && open,
  });

  // Mutations
  const updateLeadStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ status: newStatus as LeadStatus }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Stage updated' });
    },
  });

  const updateLeadAssignment = useMutation({
    mutationFn: async (assignedTo: string) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Assignment updated' });
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ notes: notesContent }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Notes saved' });
    },
  });

  const addContact = useMutation({
    mutationFn: async (email: string) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_emails').insert({ lead_id: lead.id, email, email_type: 'work' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] });
      toast({ title: 'Contact added' });
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!lead) return null;

  // Get assigned team member
  const assignedMember = teamMembers.find(t => t.id === lead.assigned_to);
  const currentStage = stages.find(s => s.status === lead.status);

  // Get all emails for contacts section
  const allEmails = emails.length > 0 ? emails : (lead.email ? [{ id: 'legacy', email: lead.email, email_type: 'primary' }] : []);

  // Calculate magic column values
  const daysInStage = differenceInDays(new Date(), new Date(lead.updated_at));
  const lastEmailDate = communications.find(c => c.communication_type === 'email')?.created_at;
  const lastInteractionDate = communications.length > 0 ? communications[0].created_at : null;
  const nextDueTask = tasks.find(t => t.status !== 'completed' && t.due_date);

  // Combine activities for timeline
  const timelineItems = [
    ...activities.map(a => ({ ...a, _type: 'activity' as const })),
    ...communications.map(c => ({ ...c, _type: 'communication' as const, activity_type: c.communication_type, title: null, content: null }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <div className="flex items-center gap-4">
            <Mail className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-600">
              You are adding & sharing all threads with <span className="font-semibold">{allEmails[0]?.email || 'No email'}</span>.
              <span className="text-slate-400 ml-2">Someone have threads listed below but haven't shared yet</span>
              <HelpCircle className="w-4 h-4 inline ml-1 text-slate-400" />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="link" className="text-blue-600 text-sm p-0">Request access</Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex h-[calc(90vh-60px)]">
          {/* Left Panel - Activity Timeline */}
          <div className="flex-1 flex flex-col border-r">
            {/* Action Bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
              <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-md px-3 py-2">
                <Plus className="w-4 h-4 text-rose-400" />
                <span className="text-sm text-slate-500">Sorry, you can't add anything to this Box with your current permissions</span>
              </div>
              <Button variant="ghost" size="icon"><MessageSquare className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon"><CheckCircle2 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon"><Calendar className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon"><FileText className="w-4 h-4" /></Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-4 border-b">
                <TabsList className="h-12 bg-transparent p-0 gap-0">
                  <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">All</TabsTrigger>
                  <TabsTrigger value="emails" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Emails</TabsTrigger>
                  <TabsTrigger value="files" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Files</TabsTrigger>
                  <TabsTrigger value="comments" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Comments</TabsTrigger>
                  <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Tasks</TabsTrigger>
                  <TabsTrigger value="calls" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Call Logs</TabsTrigger>
                  <TabsTrigger value="meetings" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Meeting Notes</TabsTrigger>
                </TabsList>
              </div>

              {/* AI Action Bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <FileText className="w-4 h-4 mr-2" />
                  Summarize
                </Button>
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Ask a question
                </Button>
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Columns className="w-4 h-4 mr-2" />
                  Autofill columns
                </Button>
                <X className="w-4 h-4 text-slate-400 ml-auto cursor-pointer hover:text-slate-600" />
              </div>

              {/* Timeline Content */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-1">
                  {/* All Tab Content */}
                  <TabsContent value="all" className="m-0 space-y-1">
                    {timelineItems.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No activity yet</p>
                      </div>
                    ) : (
                      timelineItems.map((item, idx) => (
                        <div key={item.id} className="flex items-start gap-3 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                          <div className="w-5 h-5 mt-1">
                            {item._type === 'communication' ? (
                              item.direction === 'inbound' ? 
                                <PhoneIncoming className="w-5 h-5 text-green-600" /> : 
                                <PhoneOutgoing className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Mail className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm text-slate-900">
                                  {item._type === 'communication' 
                                    ? `${item.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`
                                    : item.title || 'Activity'}
                                </p>
                                <p className="text-sm text-slate-600 truncate mt-0.5">
                                  {item._type === 'activity' 
                                    ? (item as LeadActivity).content 
                                    : `Duration: ${formatDuration((item as Communication).duration_seconds)}`}
                                </p>
                              </div>
                              <span className="text-xs text-slate-400 whitespace-nowrap">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: false })} ago
                              </span>
                            </div>
                            {item._type === 'communication' && (item as Communication).transcript && (
                              <Collapsible open={expandedTranscripts[item.id]} onOpenChange={() => setExpandedTranscripts(p => ({ ...p, [item.id]: !p[item.id] }))}>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="mt-1 text-xs">
                                    {expandedTranscripts[item.id] ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                                    View Transcript
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-2 bg-slate-100 rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    {(item as Communication).transcript}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Stage Change Event */}
                    <div className="flex items-center gap-3 py-3 text-sm text-slate-600">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className="font-medium">Stage changed to</span>
                      <Badge 
                        className="text-white text-xs"
                        style={{ backgroundColor: currentStage?.color }}
                      >
                        {currentStage?.title}
                      </Badge>
                    </div>
                  </TabsContent>

                  {/* Emails Tab */}
                  <TabsContent value="emails" className="m-0">
                    <div className="text-center py-12 text-slate-400">
                      <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No emails yet</p>
                      <p className="text-sm mt-2">Want to see emails sent to/from your team?</p>
                      <Button variant="default" size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700">
                        <Users className="w-4 h-4 mr-2" />
                        Invite teammates
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Files Tab */}
                  <TabsContent value="files" className="m-0">
                    <div className="text-center py-12 text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No files attached</p>
                    </div>
                  </TabsContent>

                  {/* Comments Tab */}
                  <TabsContent value="comments" className="m-0">
                    <div className="text-center py-12 text-slate-400">
                      <MessagesSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No comments yet</p>
                    </div>
                  </TabsContent>

                  {/* Tasks Tab */}
                  <TabsContent value="tasks" className="m-0 space-y-2">
                    {tasks.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No tasks yet</p>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <div key={task.id} className="flex items-start gap-3 py-2 px-3 hover:bg-slate-50 rounded">
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={cn("text-sm", task.status === 'completed' && "line-through text-slate-400")}>{task.title}</p>
                            {task.due_date && (
                              <p className="text-xs text-slate-400 mt-0.5">Due {format(new Date(task.due_date), 'MMM d')}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Call Logs Tab */}
                  <TabsContent value="calls" className="m-0 space-y-2">
                    {communications.filter(c => c.communication_type === 'call').length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No call logs</p>
                      </div>
                    ) : (
                      communications.filter(c => c.communication_type === 'call').map(call => (
                        <div key={call.id} className="flex items-start gap-3 py-2 px-3 hover:bg-slate-50 rounded">
                          {call.direction === 'inbound' ? (
                            <PhoneIncoming className="w-5 h-5 text-green-600" />
                          ) : (
                            <PhoneOutgoing className="w-5 h-5 text-blue-600" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call</p>
                            <p className="text-xs text-slate-400">
                              {formatDuration(call.duration_seconds)} • {format(new Date(call.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Meeting Notes Tab */}
                  <TabsContent value="meetings" className="m-0">
                    <div className="text-center py-12 text-slate-400">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No meeting notes</p>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="w-[380px] flex flex-col bg-white">
            {/* Stage & Assigned To Header */}
            <div className="flex items-start justify-between px-4 py-4 border-b">
              <div>
                <p className="text-xs text-slate-500 mb-1">Stage</p>
                <Select value={lead.status} onValueChange={(v) => updateLeadStatus.mutate(v)}>
                  <SelectTrigger className="w-[180px] h-9 border-slate-200">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: currentStage?.color }}
                      />
                      <span className="text-sm">{currentStage?.title}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {stages.map(s => (
                      <SelectItem key={s.status} value={s.status}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                          {s.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Assigned To</p>
                <Select value={lead.assigned_to || ''} onValueChange={(v) => updateLeadAssignment.mutate(v)}>
                  <SelectTrigger className="w-[120px] h-9 border-slate-200">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-emerald-600 text-white">
                          {assignedMember?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{assignedMember?.name || 'Unassigned'}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {teamMembers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="text-[10px] bg-emerald-600 text-white">
                              {t.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {/* Custom Columns Section */}
                <Collapsible open={customColumnsOpen} onOpenChange={setCustomColumnsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-slate-50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="font-medium text-sm text-slate-700">Custom Columns</span>
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 ml-auto transition-transform", !customColumnsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Address</p>
                        <Input 
                          value={customFields.address} 
                          onChange={(e) => setCustomFields(p => ({ ...p, address: e.target.value }))}
                          className="h-8 text-sm border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                          placeholder=""
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Loan Type</p>
                        <Input 
                          value={customFields.loanType} 
                          onChange={(e) => setCustomFields(p => ({ ...p, loanType: e.target.value }))}
                          className="h-8 text-sm border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Loan Amount</p>
                        <Input 
                          value={customFields.loanAmount} 
                          onChange={(e) => setCustomFields(p => ({ ...p, loanAmount: e.target.value }))}
                          className="h-8 text-sm border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Business Type</p>
                        <Input 
                          value={customFields.businessType} 
                          onChange={(e) => setCustomFields(p => ({ ...p, businessType: e.target.value }))}
                          className="h-8 text-sm border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Property Type</p>
                        <Input 
                          value={customFields.propertyType} 
                          onChange={(e) => setCustomFields(p => ({ ...p, propertyType: e.target.value }))}
                          className="h-8 text-sm border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">High Priority</p>
                        <div className="flex items-center h-8">
                          <Checkbox 
                            checked={customFields.urgency} 
                            onCheckedChange={(checked) => setCustomFields(p => ({ ...p, urgency: !!checked }))}
                          />
                        </div>
                      </div>
                    </div>
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Contacts and Organizations Section */}
                <Collapsible open={contactsOpen} onOpenChange={setContactsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-slate-50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="font-medium text-sm text-slate-700">Contacts and organizations</span>
                    <Mail className="w-4 h-4 text-slate-400 ml-auto" />
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", !contactsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    {allEmails.map((email, idx) => (
                      <div key={email.id || idx} className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-sm bg-teal-600 text-white">
                            {email.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{email.email}</p>
                          <p className="text-xs text-slate-400 truncate">{email.email}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="w-6 h-6">
                          <Plus className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Add contact
                      {allEmails.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{allEmails.length}</Badge>}
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Notes Section */}
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-slate-50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="font-medium text-sm text-slate-700">Notes</span>
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 ml-auto transition-transform", !notesOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <Textarea 
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      onBlur={() => notesContent !== lead.notes && saveNotes.mutate()}
                      placeholder="Add notes..."
                      className="min-h-[60px] text-sm border-slate-200 resize-none"
                    />
                    {lead.updated_at && (
                      <p className="text-xs text-slate-400 mt-2">
                        Last updated: {format(new Date(lead.updated_at), 'M/d/yy')}
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Magic Columns Section */}
                <Collapsible open={magicColumnsOpen} onOpenChange={setMagicColumnsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-slate-50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="font-medium text-sm text-slate-700">Magic Columns</span>
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 ml-auto transition-transform", !magicColumnsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date of Last Email</p>
                        <p className="text-sm text-slate-900">
                          {lastEmailDate ? format(new Date(lastEmailDate), 'MMM d yyyy') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date of Next Due Task</p>
                        <p className="text-sm text-slate-900">
                          {nextDueTask?.due_date ? format(new Date(nextDueTask.due_date), 'MMM d yyyy') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Days in Stage</p>
                        <p className="text-sm text-slate-900">{daysInStage}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date of Last Interaction</p>
                        <p className="text-sm text-slate-900">
                          {lastInteractionDate ? format(new Date(lastInteractionDate), 'MMM d yyyy') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date of Last Tracked View</p>
                        <p className="text-sm text-slate-900">
                          {lead.updated_at ? format(new Date(lead.updated_at), 'MMM d yyyy') : '—'}
                        </p>
                      </div>
                    </div>
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
