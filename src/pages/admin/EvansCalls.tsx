import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Phone, 
  User, 
  Building2, 
  Mail, 
  Calendar, 
  DollarSign, 
  Percent, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  PhoneOff,
  AlertCircle,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  History,
  UserPlus,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LenderProgramAssistant } from '@/components/admin/LenderProgramAssistant';

interface ActiveCall {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  status: string;
  direction: string;
  lead_id: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface LeadResponse {
  loan_type: string | null;
  loan_amount: number | null;
  funding_purpose: string | null;
  annual_revenue: string | null;
  business_type: string | null;
  property_owner_occupied: string | null;
}

interface Program {
  id: string;
  lender_name: string;
  lender_specialty: string | null;
  program_name: string;
  program_type: string;
  description: string | null;
  min_loan: number | null;
  max_loan: number | null;
  interest_range: string | null;
  term: string | null;
}

interface GroupedLender {
  name: string;
  specialty: string;
  programs: Program[];
}

interface CallLog {
  id: string;
  communication_type: string;
  direction: string;
  phone_number: string | null;
  status: string | null;
  duration_seconds: number | null;
  created_at: string;
  lead_id: string | null;
  transcript: string | null;
  recording_url?: string | null;
  recording_sid?: string | null;
  call_sid?: string | null;
  leads?: {
    name: string;
    company_name: string | null;
  } | null;
}

const formatCurrency = (amount: number | null) => {
  if (!amount) return 'N/A';
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(0)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'SBA':
      return 'bg-admin-blue text-white border-0';
    case 'Conventional':
      return 'bg-admin-teal text-white border-0';
    case 'Bridge':
      return 'bg-admin-orange text-white border-0';
    case 'Construction':
      return 'bg-gradient-to-r from-admin-orange to-admin-orange-dark text-white border-0';
    case 'CMBS':
      return 'bg-admin-blue-dark text-white border-0';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'discovery':
      return 'bg-blue-100 text-blue-800';
    case 'pre_qualification':
      return 'bg-purple-100 text-purple-800';
    case 'document_collection':
      return 'bg-yellow-100 text-yellow-800';
    case 'underwriting':
      return 'bg-orange-100 text-orange-800';
    case 'approval':
      return 'bg-green-100 text-green-800';
    case 'funded':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const EvansCalls = () => {
  const queryClient = useQueryClient();
  const [expandedLenders, setExpandedLenders] = useState<Record<string, boolean>>({});
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState<CallLog | null>(null);
  const [retryingTranscriptId, setRetryingTranscriptId] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  
  // Add Lead Dialog state
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [selectedCallForLead, setSelectedCallForLead] = useState<CallLog | null>(null);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  
  // AI Assistant state
  const [showAssistant, setShowAssistant] = useState(true);

  // Fetch active/recent calls
  const { data: activeCalls = [], isLoading: callsLoading } = useQuery({
    queryKey: ['evan-active-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_calls')
        .select('*')
        .in('status', ['ringing', 'in-progress'])
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ActiveCall[];
    },
    refetchInterval: 2000,
  });

  // Fetch call history from evan_communications
  const { data: callHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['evan-call-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select(`
          *,
          leads (
            name,
            company_name
          )
        `)
        .eq('communication_type', 'call')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as CallLog[];
    },
  });

  // If the transcript arrives after the dialog is opened, refresh the dialog content
  useEffect(() => {
    if (!selectedTranscriptCall?.id) return;
    const updated = callHistory.find((c) => c.id === selectedTranscriptCall.id);
    if (updated && updated.transcript !== selectedTranscriptCall.transcript) {
      setSelectedTranscriptCall(updated);
    }
  }, [callHistory, selectedTranscriptCall?.id]);

  const currentCall = activeCalls[0];
  const callerPhone = currentCall?.from_number;

  // Fetch lead matching the caller's phone number
  const { data: matchedLead, isLoading: leadLoading } = useQuery({
    queryKey: ['caller-lead', callerPhone],
    queryFn: async () => {
      if (!callerPhone) return null;
      
      // Clean the phone number for comparison
      const cleanedPhone = callerPhone.replace(/\D/g, '');
      const phoneVariants = [
        callerPhone,
        cleanedPhone,
        cleanedPhone.length === 11 && cleanedPhone.startsWith('1') ? cleanedPhone.slice(1) : cleanedPhone,
        `+1${cleanedPhone.slice(-10)}`,
        `+${cleanedPhone}`,
      ];

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or(phoneVariants.map(p => `phone.ilike.%${p.slice(-10)}%`).join(','))
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as Lead | null;
    },
    enabled: !!callerPhone,
  });

  // Fetch lead response/questionnaire data if we have a matched lead
  const { data: leadResponse } = useQuery({
    queryKey: ['lead-response', matchedLead?.id],
    queryFn: async () => {
      if (!matchedLead?.id) return null;
      
      const { data, error } = await supabase
        .from('lead_responses')
        .select('*')
        .eq('lead_id', matchedLead.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as LeadResponse | null;
    },
    enabled: !!matchedLead?.id,
  });

  // Fetch all lender programs
  const { data: lenders = [], isLoading: programsLoading } = useQuery({
    queryKey: ['lender-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('lender_name', { ascending: true })
        .order('program_name', { ascending: true });

      if (error) throw error;

      // Group by lender
      const grouped = (data || []).reduce((acc: Record<string, GroupedLender>, program) => {
        if (!acc[program.lender_name]) {
          acc[program.lender_name] = {
            name: program.lender_name,
            specialty: program.lender_specialty || '',
            programs: [],
          };
        }
        acc[program.lender_name].programs.push(program);
        return acc;
      }, {});

      return Object.values(grouped) as GroupedLender[];
    },
  });

  const toggleLender = (lenderName: string) => {
    setExpandedLenders((prev) => ({
      ...prev,
      [lenderName]: !prev[lenderName],
    }));
  };

  // Add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: async ({ name, email, phone, company }: { name: string; email: string; phone: string; company: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name,
          email: email || null,
          phone,
          company_name: company || null,
          source: 'phone_call',
          status: 'discovery',
          assigned_to: null, // Will be assigned based on current user context
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (lead, variables) => {
      // Update the call record to link to this lead
      if (selectedCallForLead) {
        await supabase
          .from('evan_communications')
          .update({ lead_id: lead.id })
          .eq('id', selectedCallForLead.id);
      }
      
      toast.success(`Lead "${lead.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['evan-call-history'] });
      setAddLeadDialogOpen(false);
      setSelectedCallForLead(null);
      setNewLeadName('');
      setNewLeadEmail('');
      setNewLeadCompany('');
    },
    onError: (error: any) => {
      toast.error('Failed to create lead: ' + error.message);
    },
  });

