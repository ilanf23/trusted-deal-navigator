import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OutboundCallCard } from '@/components/evan/OutboundCallCard';
import { 
  Phone, 
  User, 
  Building2, 
  Mail, 
  Calendar, 
  DollarSign, 
  Clock, 
  Loader2,
  AlertCircle,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  History,
  UserPlus,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  state: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState<CallLog | null>(null);
  const [retryingTranscriptId, setRetryingTranscriptId] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<CallLog | null>(null);
  
  // Get pre-filled phone from URL params (from pipeline redirect)
  const prefilledPhone = searchParams.get('phone');
  const prefilledLeadId = searchParams.get('leadId');
  
  // Clear URL params after reading them (so refresh doesn't re-fill)
  useEffect(() => {
    if (prefilledPhone || prefilledLeadId) {
      // Clear params after a short delay to allow OutboundCallCard to read them
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prefilledPhone, prefilledLeadId, setSearchParams]);
  
  // Add Lead Dialog state
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [selectedCallForLead, setSelectedCallForLead] = useState<CallLog | null>(null);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  
  // Automation confirmation dialog state
  const [automationConfirmOpen, setAutomationConfirmOpen] = useState(false);
  const [pendingAutomationData, setPendingAutomationData] = useState<{
    leadId: string;
    leadName: string;
    leadEmail: string | null;
    leadPhone: string | null;
    communicationId: string;
    transcript: string | null;
    direction: string;
    callDate: string;
  } | null>(null);
  const [runningAutomation, setRunningAutomation] = useState(false);

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
  
  // Determine which phone number to look up - prioritize selected history call, then active call
  const lookupPhone = selectedHistoryCall?.phone_number || currentCall?.from_number;

  // Fetch lead matching the phone number (from active call or selected history call)
  const { data: matchedLead, isLoading: leadLoading } = useQuery({
    queryKey: ['caller-lead', lookupPhone],
    queryFn: async () => {
      if (!lookupPhone) return null;
      
      // Clean the phone number for comparison
      const cleanedPhone = lookupPhone.replace(/\D/g, '');
      const phoneVariants = [
        lookupPhone,
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
        .maybeSingle();
      
      if (error) throw error;
      return data as Lead | null;
    },
    enabled: !!lookupPhone,
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


  // Add lead mutation with full automation workflow
  const addLeadMutation = useMutation({
    mutationFn: async ({ name, email, phone, company, communicationId, hasTranscript, transcript, direction, callDate }: { 
      name: string; 
      email: string; 
      phone: string; 
      company: string;
      communicationId: string;
      hasTranscript: boolean;
      transcript: string | null;
      direction: string;
      callDate: string;
    }) => {
      // First, get Evan's team_member id
      const { data: evanMember } = await supabase
        .from('team_members')
        .select('id')
        .ilike('name', '%evan%')
        .limit(1)
        .single();

      // Build notes with transcript reference
      const transcriptNote = hasTranscript 
        ? `📞 Initial call: ${callDate}\n📝 Transcript available (Communication ID: ${communicationId})`
        : `📞 Initial call: ${callDate}\n⏳ No transcript available yet`;

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name,
          email: email || null,
          phone,
          company_name: company || null,
          source: 'phone_call',
          status: 'discovery',
          assigned_to: evanMember?.id || null,
          notes: transcriptNote,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return { lead: data, transcript, direction, callDate };
    },
    onSuccess: async (result, variables) => {
      const { lead, transcript, direction, callDate } = result;
      
      // Update the call record to link to this lead
      if (selectedCallForLead) {
        await supabase
          .from('evan_communications')
          .update({ lead_id: lead.id })
          .eq('id', selectedCallForLead.id);
      }
      
      toast.success(`Lead "${lead.name}" added to Evan's pipeline`);
      
      // Store data for potential automation and show confirmation dialog
      setPendingAutomationData({
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        communicationId: variables.communicationId,
        transcript: transcript,
        direction: direction,
        callDate: callDate,
      });
      
      queryClient.invalidateQueries({ queryKey: ['evan-call-history'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      setAddLeadDialogOpen(false);
      setSelectedCallForLead(null);
      setNewLeadName('');
      setNewLeadEmail('');
      setNewLeadCompany('');
      
      // Show automation confirmation dialog
      setAutomationConfirmOpen(true);
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
    
    const callDate = selectedCallForLead ? format(new Date(selectedCallForLead.created_at), 'MMM d, yyyy h:mm a') : '';
    
    addLeadMutation.mutate({
      name: newLeadName.trim(),
      email: newLeadEmail.trim(),
      phone: selectedCallForLead.phone_number,
      company: newLeadCompany.trim(),
      communicationId: selectedCallForLead.id,
      hasTranscript: !!selectedCallForLead.transcript,
      transcript: selectedCallForLead.transcript || null,
      direction: selectedCallForLead.direction,
      callDate: callDate,
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

  // Run automation workflow
  const handleRunAutomation = async () => {
    if (!pendingAutomationData) return;
    
    setRunningAutomation(true);
    toast.info('Running automation workflow...', { duration: 2000 });
    
    try {
      const { data: automationResult, error: automationError } = await supabase.functions.invoke('call-to-lead-automation', {
        body: {
          leadId: pendingAutomationData.leadId,
          communicationId: pendingAutomationData.communicationId,
          leadName: pendingAutomationData.leadName,
          leadEmail: pendingAutomationData.leadEmail,
          leadPhone: pendingAutomationData.leadPhone,
          transcript: pendingAutomationData.transcript,
          callDirection: pendingAutomationData.direction,
          callDate: pendingAutomationData.callDate,
        },
      });

      if (automationError) {
        console.error('Automation error:', automationError);
        toast.error('Automation partially failed - check tasks manually');
      } else {
        console.log('Automation result:', automationResult);
        const rating = automationResult?.callRating;
        const draftCreated = automationResult?.gmailDraftCreated;
        
        if (rating) {
          const draftMessage = draftCreated 
            ? ', Gmail draft ready' 
            : (pendingAutomationData?.leadEmail ? '' : ' (no email for draft)');
          toast.success(`✅ Task created, call rated ${rating}/10${draftMessage}`);
        } else {
          toast.success('✅ Follow-up task created');
        }
        
        // Refresh Gmail emails if draft was created
        if (draftCreated) {
          queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
        }
        queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      }
    } catch (err) {
      console.error('Failed to run automation:', err);
      toast.error('Automation failed - create follow-up task manually');
    } finally {
      setRunningAutomation(false);
      setAutomationConfirmOpen(false);
      setPendingAutomationData(null);
    }
  };

  const handleSkipAutomation = () => {
    setAutomationConfirmOpen(false);
    setPendingAutomationData(null);
    toast.info('Automation skipped - lead created without follow-up task');
  };

  const isLoading = callsLoading;

  if (isLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </EvanLayout>
    );
  }

  return (
    <EvanLayout>
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
          <div className="lg:col-span-2 space-y-6">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">
                      {selectedHistoryCall 
                        ? (selectedHistoryCall.direction === 'outbound' ? 'Contact Information' : 'Caller Information')
                        : 'Caller Information'}
                    </CardTitle>
                  </div>
                  {selectedHistoryCall && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => setSelectedHistoryCall(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {selectedHistoryCall && (
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    {selectedHistoryCall.direction === 'inbound' ? (
                      <PhoneIncoming className="h-3.5 w-3.5" />
                    ) : (
                      <PhoneOutgoing className="h-3.5 w-3.5" />
                    )}
                    {selectedHistoryCall.direction === 'inbound' ? 'Inbound' : 'Outbound'} call on {format(new Date(selectedHistoryCall.created_at), 'MMM d, yyyy')}
                  </CardDescription>
                )}
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
                      {selectedHistoryCall
                        ? 'No matching lead found for this number'
                        : currentCall 
                          ? 'No matching lead found for this number'
                          : 'Click on a call in the history or wait for an incoming call'}
                    </p>
                    {selectedHistoryCall && !matchedLead && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleOpenAddLeadDialog(selectedHistoryCall)}
                      >
                        <UserPlus className="h-4 w-4 mr-1.5" />
                        Create Lead
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Call History Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">Call History</CardTitle>
                      <CardDescription>
                        {directionFilter === 'all' 
                          ? `${callHistory.length} calls` 
                          : `${callHistory.filter(c => c.direction === directionFilter).length} ${directionFilter} calls`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={directionFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDirectionFilter('all')}
                      className="h-8 px-3"
                    >
                      All
                    </Button>
                    <Button
                      variant={directionFilter === 'inbound' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDirectionFilter('inbound')}
                      className="h-8 px-3"
                    >
                      <PhoneIncoming className="h-3.5 w-3.5 mr-1" />
                      In
                    </Button>
                    <Button
                      variant={directionFilter === 'outbound' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDirectionFilter('outbound')}
                      className="h-8 px-3"
                    >
                      <PhoneOutgoing className="h-3.5 w-3.5 mr-1" />
                      Out
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[430px]">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : callHistory.filter(c => directionFilter === 'all' || c.direction === directionFilter).length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">
                        {directionFilter === 'all' ? 'No call history yet' : `No ${directionFilter} calls`}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {callHistory
                        .filter(c => directionFilter === 'all' || c.direction === directionFilter)
                        .map((call) => (
                        <div
                          key={call.id}
                          className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedHistoryCall?.id === call.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                          }`}
                          onClick={() => setSelectedHistoryCall(selectedHistoryCall?.id === call.id ? null : call)}
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
                                  {/* Add as Lead button - always show for calls with phone numbers */}
                                  {call.phone_number && (
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

          {/* Right Column - Outbound Call */}
          <div className="space-y-6">
            <OutboundCallCard initialPhone={prefilledPhone || undefined} initialLeadId={prefilledLeadId || undefined} />
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

      {/* Automation Confirmation Dialog */}
      <Dialog open={automationConfirmOpen} onOpenChange={(open) => {
        if (!open && !runningAutomation) {
          handleSkipAutomation();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-admin-blue" />
              Run Automation?
            </DialogTitle>
            <DialogDescription>
              Would you like to run the automation workflow for this lead? This will:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-admin-teal">•</span>
                Analyze the call transcript with AI
              </li>
              <li className="flex items-start gap-2">
                <span className="text-admin-teal">•</span>
                Rate the lead quality (1-10)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-admin-teal">•</span>
                Create a follow-up task in your tasks list
              </li>
              <li className="flex items-start gap-2">
                <span className="text-admin-teal">•</span>
                Draft a personalized follow-up email in Gmail
              </li>
              <li className="flex items-start gap-2">
                <span className="text-admin-teal">•</span>
                Send rating notification to Adam & Brad
              </li>
            </ul>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleSkipAutomation}
              disabled={runningAutomation}
            >
              Skip
            </Button>
            <Button
              onClick={handleRunAutomation}
              disabled={runningAutomation}
              className="bg-admin-blue hover:bg-admin-blue/90"
            >
              {runningAutomation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run Automation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EvanLayout>
  );
};

export default EvansCalls;
