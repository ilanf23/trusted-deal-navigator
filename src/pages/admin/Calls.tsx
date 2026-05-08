import { useState, useEffect, useMemo } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { OutboundCallCard } from '@/components/employee/OutboundCallCard';
import { useCall } from '@/contexts/CallContext';
import { useAuth } from '@/contexts/AuthContext';
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
  PhoneMissed,
  History,
  UserPlus,
  Sparkles,
  Play,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';

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
  user_id?: string | null;
  pipeline?: {
    name: string;
    company_name: string | null;
  } | null;
}

type StatusFilter = 'all' | 'completed' | 'missed' | 'failed';
type DateRangeFilter = 'today' | '7d' | '30d' | 'all';
type TranscriptStatus = 'available' | 'generating' | 'pending' | 'no-recording';

const MISSED_STATUSES = new Set(['missed', 'no-answer', 'busy', 'canceled', 'cancelled']);
const FAILED_STATUSES = new Set(['failed']);

const formatCurrency = (amount: number | null) => {
  if (amount === null || amount === undefined) return 'N/A';
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

const isMissedStatus = (status: string | null): boolean => {
  if (!status) return false;
  return MISSED_STATUSES.has(status);
};

const isFailedStatus = (status: string | null): boolean => {
  if (!status) return false;
  return FAILED_STATUSES.has(status);
};

const getDateThreshold = (range: DateRangeFilter): Date | null => {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    default:
      return null;
  }
};

const getTranscriptStatus = (
  call: CallLog,
  generatingId: string | null,
): TranscriptStatus => {
  if (call.transcript && call.transcript.trim().length > 0) return 'available';
  if (generatingId === call.id) return 'generating';
  if (call.recording_url) return 'pending';
  return 'no-recording';
};

const getCallStatusBadge = (status: string | null) => {
  if (!status) return null;
  if (status === 'completed') {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] h-5 px-1.5">
        Completed
      </Badge>
    );
  }
  if (isMissedStatus(status)) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5 px-1.5">
        {status === 'no-answer' ? 'No answer' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  }
  if (isFailedStatus(status)) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200 text-[10px] h-5 px-1.5">
        Failed
      </Badge>
    );
  }
  if (status === 'in-progress' || status === 'ringing') {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] h-5 px-1.5">
        {status === 'ringing' ? 'Ringing' : 'In progress'}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
      {status}
    </Badge>
  );
};

const getTranscriptBadge = (ts: TranscriptStatus) => {
  switch (ts) {
    case 'available':
      return (
        <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] h-5 px-1.5">
          <FileText className="h-2.5 w-2.5 mr-1" /> Transcript
        </Badge>
      );
    case 'generating':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] h-5 px-1.5">
          <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> Generating…
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5">
          Pending
        </Badge>
      );
    case 'no-recording':
      return (
        <Badge variant="outline" className="text-muted-foreground text-[10px] h-5 px-1.5">
          No recording
        </Badge>
      );
  }
};