  const handleOpenAddLeadDialog = (call: CallLog) => {
    setSelectedCallForLead(call);
    setNewLeadName('');
    setNewLeadEmail('');
    setNewLeadCompany('');
    setAddLeadDialogOpen(true);
  };

  const handleAddLead = () => {
    if (!newLeadName.trim()) {
      toast.error('Please enter a name for the lead');
      return;
    }
    if (!selectedCallForLead?.phone_number) {
      toast.error('No phone number available for this call');
      return;
    }
    
    addLeadMutation.mutate({
      name: newLeadName.trim(),
      email: newLeadEmail.trim(),
      phone: selectedCallForLead.phone_number,
      company: newLeadCompany.trim(),
    });
  };

  const handleGenerateTranscript = async (call: CallLog) => {
    if (!call.recording_url) return;
    setRetryingTranscriptId(call.id);
    setTranscriptError(null);
    try {
      const { data, error } = await supabase.functions.invoke('retry-call-transcription', {
        body: { communicationId: call.id },
      });
      if (error) {
        setTranscriptError('Failed to generate transcript. Please try again later.');
      } else if (data?.error) {
        setTranscriptError(data.error);
      }
      await queryClient.invalidateQueries({ queryKey: ['evan-call-history'] });
    } catch {
      setTranscriptError('Failed to generate transcript. Please try again later.');
    } finally {
      setRetryingTranscriptId(null);
    }
  };

