import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
  ChevronLeft,
  ChevronRight,
  Loader2,
  PhoneOff,
  AlertCircle,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  History,
  UserPlus,
  Sparkles,
  MessageSquare,
  Plus,
  Filter,
  X
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
  state: string | null;
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
  call_status: string | null;
  location: string | null;
  looking_for: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  lender_type: string | null;
  loan_types: string | null;
  states: string | null;
  loan_size_text: string | null;
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
  const navigate = useNavigate();
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
  
  // AI Assistant state
  const [showAssistant, setShowAssistant] = useState(true);
  
  // Lender filter panel state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [lenderFilters, setLenderFilters] = useState({
    institution: '',
    lookingFor: '',
    contact: '',
    loanSize: '',
    states: '',
    lenderType: '',
    loanTypes: '',
  });

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

  // Fetch all lender programs (flat list for the new design)
  const { data: allPrograms = [], isLoading: programsLoading } = useQuery({
    queryKey: ['lender-programs-flat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('lender_name', { ascending: true });

      if (error) throw error;
      return data as Program[];
    },
  });

  // Also keep grouped for backward compatibility
  const lenders = useMemo(() => {
    const grouped = allPrograms.reduce((acc: Record<string, GroupedLender>, program) => {
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
  }, [allPrograms]);

  // Build lead context for fit matching
  const leadContext = useMemo(() => {
    if (!matchedLead && !leadResponse) return null;
    return {
      name: matchedLead?.name,
      loanAmount: leadResponse?.loan_amount || undefined,
      loanType: leadResponse?.loan_type || undefined,
      state: leadResponse?.state || undefined,
      propertyType: leadResponse?.business_type || undefined,
    };
  }, [matchedLead, leadResponse]);

  // Valid US state abbreviations
  const VALID_STATE_ABBREVS = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]);

  // Standardized loan size categories (10 buckets)
  const LOAN_SIZE_CATEGORIES = [
    { label: 'Under $100K', min: 0, max: 100000 },
    { label: '$100K - $250K', min: 100000, max: 250000 },
    { label: '$250K - $500K', min: 250000, max: 500000 },
    { label: '$500K - $1M', min: 500000, max: 1000000 },
    { label: '$1M - $2.5M', min: 1000000, max: 2500000 },
    { label: '$2.5M - $5M', min: 2500000, max: 5000000 },
    { label: '$5M - $10M', min: 5000000, max: 10000000 },
    { label: '$10M - $25M', min: 10000000, max: 25000000 },
    { label: '$25M - $50M', min: 25000000, max: 50000000 },
    { label: '$50M+', min: 50000000, max: Infinity },
  ];

  // Parse loan size text to extract numeric values
  const parseLoanSizeText = (text: string | null): { min: number; max: number } | null => {
    if (!text) return null;
    const cleaned = text.replace(/[$,]/g, '').toLowerCase().trim();
    
    // Extract numbers with K/M/B suffixes
    const parseNumber = (str: string): number => {
      const match = str.match(/([\d.]+)\s*(k|m|mm|b|million|mil)?/i);
      if (!match) return 0;
      let num = parseFloat(match[1]);
      const suffix = (match[2] || '').toLowerCase();
      if (suffix === 'k') num *= 1000;
      else if (suffix === 'm' || suffix === 'mm' || suffix === 'million' || suffix === 'mil') num *= 1000000;
      else if (suffix === 'b') num *= 1000000000;
      // If no suffix and number is small (likely in millions written as "1-10" meaning 1M-10M)
      else if (num <= 100 && !suffix) {
        // Check if context suggests millions (common in loan industry)
        if (cleaned.includes('mm') || cleaned.includes('million') || cleaned.includes('mil')) {
          num *= 1000000;
        }
      }
      return num;
    };

    // Look for range patterns like "1M - 5M" or "1-5M" or "$1M-$5M" or "1MM-10MM"
    const rangeMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*[-–to]+\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (rangeMatch) {
      const min = parseNumber(rangeMatch[1]);
      const max = parseNumber(rangeMatch[2]);
      // If both numbers are small and no suffix, they might be in millions
      if (min <= 100 && max <= 100 && min > 0) {
        return { min: min * 1000000, max: max * 1000000 };
      }
      return { min, max };
    }

    // Look for "up to" or "max" patterns
    const upToMatch = cleaned.match(/up\s*to\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (upToMatch) {
      return { min: 0, max: parseNumber(upToMatch[1]) };
    }

    // Look for "minimum" or "min" patterns like "min $1M" or "$1M minimum"
    const minMatch = cleaned.match(/(?:min(?:imum)?)\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i) ||
                     cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*(?:min(?:imum)?|\+)/i);
    if (minMatch) {
      return { min: parseNumber(minMatch[1]), max: Infinity };
    }

    // Look for single number with + (e.g., "$1M+")
    const plusMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*\+/i);
    if (plusMatch) {
      return { min: parseNumber(plusMatch[1]), max: Infinity };
    }

    // Look for single number (treat as approximate - use as both min and max with some flex)
    const singleMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (singleMatch) {
      const val = parseNumber(singleMatch[1]);
      // For single values, assume they can go somewhat below and above
      return { min: val * 0.5, max: val * 2 };
    }

    return null;
  };

  // Check if a program's loan size falls within a category
  const programMatchesLoanCategory = (program: Program, categoryLabel: string): boolean => {
    const category = LOAN_SIZE_CATEGORIES.find(c => c.label === categoryLabel);
    if (!category) return false;

    const programRange = parseLoanSizeText(program.loan_size_text);
    if (!programRange) return false;

    // For the last category ($50M+), check if program handles loans at or above $50M
    if (category.max === Infinity) {
      return programRange.max >= category.min;
    }

    // A lender matches a category if:
    // 1. Their minimum is not above the category maximum (they can do loans small enough)
    // 2. Their maximum is not below the category minimum (they can do loans large enough)
    // This is true overlap logic
    const lenderCanDoSmallEnough = programRange.min <= category.max;
    const lenderCanDoLargeEnough = programRange.max >= category.min;
    
    return lenderCanDoSmallEnough && lenderCanDoLargeEnough;
  };

  // Filter lender programs based on individual filters
  const filteredPrograms = useMemo(() => {
    return allPrograms.filter((program) => {
      if (lenderFilters.institution && program.lender_name !== lenderFilters.institution) return false;
      if (lenderFilters.lookingFor && !program.looking_for?.toLowerCase().includes(lenderFilters.lookingFor.toLowerCase())) return false;
      if (lenderFilters.contact && program.contact_name !== lenderFilters.contact) return false;
      if (lenderFilters.loanSize && !programMatchesLoanCategory(program, lenderFilters.loanSize)) return false;
      if (lenderFilters.states && !program.states?.toLowerCase().includes(lenderFilters.states.toLowerCase())) return false;
      if (lenderFilters.lenderType && program.lender_type !== lenderFilters.lenderType) return false;
      if (lenderFilters.loanTypes && !program.loan_types?.toLowerCase().includes(lenderFilters.loanTypes.toLowerCase())) return false;
      return true;
    });
  }, [allPrograms, lenderFilters]);


  const hasActiveFilters = Object.values(lenderFilters).some(v => v.trim() !== '');

  const clearAllFilters = () => {
    setLenderFilters({
      institution: '',
      lookingFor: '',
      contact: '',
      loanSize: '',
      states: '',
      lenderType: '',
      loanTypes: '',
    });
  };

  // Extract unique values for dropdown options

  const filterOptions = useMemo(() => {
    const getUniqueValues = (key: keyof Program) => {
      const values = allPrograms
        .map(p => p[key])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim());
      return [...new Set(values)].sort();
    };

    // For states, split by comma and get unique individual states (only valid abbreviations)
    const getUniqueStates = () => {
      const states = allPrograms
        .flatMap(p => (p.states || '').split(/[,\s]+/).map(s => s.trim().toUpperCase()))
        .filter(s => VALID_STATE_ABBREVS.has(s));
      return [...new Set(states)].sort();
    };

    // For loan types, split by comma and get unique individual types
    const getUniqueLoanTypes = () => {
      const types = allPrograms
        .flatMap(p => (p.loan_types || '').split(',').map(t => t.trim()))
        .filter(t => t !== '');
      return [...new Set(types)].sort();
    };

    return {
      institutions: getUniqueValues('lender_name'),
      contacts: getUniqueValues('contact_name'),
      phones: getUniqueValues('phone'),
      loanSizes: LOAN_SIZE_CATEGORIES.map(c => c.label),
      states: getUniqueStates(),
      lenderTypes: getUniqueValues('lender_type'),
      loanTypes: getUniqueLoanTypes(),
    };
  }, [allPrograms]);

  const toggleLender = (lenderName: string) => {
    setExpandedLenders((prev) => ({
      ...prev,
      [lenderName]: !prev[lenderName],
    }));
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Left Column - Call Info & Lead Details */}
          <div className="lg:col-span-1 flex flex-col gap-6">
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
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Call History</CardTitle>
                    <CardDescription>{callHistory.length} calls</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
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

          {/* Right Column - Lender Programs & AI Assistant */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 h-full">
              {/* Lender Programs */}
              <div className={showAssistant ? "xl:col-span-3" : "xl:col-span-5"}>
              <Card className="h-full flex flex-col border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                  <CardHeader className="flex-shrink-0 pb-3 border-b bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-semibold truncate">Lender Programs</CardTitle>
                        <CardDescription className="text-xs truncate">
                          {filteredPrograms.length} programs{leadContext ? ' • Matching to lead' : ''}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          variant={showFilterPanel ? "default" : "outline"}
                          size="sm"
                          onClick={() => setShowFilterPanel(!showFilterPanel)}
                          className="gap-1 text-xs"
                        >
                          <Filter className="h-3.5 w-3.5" />
                          Filter
                          {hasActiveFilters && (
                            <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                              {Object.values(lenderFilters).filter(v => v.trim()).length}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/admin/lender-programs')}
                          className="gap-1 text-xs flex-shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                    {filteredPrograms.length === 0 ? (
                      <div className="text-center py-12">
                        <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground text-sm">
                          {allPrograms.length === 0 ? 'No lender programs available' : 'No lenders match your filters'}
                        </p>
                        {allPrograms.length === 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => navigate('/admin/lender-programs')}
                          >
                            Add Lenders
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3"
                            onClick={clearAllFilters}
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="h-full max-h-[800px] overflow-auto">
                        <div className="min-w-[900px]">
                          <Table>
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                              <TableRow className="dark:border-slate-700">
                                <TableHead className="text-xs font-semibold w-[180px] pl-4 dark:text-slate-300">Institution</TableHead>
                                <TableHead className="text-xs font-semibold w-[300px] px-2 dark:text-slate-300">Looking For</TableHead>
                                <TableHead className="text-xs font-semibold w-[120px] px-2 dark:text-slate-300">Contact</TableHead>
                                <TableHead className="text-xs font-semibold w-[130px] px-2 dark:text-slate-300">Phone</TableHead>
                                <TableHead className="text-xs font-semibold w-[100px] px-2 dark:text-slate-300">Loan Size</TableHead>
                                <TableHead className="text-xs font-semibold w-[120px] px-2 dark:text-slate-300">States</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPrograms.map((program) => (
                                <TableRow key={program.id} className="min-h-[48px] dark:border-slate-700 dark:hover:bg-slate-800/50">
                                  <TableCell className="py-2 pl-4 pr-2">
                                    <div className="font-medium text-sm dark:text-slate-100">{program.lender_name}</div>
                                    {program.lender_type && (
                                      <div className="text-xs text-muted-foreground dark:text-slate-400">{program.lender_type}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 px-2">
                                    <div className="text-sm whitespace-pre-wrap break-words line-clamp-3 dark:text-slate-200">
                                      {program.looking_for || program.description || '—'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 px-2">
                                    <div className="text-sm dark:text-slate-200">{program.contact_name || '—'}</div>
                                  </TableCell>
                                  <TableCell className="py-2 px-2">
                                    {program.phone ? (
                                      <a href={`tel:${program.phone}`} className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
                                        {program.phone}
                                      </a>
                                    ) : (
                                      <span className="text-sm text-muted-foreground dark:text-slate-500">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 px-2">
                                    <div className="text-sm dark:text-slate-200">{program.loan_size_text || '—'}</div>
                                  </TableCell>
                                  <TableCell className="py-2 px-2">
                                    <div className="text-sm truncate max-w-[100px] dark:text-slate-200" title={program.states || ''}>
                                      {program.states || '—'}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Filter Panel - Separate collapsible card */}
              {showFilterPanel ? (
                <div className="xl:col-span-2 h-full">
                  <Card className="h-full flex flex-col border-slate-300">
                    <CardHeader 
                      className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors bg-slate-50"
                      onClick={() => setShowFilterPanel(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-700">
                            <Filter className="h-4 w-4 text-white" />
                          </div>
                          <CardTitle className="text-base">Filter Lenders</CardTitle>
                          {hasActiveFilters && (
                            <Badge variant="secondary" className="text-xs">
                              {Object.values(lenderFilters).filter(v => v.trim()).length} active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasActiveFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearAllFilters();
                              }}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          )}
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 min-h-0 overflow-auto">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Institution</Label>
                          <SearchableSelect
                            options={filterOptions.institutions}
                            value={lenderFilters.institution}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, institution: value }))}
                            placeholder="All institutions"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Looking For</Label>
                          <Input
                            placeholder="Type to search..."
                            value={lenderFilters.lookingFor}
                            onChange={(e) => setLenderFilters(prev => ({ ...prev, lookingFor: e.target.value }))}
                            className="h-8 text-sm pl-3"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Contact Name</Label>
                          <SearchableSelect
                            options={filterOptions.contacts}
                            value={lenderFilters.contact}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, contact: value }))}
                            placeholder="All contacts"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Loan Size</Label>
                          <SearchableSelect
                            options={filterOptions.loanSizes}
                            value={lenderFilters.loanSize}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, loanSize: value }))}
                            placeholder="All loan sizes"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">States</Label>
                          <SearchableSelect
                            options={filterOptions.states}
                            value={lenderFilters.states}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, states: value }))}
                            placeholder="All states"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Lender Type</Label>
                          <SearchableSelect
                            options={filterOptions.lenderTypes}
                            value={lenderFilters.lenderType}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, lenderType: value }))}
                            placeholder="All lender types"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Loan Types</Label>
                          <SearchableSelect
                            options={filterOptions.loanTypes}
                            value={lenderFilters.loanTypes}
                            onValueChange={(value) => setLenderFilters(prev => ({ ...prev, loanTypes: value }))}
                            placeholder="All loan types"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : showAssistant ? (
                <div className="xl:col-span-2 h-full">
                  <Card className="h-full flex flex-col border-admin-blue/20">
                    {/* Clickable header to collapse */}
                    <CardHeader 
                      className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setShowAssistant(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-admin-blue to-admin-blue-dark">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <CardTitle className="text-base">Program Advisor</CardTitle>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 min-h-0">
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
                      />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="fixed bottom-20 right-6 z-50">
                  <Button
                    onClick={() => setShowAssistant(true)}
                    className="h-12 w-12 rounded-full shadow-lg bg-gradient-to-br from-admin-blue to-admin-blue-dark hover:from-admin-blue-dark hover:to-admin-blue overflow-visible"
                    size="icon"
                  >
                    <Sparkles className="h-10 w-10 text-white -m-2" />
                  </Button>
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
    </AdminLayout>
  );
};

export default EvansCalls;