const Calls = () => {
  const { teamMember } = useTeamMember();
  const { isAdmin } = useAuth();
  usePageDatabases([
    { table: 'active_calls', access: 'read', usage: 'Live call state for in-progress Twilio sessions.', via: 'src/contexts/CallContext.tsx' },
    { table: 'call_events', access: 'read', usage: 'Historical call timeline/events shown in the list.', via: 'useQuery in Calls.tsx' },
    { table: 'communications', access: 'read', usage: 'Completed calls persisted as communications records.', via: 'useQuery in Calls.tsx' },
    { table: 'communications', access: 'write', usage: 'Linking a call to a newly created lead via lead_id update.', via: 'addLeadMutation in Calls.tsx' },
    { table: 'potential', access: 'read', usage: 'Linked lead/deal context for each call row.', via: 'useQuery in Calls.tsx' },
    { table: 'potential', access: 'write', usage: 'Creating leads from inbound calls (Add Lead dialog).', via: 'addLeadMutation in Calls.tsx' },
    { table: 'pipeline', access: 'read', usage: 'Joined for company/deal context on call history rows.', via: 'callHistory query in Calls.tsx' },
    { table: 'deal_responses', access: 'read', usage: 'Loan questionnaire details rendered for the matched lead.', via: 'leadResponse query in Calls.tsx' },
    { table: 'twilio-call-history', access: 'rpc', usage: 'Edge function fetching call history from Twilio API and enriching with communications rows by call_sid.', via: 'supabase.functions.invoke("twilio-call-history")' },
    { table: 'retry-call-transcription', access: 'rpc', usage: 'Edge function re-triggering Whisper + Gemini speaker labeling on a stored recording.', via: 'supabase.functions.invoke("retry-call-transcription")' },
    { table: 'call-to-lead-automation', access: 'rpc', usage: 'Edge function auto-creating leads from unknown inbound numbers.', via: 'supabase.functions.invoke("call-to-lead-automation")' },
  ]);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { outboundCall, makeOutboundCall } = useCall();

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Calls');
    return () => { setPageTitle(null); };
  }, [setPageTitle]);

  // The user is set up for calling iff they have a Twilio phone number assigned on
  // their users row. Sourced via useTeamMember(); no extra query needed.
  const hasCallSetup = !!teamMember?.twilio_phone_number;

  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState<CallLog | null>(null);
  const [retryingTranscriptId, setRetryingTranscriptId] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<CallLog | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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

  // Fetch active/recent calls. Admins and super_admins see every active call
  // in the system; employees see their own + rows with a null user_id (the
  // outbound backstop where server-side attribution wasn't possible).
  const { data: activeCalls = [], isLoading: callsLoading } = useQuery({
    queryKey: ['active-calls', teamMember?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('active_calls')
        .select('*')
        .in('status', ['ringing', 'in-progress'])
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      if (teamMember?.id && !isAdmin) {
        query = query.or(`user_id.eq.${teamMember.id},user_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ActiveCall[];
    },
    refetchInterval: 30000,
    enabled: !!teamMember?.id,
  });

  // Fetch call history from Twilio (source of truth) via the
  // `twilio-call-history` edge function, enriched with `communications` rows
  // by call_sid for transcript / recording / lead linkage. Twilio is the
  // authoritative list — webhook drops or attribution gaps no longer cause
  // calls to disappear from this view.
  const { data: callHistory = [], isLoading: historyLoading, refetch: refetchHistory, isRefetching: isRefetchingHistory } = useQuery({
    queryKey: ['call-history', teamMember?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('twilio-call-history', {
        body: { pageSize: 200 },
      });
      if (error) throw error;
      return ((data?.calls ?? []) as CallLog[]);
    },
    enabled: !!teamMember?.id,
    // Twilio's REST API is rate-limited; refresh less aggressively than the
    // old direct DB query and rely on the manual refresh button for live updates.
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // If the transcript arrives after the dialog is opened, refresh the dialog content
  useEffect(() => {
    if (!selectedTranscriptCall?.id) return;
    const updated = callHistory.find((c) => c.id === selectedTranscriptCall.id);
    if (updated && updated.transcript !== selectedTranscriptCall.transcript) {
      setSelectedTranscriptCall(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when callHistory changes or the selected call ID changes, not on transcript text change
  }, [callHistory, selectedTranscriptCall?.id]);

  const currentCall = activeCalls[0];

  // Determine which phone number to look up - prioritize: selected history > outbound call > prefilled > active inbound
  const lookupPhone = selectedHistoryCall?.phone_number
    || outboundCall?.phoneNumber
    || prefilledPhone
    || currentCall?.from_number;

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
        .from('potential')
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
        .from('deal_responses')
        .select('*')
        .eq('entity_id', matchedLead.id)
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
      // Assign new lead to the rep who took the call (current user).
      const transcriptNote = hasTranscript
        ? `📞 Initial call: ${callDate}\n📝 Transcript available (Communication ID: ${communicationId})`
        : `📞 Initial call: ${callDate}\n⏳ No transcript available yet`;

      const { data, error } = await supabase
        .from('potential')
        .insert({
          name,
          email: email || null,
          phone,
          company_name: company || null,
          source: 'phone_call',
          status: 'discovery',
          assigned_to: teamMember?.id || null,
          notes: transcriptNote,
        })
        .select()
        .single();

      if (error) throw error;

      return { lead: data, transcript, direction, callDate };
    },
    onSuccess: async (result, _variables) => {
      const { lead } = result;

      // Update the call record to link to this lead
      if (selectedCallForLead) {
        await supabase
          .from('communications')
          .update({ lead_id: lead.id })
          .eq('id', selectedCallForLead.id);
      }

      const ownerPipelineLabel = teamMember?.name ? `${teamMember.name}'s pipeline` : 'your pipeline';
      toast.success(`Lead "${lead.name}" added to ${ownerPipelineLabel}`);

      queryClient.invalidateQueries({ queryKey: ['call-history'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      setAddLeadDialogOpen(false);
      setSelectedCallForLead(null);
      setNewLeadName('');
      setNewLeadEmail('');
      setNewLeadCompany('');
    },
    onError: (error: Error) => {
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
      } else {
        // Transcript generated successfully — check if this call has a linked lead
        await queryClient.invalidateQueries({ queryKey: ['call-history'] });

        // Re-fetch the updated call to get fresh data
        const { data: updatedComm } = await supabase
          .from('communications')
          .select('id, lead_id, transcript, direction, created_at, phone_number, pipeline(name, email, phone)')
          .eq('id', call.id)
          .single();

        if (updatedComm?.lead_id && updatedComm.pipeline) {
          const leadData = updatedComm.pipeline as unknown as { name: string; email: string | null; phone: string | null };
          const callDate = format(new Date(updatedComm.created_at), 'MMM d, yyyy h:mm a');
          setPendingAutomationData({
            leadId: updatedComm.lead_id,
            leadName: leadData.name,
            leadEmail: leadData.email,
            leadPhone: leadData.phone || updatedComm.phone_number,
            communicationId: updatedComm.id,
            transcript: updatedComm.transcript || data?.transcript || null,
            direction: updatedComm.direction,
            callDate: callDate,
          });
          setAutomationConfirmOpen(true);
        } else {
          toast.success('Transcript generated successfully');
        }
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['call-history'] });
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
          teamMemberId: teamMember?.id,
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
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
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

  const handleRedial = (phone: string | null, leadId: string | null) => {
    if (!phone) {
      toast.error('No phone number on this call');
      return;
    }
    void makeOutboundCall(phone, leadId ?? undefined, undefined);
  };

  const handleRetryTranscriptionInline = async (call: CallLog, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!call.recording_url) {
      toast.error('No recording to transcribe');
      return;
    }
    if (call.transcript) {
      // Force re-generation: clear existing transcript first so the helper
      // re-runs the pipeline. Admins may use this if labeling was wrong.
      const proceed = window.confirm('A transcript already exists. Re-generate it?');
      if (!proceed) return;
      const { error } = await supabase
        .from('communications')
        .update({ transcript: null })
        .eq('id', call.id);
      if (error) {
        toast.error('Failed to clear existing transcript');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['call-history'] });
    }
    await handleGenerateTranscript(call);
    await queryClient.invalidateQueries({ queryKey: ['call-history'] });
  };

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Apply filters: direction, status, date range, free-text search.
  const filteredHistory = useMemo(() => {
    const dateThreshold = getDateThreshold(dateRangeFilter);
    const q = searchQuery.trim().toLowerCase();

    return callHistory.filter((c) => {
      if (directionFilter !== 'all' && c.direction !== directionFilter) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && c.status !== 'completed') return false;
        if (statusFilter === 'missed' && !isMissedStatus(c.status)) return false;
        if (statusFilter === 'failed' && !isFailedStatus(c.status)) return false;
      }

      if (dateThreshold) {
        const created = new Date(c.created_at);
        if (created < dateThreshold) return false;
      }

      if (q.length > 0) {
        const haystack = [
          c.transcript ?? '',
          c.phone_number ?? '',
          c.pipeline?.name ?? '',
          c.pipeline?.company_name ?? '',
          c.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [callHistory, directionFilter, statusFilter, dateRangeFilter, searchQuery]);

  if (callsLoading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        {/* Phone Number Badge */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-medium">
              {teamMember?.twilio_phone_number
                ? formatPhoneNumber(teamMember.twilio_phone_number)
                : formatPhoneNumber(import.meta.env.VITE_TWILIO_PHONE_NUMBER || '(904) 587-0026')}
            </span>
            {!hasCallSetup && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 ml-1">
                Read-only
              </Badge>
            )}
          </div>
        </div>

        {!hasCallSetup && teamMember && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Calling isn't configured for your account yet, so the dialer and live-call panel are disabled. You can still review the full call history below. Ask the dev builder to assign a Twilio number to enable outbound dialing.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left Column - Command Panel: Active Call, Dialer, Lead Info */}
          <div className="lg:col-span-2 space-y-3">
            {/* Section: Call Status */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">Status</p>
            {!hasCallSetup ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20">
                <Phone className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground/60">
                  Live calls disabled — no Twilio number assigned
                </span>
              </div>
            ) : currentCall ? (
              <Card className="border-2 border-green-500/50 bg-green-50/30 rounded-lg">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-green-500 animate-pulse">
                      <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Active Call</CardTitle>
                      <CardDescription>Status: {currentCall.status}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="p-4 rounded-lg bg-background border">
                    <p className="text-2xl font-semibold text-center">
                      {formatPhoneNumber(currentCall.from_number)}
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {format(new Date(currentCall.created_at), 'h:mm a')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20">
                <Phone className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground/60">No active call</span>
              </div>
            )}

            {/* Section: Dialer */}
            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-3">Dialer</p>
              {hasCallSetup ? (
                <OutboundCallCard initialPhone={prefilledPhone || undefined} initialLeadId={prefilledLeadId || undefined} />
              ) : (
                <Card className="rounded-lg border-dashed">
                  <CardContent className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Outbound dialing is disabled until a Twilio number is assigned to your account.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Section: Contact Info */}
            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-3">Contact</p>
              <Card className="rounded-lg">
              <CardHeader className="pb-3 pt-4 px-4">
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
              <CardContent className="px-4 pb-4">
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
                      <div className="p-4 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20">
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
            </div>
          </div>

          {/* Right Column - Call History (dominant, full-fidelity) */}
          <div className="lg:col-span-3">
            <Card className="h-full rounded-lg">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">Call History</CardTitle>
                      <CardDescription>
                        {filteredHistory.length === callHistory.length
                          ? `${callHistory.length} calls`
                          : `${filteredHistory.length} of ${callHistory.length} calls`}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => refetchHistory()}
                    disabled={isRefetchingHistory}
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefetchingHistory ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* Filter row */}
                {(() => {
                  const hasActiveFilter =
                    directionFilter !== 'all' ||
                    statusFilter !== 'all' ||
                    dateRangeFilter !== 'all';

                  const segmentBase =
                    'h-7 px-2.5 text-xs font-medium rounded-[5px] transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
                  const segmentActive = 'bg-background text-foreground shadow-sm';
                  const segmentIdle =
                    'text-muted-foreground hover:text-foreground';

                  const directionOptions = [
                    { value: 'all' as const, label: 'All', icon: null },
                    { value: 'inbound' as const, label: 'In', icon: PhoneIncoming },
                    { value: 'outbound' as const, label: 'Out', icon: PhoneOutgoing },
                  ];
                  const dateOptions: { value: DateRangeFilter; label: string }[] = [
                    { value: 'today', label: 'Today' },
                    { value: '7d', label: '7d' },
                    { value: '30d', label: '30d' },
                    { value: 'all', label: 'All time' },
                  ];

                  return (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          role="radiogroup"
                          aria-label="Direction"
                          className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5"
                        >
                          {directionOptions.map(({ value, label, icon: Icon }) => {
                            const active = directionFilter === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setDirectionFilter(value)}
                                className={cn(segmentBase, active ? segmentActive : segmentIdle)}
                              >
                                {Icon ? <Icon className="h-3 w-3" /> : null}
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        <div
                          role="radiogroup"
                          aria-label="Date range"
                          className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5"
                        >
                          {dateOptions.map(({ value, label }) => {
                            const active = dateRangeFilter === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setDateRangeFilter(value)}
                                className={cn(segmentBase, active ? segmentActive : segmentIdle)}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        <Select
                          value={statusFilter}
                          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                          <SelectTrigger
                            aria-label="Status"
                            className="h-8 w-[140px] text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any status</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="missed">
                              <span className="inline-flex items-center gap-1.5">
                                <PhoneMissed className="h-3 w-3 text-red-500" /> Missed
                              </span>
                            </SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>

                        {hasActiveFilter && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDirectionFilter('all');
                              setStatusFilter('all');
                              setDateRangeFilter('all');
                            }}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </Button>
                        )}
                      </div>

                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search transcript, phone, deal, company…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                    </div>
                  );
                })()}
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">
                        {callHistory.length === 0 ? 'No call history yet' : 'No calls match these filters'}
                      </p>
                      {callHistory.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => {
                            setDirectionFilter('all');
                            setStatusFilter('all');
                            setDateRangeFilter('all');
                            setSearchQuery('');
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredHistory.map((call) => {
                        const isExpanded = !!expandedRows[call.id];
                        const isSelected = selectedHistoryCall?.id === call.id;
                        const ts = getTranscriptStatus(call, retryingTranscriptId);
                        const missed = isMissedStatus(call.status);
                        const failed = isFailedStatus(call.status);
                        const Icon = missed || failed
                          ? PhoneMissed
                          : call.direction === 'inbound'
                            ? PhoneIncoming
                            : PhoneOutgoing;
                        const iconWrapClass = missed || failed
                          ? 'bg-red-100 text-red-600'
                          : call.direction === 'inbound'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-blue-100 text-blue-600';

                        return (
                          <div
                            key={call.id}
                            className={`p-3 transition-colors ${
                              isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                            }`}
                          >
                            <div
                              className="flex items-start gap-3 cursor-pointer"
                              onClick={() => setSelectedHistoryCall(isSelected ? null : call)}
                            >
                              <div className={`p-2 rounded-full shrink-0 ${iconWrapClass}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm truncate">
                                    {call.pipeline?.name || formatPhoneNumber(call.phone_number || 'Unknown')}
                                  </p>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(call.duration_seconds)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span>
                                    {call.phone_number ? formatPhoneNumber(call.phone_number) : 'No number'}
                                  </span>
                                  {call.pipeline?.company_name && (
                                    <span>• {call.pipeline.company_name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[11px] text-muted-foreground">
                                    {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
                                  </span>
                                  {getCallStatusBadge(call.status)}
                                  {getTranscriptBadge(ts)}
                                </div>
                              </div>
                            </div>

                            {/* Per-row action bar */}
                            <div className="mt-2 flex items-center gap-1 flex-wrap pl-11">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                title="Redial"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRedial(call.phone_number, call.lead_id);
                                }}
                              >
                                <Phone className="h-3 w-3 mr-1" /> Redial
                              </Button>

                              {(call.recording_url || call.transcript) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRowExpanded(call.id);
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 mr-1" />
                                  )}
                                  {isExpanded ? 'Hide' : 'Play / view'}
                                </Button>
                              )}

                              {call.recording_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={retryingTranscriptId === call.id}
                                  onClick={(e) => handleRetryTranscriptionInline(call, e)}
                                  title={call.transcript ? 'Re-generate transcript' : 'Generate transcript'}
                                >
                                  {retryingTranscriptId === call.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  {call.transcript ? 'Re-transcribe' : 'Transcribe'}
                                </Button>
                              )}

                              {call.transcript && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTranscriptCall(call);
                                    setTranscriptDialogOpen(true);
                                    setTranscriptError(null);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Open
                                </Button>
                              )}

                              {call.lead_id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs ml-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedHistoryCall(call);
                                  }}
                                >
                                  <User className="h-3 w-3 mr-1" /> Open lead
                                </Button>
                              ) : call.phone_number ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs ml-auto text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddLeadDialog(call);
                                  }}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" /> Add lead
                                </Button>
                              ) : null}
                            </div>

                            {/* Expanded panel: audio + inline transcript preview */}
                            {isExpanded && (call.recording_url || call.transcript) && (
                              <div className="mt-2 ml-11 space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
                                {call.recording_url && (
                                  <div className="flex items-center gap-2">
                                    <Play className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <audio
                                      controls
                                      preload="none"
                                      src={call.recording_url}
                                      className="h-8 w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                                {call.transcript ? (
                                  <div>
                                    <div className="flex items-center gap-1 mb-1">
                                      <FileText className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        Transcript
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
                                      {call.transcript}
                                    </p>
                                  </div>
                                ) : ts === 'pending' ? (
                                  <p className="text-[11px] text-muted-foreground italic">
                                    Recording saved — transcript will appear automatically once Whisper finishes (usually under a minute).
                                  </p>
                                ) : ts === 'generating' ? (
                                  <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Generating transcript…
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
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
                  {selectedTranscriptCall.pipeline?.name || formatPhoneNumber(selectedTranscriptCall.phone_number || 'Unknown')}
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
    </EmployeeLayout>
  );
};

export default Calls;