  const isLoading = callsLoading || programsLoading;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border bg-card">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calls</h1>
            <p className="text-sm text-muted-foreground">Incoming call management & lender programs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Call Info & Lead Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Current Call Card */}
            <Card className={`border-2 ${currentCall ? 'border-green-500/50 bg-green-50/30' : 'border-muted'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-full ${currentCall ? 'bg-green-500 animate-pulse' : 'bg-muted'}`}>
                    <Phone className={`h-5 w-5 ${currentCall ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {currentCall ? 'Active Call' : 'No Active Call'}
                    </CardTitle>
                    <CardDescription>
                      {currentCall ? `Status: ${currentCall.status}` : 'Waiting for incoming calls'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {currentCall && (
                <CardContent className="pt-0">
                  <div className="p-4 rounded-lg bg-background border">
                    <p className="text-2xl font-semibold text-center">
                      {formatPhoneNumber(currentCall.from_number)}
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {format(new Date(currentCall.created_at), 'h:mm a')}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Matched Lead Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Caller Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {leadLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : matchedLead ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-admin-blue to-admin-blue-dark flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {matchedLead.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{matchedLead.name}</h3>
                          <Badge className={getStatusBadgeClass(matchedLead.status)}>
                            {matchedLead.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {matchedLead.company_name && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{matchedLead.company_name}</span>
                          </div>
                        )}
                        {matchedLead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{matchedLead.email}</span>
                          </div>
                        )}
                        {matchedLead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{formatPhoneNumber(matchedLead.phone)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Added {format(new Date(matchedLead.created_at), 'MMM d, yyyy')}</span>
                        </div>
                        {matchedLead.source && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>Source: {matchedLead.source}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Questionnaire/Loan Details */}
                    {leadResponse && (
                      <div className="p-4 rounded-lg border">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Loan Details
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {leadResponse.loan_type && (
                            <div>
                              <p className="text-muted-foreground text-xs">Loan Type</p>
                              <p className="font-medium">{leadResponse.loan_type}</p>
                            </div>
                          )}
                          {leadResponse.loan_amount && (
                            <div>
                              <p className="text-muted-foreground text-xs">Amount</p>
                              <p className="font-medium">{formatCurrency(leadResponse.loan_amount)}</p>
                            </div>
                          )}
                          {leadResponse.funding_purpose && (
                            <div>
                              <p className="text-muted-foreground text-xs">Purpose</p>
                              <p className="font-medium">{leadResponse.funding_purpose}</p>
                            </div>
                          )}
                          {leadResponse.annual_revenue && (
                            <div>
                              <p className="text-muted-foreground text-xs">Annual Revenue</p>
                              <p className="font-medium">{leadResponse.annual_revenue}</p>
                            </div>
                          )}
                          {leadResponse.business_type && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground text-xs">Business Type</p>
                              <p className="font-medium">{leadResponse.business_type}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Lead Notes */}
                    {matchedLead.notes && (
                      <div className="p-4 rounded-lg border bg-yellow-50/50">
                        <h4 className="font-medium mb-2 text-sm">Notes</h4>
                        <p className="text-sm text-muted-foreground">{matchedLead.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {currentCall 
                        ? 'No matching lead found for this number'
                        : 'Lead information will appear when a call comes in'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Call History Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Call History</CardTitle>
                    <CardDescription>{callHistory.length} calls</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : callHistory.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <PhoneOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No call history yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {callHistory.map((call) => (
                        <div
                          key={call.id}
                          className="p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${
                              call.direction === 'inbound' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                              {call.direction === 'inbound' ? (
                                <PhoneIncoming className="h-4 w-4" />
                              ) : (
                                <PhoneOutgoing className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-sm truncate">
                                  {call.leads?.name || formatPhoneNumber(call.phone_number || 'Unknown')}
                                </p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDuration(call.duration_seconds)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {call.phone_number ? formatPhoneNumber(call.phone_number) : 'No number'}
                                </span>
                                {call.leads?.company_name && (
                                  <span className="text-xs text-muted-foreground">
                                    • {call.leads.company_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
                                </p>
                                <div className="flex items-center gap-1 ml-auto">
                                  {/* Add as Lead button - only show if no lead is linked */}
                                  {!call.lead_id && call.phone_number && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-muted-foreground hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAddLeadDialog(call);
                                      }}
                                    >
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      Add Lead
                                    </Button>
                                  )}
                                  {call.status === 'completed' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={retryingTranscriptId === call.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setSelectedTranscriptCall(call);
                                        setTranscriptDialogOpen(true);
                                        setTranscriptError(null);

                                        // If we already have a transcript, just show it
                                        if (call.transcript) return;

                                        // If there is no recording, we cannot generate a transcript
                                        if (!call.recording_url) return;

                                        await handleGenerateTranscript(call);
                                      }}
                                    >
                                      {retryingTranscriptId === call.id ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <FileText className="h-3 w-3 mr-1" />
                                      )}
                                      {call.transcript
                                        ? 'Transcript'
                                        : retryingTranscriptId === call.id
                                          ? 'Generating…'
                                          : 'Generate transcript'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Lender Programs & AI Assistant */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 h-[calc(100vh-280px)]">
              {/* Lender Programs */}
              <div className={showAssistant ? "xl:col-span-3" : "xl:col-span-5"}>
                <Card className="h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle>Lender Programs</CardTitle>
                          <CardDescription>
                            {lenders.length} lenders available
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant={showAssistant ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowAssistant(!showAssistant)}
                        className="gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {showAssistant ? "Hide AI" : "Ask AI"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="p-6 pt-0 space-y-4">
                        {lenders.map((lender) => (
                          <Collapsible
                            key={lender.name}
                            open={expandedLenders[lender.name]}
                            onOpenChange={() => toggleLender(lender.name)}
                          >
                            <Card className="overflow-hidden border-admin-blue/10 border hover:border-admin-blue/30 transition-all">
                              <CollapsibleTrigger className="w-full">
                                <CardHeader className="cursor-pointer hover:bg-admin-blue-light/30 transition-colors py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-admin-blue to-admin-blue-dark flex items-center justify-center shadow-sm">
                                        <Building2 className="w-5 h-5 text-white" />
                                      </div>
                                      <div className="text-left">
                                        <p className="font-semibold text-admin-blue-dark">{lender.name}</p>
                                        <p className="text-xs text-muted-foreground">{lender.specialty}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-admin-orange text-white border-0 text-xs">
                                        {lender.programs.length} Programs
                                      </Badge>
                                      {expandedLenders[lender.name] ? (
                                        <ChevronUp className="w-4 h-4 text-admin-blue" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0 pb-4">
                                  <div className="space-y-3">
                                    {lender.programs.map((program) => (
                                      <div
                                        key={program.id}
                                        className="p-4 rounded-lg border border-admin-blue/10 bg-gradient-to-r from-admin-blue-light/20 to-transparent"
                                      >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                          <div>
                                            <div className="flex items-center gap-2 mb-1">
                                              <h4 className="font-medium text-sm">{program.program_name}</h4>
                                              <Badge className={`text-xs ${getTypeBadgeClass(program.program_type)}`}>
                                                {program.program_type}
                                              </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{program.description}</p>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-xs">
                                          <div className="flex items-center gap-2">
                                            <DollarSign className="w-3 h-3 text-admin-teal" />
                                            <span className="text-muted-foreground">
                                              {formatCurrency(program.min_loan)} - {formatCurrency(program.max_loan)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Percent className="w-3 h-3 text-admin-blue" />
                                            <span className="text-muted-foreground">{program.interest_range || 'N/A'}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3 text-admin-orange" />
                                            <span className="text-muted-foreground">{program.term || 'N/A'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* AI Assistant Panel */}
              {showAssistant && (
                <div className="xl:col-span-2 h-full">
                  <LenderProgramAssistant
                    leadContext={
                      matchedLead
                        ? {
                            name: matchedLead.name,
                            company: matchedLead.company_name || undefined,
                            loanType: leadResponse?.loan_type || undefined,
                            loanAmount: leadResponse?.loan_amount || undefined,
                            purpose: leadResponse?.funding_purpose || undefined,
                            annualRevenue: leadResponse?.annual_revenue || undefined,
                            businessType: leadResponse?.business_type || undefined,
                          }
                        : undefined
                    }
                    onClose={() => setShowAssistant(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Transcript Dialog */}
      <Dialog open={transcriptDialogOpen} onOpenChange={(open) => {
        setTranscriptDialogOpen(open);
        if (!open) setTranscriptError(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Transcript
            </DialogTitle>
            <DialogDescription>
              {selectedTranscriptCall && (
                <>
                  {selectedTranscriptCall.leads?.name || formatPhoneNumber(selectedTranscriptCall.phone_number || 'Unknown')}
                  {' • '}
                  {format(new Date(selectedTranscriptCall.created_at), 'MMM d, yyyy h:mm a')}
                  {' • '}
                  {formatDuration(selectedTranscriptCall.duration_seconds)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            {selectedTranscriptCall?.transcript ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-lg">
                {selectedTranscriptCall.transcript}
              </div>
            ) : retryingTranscriptId && selectedTranscriptCall?.id === retryingTranscriptId ? (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 animate-spin" />
                <p className="text-muted-foreground">Generating transcript…</p>
                <p className="text-xs text-muted-foreground mt-1">This usually takes under a minute.</p>
              </div>
            ) : transcriptError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium">Transcription Failed</p>
                <p className="text-xs text-muted-foreground mt-1">{transcriptError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => selectedTranscriptCall && handleGenerateTranscript(selectedTranscriptCall)}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transcript available for this call</p>
                {selectedTranscriptCall?.recording_url ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => selectedTranscriptCall && handleGenerateTranscript(selectedTranscriptCall)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Transcript
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    No recording available for this call.
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add Lead Dialog */}
      <Dialog open={addLeadDialogOpen} onOpenChange={setAddLeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add as Lead
            </DialogTitle>
            <DialogDescription>
              Create a new lead from this call
              {selectedCallForLead?.phone_number && (
                <span className="block mt-1 font-medium text-foreground">
                  {formatPhoneNumber(selectedCallForLead.phone_number)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Name *</Label>
              <Input
                id="lead-name"
                placeholder="Enter lead name"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="Enter email address"
                value={newLeadEmail}
                onChange={(e) => setNewLeadEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-company">Company</Label>
              <Input
                id="lead-company"
                placeholder="Enter company name"
                value={newLeadCompany}
                onChange={(e) => setNewLeadCompany(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddLeadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLead}
              disabled={addLeadMutation.isPending || !newLeadName.trim()}
            >
              {addLeadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default EvansCalls;
