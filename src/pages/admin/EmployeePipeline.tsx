import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail, Loader2, Users, Star, MoreVertical, Layers, Columns as ColumnsIcon, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Link, useNavigate } from 'react-router-dom';
import EvanLayout from '@/components/evan/EvanLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import GmailComposeDialog, { Attachment } from '@/components/admin/GmailComposeDialog';
import PipelineSharingModal from '@/components/admin/PipelineSharingModal';
import StageManagerModal from '@/components/admin/StageManagerModal';
import ColumnManagerModal from '@/components/admin/ColumnManagerModal';
import PipelineColumnHeader from '@/components/admin/PipelineColumnHeader';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import MoveBoxesModal from '@/components/admin/MoveBoxesModal';
import { usePipelineColumns } from '@/hooks/usePipelineColumns';
import HelpTooltip from '@/components/ui/help-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EVAN_SIGNATURE_HTML, appendSignature } from '@/lib/email-signature';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

// Import avatar images
import andrewFosterAvatar from '@/assets/avatars/andrew-foster.jpg';
import davidKimAvatar from '@/assets/avatars/david-kim.jpg';
import emilyWangAvatar from '@/assets/avatars/emily-wang.jpg';
import lisaWongAvatar from '@/assets/avatars/lisa-wong.jpg';
import michaelChenAvatar from '@/assets/avatars/michael-chen.jpg';
import rachelAdamsAvatar from '@/assets/avatars/rachel-adams.jpg';
import robertMartinezAvatar from '@/assets/avatars/robert-martinez.jpg';
import sarahRichardsonAvatar from '@/assets/avatars/sarah-richardson.jpg';
import sophiaLaurentAvatar from '@/assets/avatars/sophia-laurent.jpg';
import thomasWrightAvatar from '@/assets/avatars/thomas-wright.jpg';

// Email templates for compose
const emailTemplates = [
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

// Lead name to avatar mapping
const leadAvatarMap: Record<string, string> = {
  'andrew foster': andrewFosterAvatar,
  'david kim': davidKimAvatar,
  'emily wang': emilyWangAvatar,
  'lisa wong': lisaWongAvatar,
  'michael chen': michaelChenAvatar,
  'rachel adams': rachelAdamsAvatar,
  'robert martinez': robertMartinezAvatar,
  'sarah richardson': sarahRichardsonAvatar,
  'sophia laurent': sophiaLaurentAvatar,
  'thomas wright': thomasWrightAvatar,
};

const getLeadAvatar = (name: string): string | null => {
  return leadAvatarMap[name.toLowerCase()] || null;
};
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import { useUndo } from '@/contexts/UndoContext';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// Status enum values in pipeline order
const statusOrder: LeadStatus[] = ['initial_review', 'moving_to_underwriting', 'onboarding', 'underwriting', 'ready_for_wu_approval', 'pre_approval_issued', 'won'];

// Default stage config (fallback when no DB stages loaded)
const defaultStages: { status: LeadStatus; title: string; hexColor: string }[] = [
  { status: 'initial_review', title: 'Initial Review', hexColor: '#0066FF' },
  { status: 'moving_to_underwriting', title: 'Moving to UW', hexColor: '#0891b2' },
  { status: 'onboarding', title: 'Onboarding', hexColor: '#d97706' },
  { status: 'underwriting', title: 'Underwriting', hexColor: '#FF8000' },
  { status: 'ready_for_wu_approval', title: 'Ready for Approval', hexColor: '#7c3aed' },
  { status: 'pre_approval_issued', title: 'Pre-Approval Issued', hexColor: '#8b5cf6' },
  { status: 'won', title: 'Won', hexColor: '#10b981' },
];

// Build full stage config from a hex color
const buildStageFromHex = (status: LeadStatus, title: string, hexColor: string) => ({
  status,
  title,
  bgColor: `bg-[${hexColor}]/10`,
  borderColor: `border-[${hexColor}]`,
  textColor: `text-[${hexColor}]`,
  barColor: `bg-[${hexColor}]`,
  hexColor,
});

// Lost stage for dead leads section
const lostStage = { status: 'lost' as LeadStatus, title: 'Lost', bgColor: 'bg-red-500/10', borderColor: 'border-red-600', textColor: 'text-red-700', barColor: 'bg-red-600', hexColor: '#dc2626' };

// Sortable Lead Row Component
interface SortableLeadRowProps {
  lead: Lead;
  children: React.ReactNode;
  gridTemplate: string;
  onClick: () => void;
}

const SortableLeadRow = ({ lead, children, gridTemplate, onClick }: SortableLeadRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-200 dark:border-slate-700 group",
        isDragging && "bg-blue-50 dark:bg-blue-900/30 shadow-lg"
      )}
      onClick={onClick}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {/* Drag handle as first cell */}
        <div 
          className="flex items-center justify-center h-12 border-r border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
        </div>
        {children}
      </div>
    </div>
  );
};

const EmployeePipeline = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember, isOwner } = useTeamMember();
  const { getPageState, setPageState } = useEvanUIState();
  const persistedPipeline = getPageState('pipeline', { collapsedSections: {} as Record<LeadStatus, boolean>, selectedLeadId: null as string | null });

  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('evan');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [collapsedSections, setCollapsedSectionsLocal] = useState<Record<LeadStatus, boolean>>(persistedPipeline.collapsedSections as Record<LeadStatus, boolean>);

  const setCollapsedSections = useCallback((updater: Record<LeadStatus, boolean> | ((prev: Record<LeadStatus, boolean>) => Record<LeadStatus, boolean>)) => {
    setCollapsedSectionsLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setPageState('pipeline', { collapsedSections: next });
      return next;
    });
  }, [setPageState]);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [stageManagerOpen, setStageManagerOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [callConfirmOpen, setCallConfirmOpen] = useState(false);
  const [pendingCallLead, setPendingCallLead] = useState<Lead | null>(null);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailTypeSelectionOpen, setEmailTypeSelectionOpen] = useState(false);
  const [pendingEmailLead, setPendingEmailLead] = useState<Lead | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [moveBoxesOpen, setMoveBoxesOpen] = useState(false);
  const [addingToStage, setAddingToStage] = useState<LeadStatus | null>(null);
  const [newLeadName, setNewLeadName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createLeadDialogOpen, setCreateLeadDialogOpen] = useState(false);
  const [newLeadForDialog, setNewLeadForDialog] = useState<Lead | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Email compose dialog state
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeRecipientName, setComposeRecipientName] = useState('');
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  
  // Global undo context
  const { registerUndo } = useUndo();
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );
  
  // Pipeline columns management
  const {
    columns,
    setColumns,
    insertColumn,
    deleteColumn,
    hideColumn,
    freezeColumn,
    moveColumn,
    resizeColumn,
    getVisibleColumns,
    getGridTemplate,
  } = usePipelineColumns();

  const canEdit = isOwner || teamMember?.name?.toLowerCase() === 'evan';

  // Fetch all available pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['all-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, color, is_main')
        .order('is_main', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as { id: string; name: string; color: string | null; is_main: boolean | null }[];
    },
  });

  // Fetch pipeline stages from DB
  const { data: dbPipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages', selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .order('position');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPipelineId,
  });

  // Auto-select the main pipeline or first available when pipelines load
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const mainPipeline = pipelines.find(p => p.is_main);
      setSelectedPipelineId(mainPipeline?.id || pipelines[0]?.id || null);
    }
  }, [pipelines, selectedPipelineId]);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  // Build stages from DB data (fall back to defaults)
  const stages = useMemo(() => {
    if (dbPipelineStages.length > 0) {
      return dbPipelineStages.map((dbStage, index) => {
        const status = statusOrder[index] || statusOrder[statusOrder.length - 1];
        return buildStageFromHex(status, dbStage.name, dbStage.color || '#64748b');
      });
    }
    return defaultStages.map(s => buildStageFromHex(s.status, s.title, s.hexColor));
  }, [dbPipelineStages]);

  const pipelineName = selectedPipeline?.name || 'Main Pipeline';

  // Save stages mutation
  const saveStagesMutation = useMutation({
    onMutate: async (updatedStages: { id: string; name: string; color: string }[]) => {
      // Snapshot previous stages BEFORE mutation runs
      const previousStages = dbPipelineStages.map(s => ({ id: s.id, name: s.name, color: s.color, position: s.position }));
      const updatedIds = new Set(updatedStages.map(s => s.id));
      const deletedIds = dbPipelineStages.filter(s => !updatedIds.has(s.id)).map(s => s.id);
      return { previousStages, deletedIds };
    },
    mutationFn: async (updatedStages: { id: string; name: string; color: string }[]) => {
      if (!selectedPipelineId) throw new Error('No pipeline selected');
      
      const existingIds = new Set(dbPipelineStages.map(s => s.id));
      
      for (let i = 0; i < updatedStages.length; i++) {
        const stage = updatedStages[i];
        if (existingIds.has(stage.id)) {
          const { error } = await supabase
            .from('pipeline_stages')
            .update({ name: stage.name, color: stage.color, position: i })
            .eq('id', stage.id);
          if (error) { console.error('Stage update error:', error); throw error; }
        } else {
          const { error } = await supabase
            .from('pipeline_stages')
            .insert({ 
              id: stage.id.startsWith('stage-') ? undefined : stage.id,
              name: stage.name, 
              color: stage.color, 
              position: i, 
              pipeline_id: selectedPipelineId 
            });
          if (error) { console.error('Stage insert error:', error); throw error; }
        }
      }
      
      // Delete stages that were removed
      const updatedIds = new Set(updatedStages.map(s => s.id));
      const deletedIds = dbPipelineStages.filter(s => !updatedIds.has(s.id)).map(s => s.id);
      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('pipeline_stages')
          .delete()
          .in('id', deletedIds);
        if (error) { console.error('Stage delete error:', error); throw error; }
      }
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', selectedPipelineId] });
      toast.success('Pipeline stages updated');

      if (context) {
        const { previousStages, deletedIds } = context;
        registerUndo({
          label: 'Pipeline stage changes',
          execute: async () => {
            if (!selectedPipelineId) return;
            // Re-insert deleted stages
            for (const id of deletedIds) {
              const prev = previousStages.find(s => s.id === id);
              if (prev) {
                await supabase.from('pipeline_stages').insert({
                  id: prev.id,
                  name: prev.name,
                  color: prev.color,
                  position: prev.position,
                  pipeline_id: selectedPipelineId,
                });
              }
            }
            // Restore previous values for existing stages
            for (const prev of previousStages) {
              await supabase
                .from('pipeline_stages')
                .update({ name: prev.name, color: prev.color, position: prev.position })
                .eq('id', prev.id);
            }
            // Delete any newly-added stages that didn't exist before
            const prevIds = new Set(previousStages.map(s => s.id));
            const { data: currentStages } = await supabase
              .from('pipeline_stages')
              .select('id')
              .eq('pipeline_id', selectedPipelineId);
            const toDelete = (currentStages || []).filter(s => !prevIds.has(s.id)).map(s => s.id);
            if (toDelete.length > 0) {
              await supabase.from('pipeline_stages').delete().in('id', toDelete);
            }
            queryClient.invalidateQueries({ queryKey: ['pipeline-stages', selectedPipelineId] });
            toast.success('Pipeline stage changes undone');
          },
        });
      }
    },
    onError: (error) => { console.error('Save stages mutation failed:', error); toast.error('Failed to update stages'); },
  });

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

  // Fetch all team members for the owner filter
  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ['all-team-members-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const evanId = evanTeamMember?.id;

  // Create a map of team member names to IDs for filtering
  const teamMemberNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    allTeamMembers.forEach(tm => {
      map[tm.name.toLowerCase()] = tm.id;
    });
    return map;
  }, [allTeamMembers]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['evans-pipeline-leads', evanId, ownerFilter, teamMemberNameToId],
    queryFn: async () => {
      if (!evanId) return [];
      
      let query = supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });
      
      // Filter by specific team member when not "all"
      if (ownerFilter !== 'all') {
        const memberId = teamMemberNameToId[ownerFilter.toLowerCase()];
        if (memberId) {
          query = query.eq('assigned_to', memberId);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!evanId,
  });

  const { data: touchpoints = {} } = useQuery({
    queryKey: ['evans-pipeline-touchpoints', leads.map(l => l.id)],
    queryFn: async () => {
      if (leads.length === 0) return {};
      
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id, communication_type, direction, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const touchpointMap: Record<string, { type: string; direction: string; date: string }> = {};
      (data || []).forEach((comm) => {
        if (comm.lead_id && !touchpointMap[comm.lead_id]) {
          touchpointMap[comm.lead_id] = {
            type: comm.communication_type,
            direction: comm.direction,
            date: comm.created_at,
          };
        }
      });
      
      return touchpointMap;
    },
    enabled: leads.length > 0,
  });

  // Fetch team members for "Assigned To" column (exclude Adam and Ilan from ownership)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .not('name', 'ilike', 'adam')
        .not('name', 'ilike', 'ilan');
      if (error) throw error;
      return data;
    },
  });

  const teamMemberMap = teamMembers.reduce((acc, tm) => {
    acc[tm.id] = tm.name;
    return acc;
  }, {} as Record<string, string>);

  // Update pipeline name mutation
  const updatePipelineNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('pipelines')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-pipelines'] });
      toast.success('Pipeline name updated');
    },
    onError: () => toast.error('Failed to update pipeline name'),
  });

  // Call mutation
  const makeCallMutation = useMutation({
    mutationFn: async ({ phone, leadId }: { phone: string; leadId: string }) => {
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          to: phone,
          leadId: leadId,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-touchpoints'] });
      toast.success(`Call initiated to ${data.to}!`);
      setCallingLeadId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
      setCallingLeadId(null);
    },
  });

  const handleCall = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.phone) {
      toast.error('No phone number available');
      return;
    }
    setPendingCallLead(lead);
    setCallConfirmOpen(true);
  };

  const confirmCall = () => {
    if (!pendingCallLead?.phone) return;
    setCallConfirmOpen(false);
    // Navigate to calls page with phone number pre-filled (don't auto-dial)
    navigate(`/admin/calls?phone=${encodeURIComponent(pendingCallLead.phone)}&leadId=${pendingCallLead.id}`);
    setPendingCallLead(null);
  };

  const handleEmail = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.email) {
      toast.error('No email address available');
      return;
    }
    setPendingEmailLead(lead);
    setEmailConfirmOpen(true);
  };

  const confirmEmail = () => {
    if (!pendingEmailLead?.email) return;
    setEmailConfirmOpen(false);
    setEmailTypeSelectionOpen(true);
  };

  const handleEmailTypeSelect = async (emailType: string) => {
    if (!pendingEmailLead?.email) return;
    setEmailTypeSelectionOpen(false);
    setGeneratingEmail(true);
    
    // Set up compose dialog with lead info
    setComposeTo(pendingEmailLead.email);
    setComposeRecipientName(pendingEmailLead.name);
    setComposeLeadId(pendingEmailLead.id);
    
    // If custom, open dialog with empty fields
    if (emailType === 'custom') {
      setComposeSubject('');
      setComposeBody(EVAN_SIGNATURE_HTML);
      setGeneratingEmail(false);
      setComposeDialogOpen(true);
      setPendingEmailLead(null);
      return;
    }
    
    // Generate AI email for other types
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      // Fetch additional lead data for context
      const { data: leadData } = await supabase
        .from('leads')
        .select(`
          *,
          pipeline_leads(
            stage_id,
            pipeline_id,
            pipeline_stages(name, color),
            pipelines(name)
          ),
          lead_responses(*)
        `)
        .eq('id', pendingEmailLead.id)
        .single();
      
      // Get pipeline stage info
      const pipelineLead = leadData?.pipeline_leads?.[0];
      const stageName = pipelineLead?.pipeline_stages?.name || 'Discovery';
      const pipelineNameVal = pipelineLead?.pipelines?.name || 'Main Pipeline';
      
      // Get lead response data
      const leadResponse = leadData?.lead_responses?.[0];
      
      const leadContext = {
        name: pendingEmailLead.name,
        company: pendingEmailLead.company_name,
        email: pendingEmailLead.email,
        phone: pendingEmailLead.phone,
        stage: stageName,
        pipeline: pipelineNameVal,
        loanAmount: leadResponse?.loan_amount,
        loanType: leadResponse?.loan_type,
        fundingPurpose: leadResponse?.funding_purpose,
        fundingTimeline: leadResponse?.funding_timeline,
        notes: pendingEmailLead.notes,
      };

      const aiResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lead-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadContext,
            emailType,
            currentStage: stageName,
          }),
        }
      );

      if (!aiResponse.ok) {
        throw new Error('Failed to generate email');
      }

      const { subject, body } = await aiResponse.json();
      
      setComposeSubject(subject || '');
      setComposeBody(appendSignature(body || ''));
      setComposeDialogOpen(true);
    } catch (error: any) {
      console.error('Error generating email:', error);
      toast.error('Failed to generate email: ' + error.message);
      // Fall back to opening with empty fields
      setComposeSubject('');
      setComposeBody(EVAN_SIGNATURE_HTML);
      setComposeDialogOpen(true);
    } finally {
      setGeneratingEmail(false);
      setPendingEmailLead(null);
    }
  };

  // Send email from compose dialog
  const handleSendEmail = async (attachments: Attachment[]) => {
    if (!composeTo) return;
    
    setComposeSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Prepare attachments
      const attachmentData = attachments.map(att => ({
        filename: att.name,
        mimeType: att.type,
        data: att.base64,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api?action=send-email`,
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
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      // Update lead's last_activity_at
      if (composeLeadId) {
        await supabase
          .from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', composeLeadId);
      }

      toast.success('Email sent successfully!');
      setComposeDialogOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeLeadId(null);
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setComposeSending(false);
    }
  };

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, previousStatus, leadName, skipUndo }: { id: string; status: LeadStatus; previousStatus: LeadStatus; leadName?: string; skipUndo?: boolean }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const updates: Partial<Lead> = { status };
      if (status === 'moving_to_underwriting' || status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'won' || status === 'funded') {
        updates.converted_at = new Date().toISOString();
      }
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;

      // Register undo with global context (unless this is an undo operation itself)
      if (!skipUndo) {
        registerUndo({
          label: `${leadName || 'Lead'} moved to ${stages.find(s => s.status === status)?.title || status}`,
          execute: async () => {
            const { error: undoError } = await supabase
              .from('leads')
              .update({ status: previousStatus, updated_at: new Date().toISOString() })
              .eq('id', id);
            if (undoError) throw undoError;
            queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
            queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success('Undo successful');
          },
        });
      }

      if ((previousStatus === 'discovery' || previousStatus === 'initial_review') && (status === 'pre_qualification' || status === 'moving_to_underwriting')) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-prequalification-email', {
            body: { leadId: id },
          });
          if (emailError) {
            console.error('Failed to send questionnaire email:', emailError);
            toast.error('Lead moved but questionnaire email failed to send');
          } else {
            toast.success('Questionnaire email sent!');
          }
        } catch (err) {
          console.error('Error sending questionnaire email:', err);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (!((variables.previousStatus === 'discovery' || variables.previousStatus === 'initial_review') && (variables.status === 'pre_qualification' || variables.status === 'moving_to_underwriting'))) {
        if (variables.skipUndo) {
          toast.success('Undo successful');
        } else {
          toast.success('Lead status updated');
        }
      }
    },
    onError: () => toast.error('Failed to update lead status'),
  });

  // Create new lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async ({ name, status }: { name: string; status: LeadStatus }) => {
      if (!evanId) throw new Error('Evan team member not found');
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: name.trim(),
          status,
          assigned_to: evanId,
          source: 'Pipeline',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      toast.success('Lead created');
      setAddingToStage(null);
      setNewLeadName('');
      // If this was from the header + button, open the detail dialog
      if (createLeadDialogOpen) {
        setCreateLeadDialogOpen(false);
        setNewLeadForDialog(data);
        setDetailDialogLead(data);
      }
    },
    onError: () => toast.error('Failed to create lead'),
  });

  // Update lead field mutation (for inline editing)
  const updateLeadFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | null }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      return { field, value };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
    },
    onError: () => toast.error('Failed to update lead'),
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      if (!canEdit) throw new Error('Not authorized');
      
      // First, fetch the leads data before deleting (for undo)
      const { data: leadsToDelete, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .in('id', leadIds);
      
      if (fetchError) throw fetchError;
      
      // Delete the leads
      const { error } = await supabase.from('leads').delete().in('id', leadIds);
      if (error) throw error;
      
      return leadsToDelete as Lead[];
    },
    onSuccess: (deletedLeads) => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      toast.success(`${deletedLeads.length} lead(s) deleted`);
      clearSelection();
      setDeleteConfirmOpen(false);
      
      // Register undo action
      if (deletedLeads && deletedLeads.length > 0) {
        const leadNames = deletedLeads.map(l => l.name).slice(0, 2).join(', ');
        const label = deletedLeads.length === 1 
          ? `Deleted ${leadNames}` 
          : `Deleted ${deletedLeads.length} leads (${leadNames}${deletedLeads.length > 2 ? '...' : ''})`;
        
        registerUndo({
          label,
          execute: async () => {
            // Restore the deleted leads
            const { error: restoreError } = await supabase
              .from('leads')
              .insert(deletedLeads.map(lead => ({
                ...lead,
                updated_at: new Date().toISOString(),
              })));
            
            if (restoreError) throw restoreError;
            
            queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
            queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success(`${deletedLeads.length} lead(s) restored`);
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete leads'),
  });

  // Bulk assign owner mutation
  const bulkAssignOwnerMutation = useMutation({
    mutationFn: async ({ leadIds, ownerId }: { leadIds: string[]; ownerId: string }) => {
      if (!canEdit) throw new Error('Not authorized');
      
      // Get current assignments before updating (for undo)
      const { data: leadsBeforeUpdate } = await supabase
        .from('leads')
        .select('id, assigned_to, name')
        .in('id', leadIds);
      
      const { error } = await supabase.from('leads').update({ assigned_to: ownerId }).in('id', leadIds);
      if (error) throw error;
      return { ownerId, leadsBeforeUpdate, leadCount: leadIds.length };
    },
    onSuccess: (result) => {
      toast.success(`${result.leadCount} lead(s) reassigned`);
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      clearSelection();
      
      // Register undo for bulk owner change
      if (result.leadsBeforeUpdate && result.leadsBeforeUpdate.length > 0) {
        const leadNames = result.leadsBeforeUpdate.map(l => l.name).slice(0, 2).join(', ');
        const label = result.leadsBeforeUpdate.length === 1
          ? `Reassigned ${leadNames}`
          : `Reassigned ${result.leadsBeforeUpdate.length} leads`;
        
        registerUndo({
          label,
          execute: async () => {
            // Restore original assignments
            for (const lead of result.leadsBeforeUpdate!) {
              await supabase.from('leads').update({ assigned_to: lead.assigned_to }).eq('id', lead.id);
            }
            queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
            queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
            toast.success('Undo successful');
          },
        });
      }
    },
    onError: () => toast.error('Failed to assign owner'),
  });

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedLeadIds));
  };

  const handleBulkAssignOwner = (ownerId: string) => {
    bulkAssignOwnerMutation.mutate({ leadIds: Array.from(selectedLeadIds), ownerId });
  };

  // Create new lead via header button
  const handleCreateNewLead = () => {
    if (!evanId) {
      toast.error('Cannot create lead - team member not found');
      return;
    }
    // Create a temporary lead with default values
    setCreateLeadDialogOpen(true);
    createLeadMutation.mutate({ name: 'New Lead', status: 'discovery' });
  };

  const handleAddLead = (status: LeadStatus) => {
    setAddingToStage(status);
    setNewLeadName('');
  };

  const handleSaveNewLead = () => {
    if (!newLeadName.trim()) {
      setAddingToStage(null);
      return;
    }
    createLeadMutation.mutate({ name: newLeadName, status: addingToStage! });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

    // Handle won leads filter - show only won/funded leads
    if (ownerFilter === 'won') {
      return matchesSource && (lead.status === 'won' || lead.status === 'funded');
    }

    // Handle finished leads filter - show only lost leads
    if (ownerFilter === 'dead') {
      return matchesSource && lead.status === 'lost';
    }

    // For all other filters, exclude lost leads from the main pipeline view
    return matchesSource && lead.status !== 'lost';
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  const toggleSection = (status: LeadStatus) => {
    setCollapsedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Jump to a specific stage: expand it, collapse all others, and scroll into view
  const jumpToStage = (targetStatus: LeadStatus) => {
    // Create a new collapsed state where all stages are collapsed except the target
    const newCollapsedState = {} as Record<LeadStatus, boolean>;
    stages.forEach(stage => {
      newCollapsedState[stage.status] = stage.status !== targetStatus;
    });
    setCollapsedSections(newCollapsedState);
    
    // Scroll to the section after a brief delay to allow state to update
    setTimeout(() => {
      const element = document.getElementById(`section-${targetStatus}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Selection helpers
  const toggleLeadSelection = (leadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleAllInStage = (status: LeadStatus) => {
    const stageLeads = getLeadsByStatus(status);
    const stageLeadIds = stageLeads.map(l => l.id);
    const allSelected = stageLeadIds.every(id => selectedLeadIds.has(id));
    
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        stageLeadIds.forEach(id => newSet.delete(id));
      } else {
        stageLeadIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const selectAllLeads = () => {
    setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
  };

  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const isAllSelected = useMemo(() => {
    return filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id));
  }, [filteredLeads, selectedLeadIds]);

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const activeLeadId = active.id as string;
    const overLeadId = over.id as string;
    
    // Find the target stage from the over element
    const overLead = filteredLeads.find(l => l.id === overLeadId);
    const activeLead = filteredLeads.find(l => l.id === activeLeadId);
    
    if (!activeLead || !overLead) return;
    
    // If dropping on a lead in a different stage, move the lead to that stage
    if (activeLead.status !== overLead.status) {
      updateStatusMutation.mutate({
        id: activeLeadId,
        status: overLead.status,
        previousStatus: activeLead.status,
        leadName: activeLead.name,
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeLead = activeId ? filteredLeads.find(l => l.id === activeId) : null;

  const stageCounts = stages.map(stage => ({
    ...stage,
    count: getLeadsByStatus(stage.status).length
  }));
  const totalLeads = filteredLeads.length;

  if (isLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF]"></div>
        </div>
      </EvanLayout>
    );
  }

  return (
    <EvanLayout>
      <div className="flex flex-col h-full font-['Inter',_'SF_Pro_Display',_system-ui,_sans-serif]">
        {/* Header - responsive layout */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 md:mb-6 gap-3 md:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Pipeline Test Title */}
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Test</Badge>
                <DbTableBadge tables={['leads', 'pipeline_leads']} />
                {selectedPipeline && (
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: selectedPipeline.color || '#0066FF' }} 
                  />
                )}
                {/* Inline editable pipeline name */}
                {isEditingName ? (
                  <input
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={() => {
                      if (editingNameValue.trim() && selectedPipelineId) {
                        updatePipelineNameMutation.mutate({ id: selectedPipelineId, name: editingNameValue.trim() });
                      }
                      setIsEditingName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingNameValue.trim() && selectedPipelineId) {
                          updatePipelineNameMutation.mutate({ id: selectedPipelineId, name: editingNameValue.trim() });
                        }
                        setIsEditingName(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                      }
                    }}
                    autoFocus
                    className="text-lg font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-b-2 border-[#0066FF] outline-none px-0 py-0"
                    style={{ width: `${Math.max(editingNameValue.length, 8)}ch` }}
                  />
                ) : (
                  <span 
                    className={cn(
                      "text-lg font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap",
                      canEdit && selectedPipelineId && "cursor-pointer hover:text-[#0066FF] transition-colors"
                    )}
                    onClick={() => {
                      if (canEdit && selectedPipelineId) {
                        setEditingNameValue(pipelineName);
                        setIsEditingName(true);
                      }
                    }}
                    title={canEdit ? "Click to rename" : undefined}
                  >
                    {pipelineName}
                  </span>
                )}
                {selectedPipeline?.is_main && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[8px] font-semibold px-1 py-0">
                    MAIN
                  </Badge>
                )}
              </div>
              
              <HelpTooltip 
                content="Click the pipeline name to rename it. Select a different pipeline from the dropdown."
                side="bottom"
                className="hidden sm:block"
              />
            </div>
            <span className="text-xs md:text-[13px] text-slate-500 font-normal whitespace-nowrap">{totalLeads} leads</span>
            <span className="text-xs text-slate-400 font-normal">•</span>
            <span className="text-xs md:text-[13px] text-slate-500 font-normal whitespace-nowrap">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {canEdit && evanId && (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSharingModalOpen(true)}
                  className="border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-8 md:h-9 text-xs md:text-sm"
                >
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">Share</span>
                </Button>
                <HelpTooltip 
                  content="Share this pipeline with team members. You can give them view-only or full edit access to collaborate on leads."
                  side="bottom"
                  className="hidden md:block"
                />
              </div>
            )}
            {canEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleCreateNewLead}
                      disabled={createLeadMutation.isPending && createLeadDialogOpen}
                      className="h-8 md:h-9 px-2 md:px-3 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs md:text-sm"
                    >
                      {createLeadMutation.isPending && createLeadDialogOpen ? (
                        <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      )}
                      <span className="hidden sm:inline ml-1 md:ml-2">Add Lead</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add a new lead to the pipeline</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/leads')}
              className="h-8 md:h-9 px-2 md:px-4 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs md:text-sm"
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">List View</span>
              <span className="sm:hidden">List</span>
            </Button>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 md:h-9 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs md:text-sm px-2 md:px-3">
                    <span className="hidden sm:inline">Settings</span>
                    <MoreVertical className="w-4 h-4 sm:hidden" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 md:w-56 bg-white dark:bg-slate-800 dark:border-slate-700 z-50 p-1.5 md:p-2">
                  <DropdownMenuItem onClick={() => setStageManagerOpen(true)} className="cursor-pointer py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm">
                    <Layers className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
                    Stages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColumnManagerOpen(true)} className="cursor-pointer py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm">
                    <ColumnsIcon className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
                    Columns
                  </DropdownMenuItem>
                  {/* Mobile-only share option */}
                  {canEdit && evanId && (
                    <DropdownMenuItem onClick={() => setSharingModalOpen(true)} className="cursor-pointer py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm sm:hidden">
                      <Users className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3" />
                      Share
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Pipeline Progress Bar or Special Section Headers - responsive */}
        {ownerFilter !== 'dead' && ownerFilter !== 'won' ? (
          <>
            <div className="mb-1.5 md:mb-2 flex items-center gap-2">
              <span className="text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider">Stage Progress</span>
              <HelpTooltip 
                content="Click any stage to jump to that section. Right-click or hold to customize colors. Each segment shows the count of leads in that stage."
                side="right"
                className="hidden sm:block"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStageManagerOpen(true)}
                className="h-6 px-2 text-xs text-slate-500 hover:text-[#0066FF] hover:bg-[#0066FF]/5"
              >
                <Layers className="h-3 w-3 mr-1" />
                Customize
              </Button>
            </div>
            <div className="flex h-12 md:h-16 mb-4 md:mb-6 overflow-x-auto">
              {stageCounts.map((stage, index) => {
                const isFirst = index === 0;
                const isLast = index === stageCounts.length - 1;
                
                return (
                  <div
                    key={stage.status}
                    className="relative flex-1 min-w-[60px] md:min-w-0 cursor-pointer group"
                    onClick={() => jumpToStage(stage.status)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setStageManagerOpen(true);
                    }}
                  >
                    {/* Main segment */}
                    <div 
                      className={cn(
                        "absolute inset-0 flex items-center justify-center transition-all group-hover:brightness-110",
                        isFirst && "rounded-l-md",
                        isLast && "rounded-r-md"
                      )}
                      style={{
                        backgroundColor: stage.hexColor,
                        clipPath: isLast
                          ? 'polygon(0 0, calc(100% - 0px) 0, 100% 50%, calc(100% - 0px) 100%, 0 100%, 12px 50%)'
                          : isFirst
                            ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 0 50%)'
                            : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)'
                      }}
                    >
                      <div className="flex flex-col items-center text-white pl-1 md:pl-2">
                        <span className="text-lg md:text-2xl font-bold tracking-tight leading-none">{stage.count}</span>
                        <span className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wider opacity-95 mt-0.5 whitespace-nowrap hidden sm:block">{stage.title}</span>
                        <span className="text-[7px] font-semibold uppercase tracking-wider opacity-95 mt-0.5 whitespace-nowrap sm:hidden">{stage.title.slice(0, 4)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : ownerFilter === 'won' ? (
          <div className="mb-4 md:mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{filteredLeads.length}</span>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">Won Leads</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Successfully funded deals that have been closed</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 md:mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{filteredLeads.length}</span>
              </div>
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-300">Finished Leads</h3>
                <p className="text-xs text-red-600 dark:text-red-400">Leads that have been marked as lost or are no longer in the active pipeline</p>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Selection Toolbar - positioned below stage progress */}
        {selectedLeadIds.size > 0 && (
          <div className="mb-4">
            <PipelineBulkToolbar
              selectedCount={selectedLeadIds.size}
              totalCount={filteredLeads.length}
              onClearSelection={clearSelection}
              onEdit={() => {/* TODO: bulk edit */}}
              onExport={() => {/* TODO: export */}}
              onMoveBoxes={() => setMoveBoxesOpen(true)}
              onDeleteBoxes={() => setDeleteConfirmOpen(true)}
              onAssignOwner={handleBulkAssignOwner}
              teamMembers={teamMembers}
            />
          </div>
        )}

        {/* Filters - responsive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 md:h-10 border-slate-200 dark:border-slate-600 text-sm px-3">
                <Filter className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 text-slate-400 flex-shrink-0" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 z-50">
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source!}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-auto min-w-[100px] h-9 md:h-10 border-slate-200 dark:border-slate-600 text-sm px-3">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 text-slate-400" />
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-lg z-[100]">
                <SelectItem value="evan" className="text-slate-900 dark:text-slate-100">Evan's Leads</SelectItem>
                <SelectItem value="brad" className="text-slate-900 dark:text-slate-100">Brad's Leads</SelectItem>
                <SelectItem value="maura" className="text-slate-900 dark:text-slate-100">Maura's Leads</SelectItem>
                <SelectItem value="wendy" className="text-slate-900 dark:text-slate-100">Wendy's Leads</SelectItem>
                <SelectItem value="all" className="text-slate-900 dark:text-slate-100">All Leads</SelectItem>
                <SelectItem value="won" className="text-slate-900 dark:text-slate-100">Won Leads</SelectItem>
                <SelectItem value="dead" className="text-slate-900 dark:text-slate-100">Finished Leads</SelectItem>
              </SelectContent>
            </Select>
            <HelpTooltip 
              content="Filter leads by their source or assigned owner."
              side="right"
              className="hidden sm:block"
            />
          </div>
          <div className="text-sm text-slate-500 whitespace-nowrap">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {/* CRM Table - Fixed grid layout */}
        <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <div className="min-w-fit">
            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <div 
                className="grid text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ gridTemplateColumns: `${getGridTemplate()} 40px` }}
            >
              {getVisibleColumns().map((column) => {
                // Determine cell alignment and padding
                const isUtilityCol = ['drag_handle', 'checkbox', 'avatar'].includes(column.id);
                
                return (
                  <ResizableColumnHeader
                    key={column.id}
                    columnId={column.id}
                    currentWidth={column.width || '100px'}
                    onResize={resizeColumn}
                    className={cn(
                      "flex items-center h-11 border-r border-slate-200 dark:border-slate-700",
                      isUtilityCol ? "justify-center px-1" : "px-3"
                    )}
                  >
                    {column.id === 'drag_handle' && null}
                    {column.id === 'checkbox' && (
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => checked ? selectAllLeads() : clearSelection()}
                        className="h-4 w-4 rounded-none border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    )}
                    {column.id === 'avatar' && null}
                    {!isUtilityCol && (
                      <PipelineColumnHeader
                        column={column}
                        helpText={
                          column.id === 'name' ? "Click name to view details. Double-click to edit." :
                          column.id === 'contact' ? "Quick call or email actions." :
                          column.id === 'last_touch' ? "Most recent communication." : undefined
                        }
                        onInsertColumn={(position, type, isMagic) => insertColumn(column.id, position, type, isMagic)}
                        onDeleteColumn={() => deleteColumn(column.id)}
                        onHideColumn={() => hideColumn(column.id)}
                        onFreezeColumn={() => freezeColumn(column.id)}
                        onMoveColumn={(direction) => moveColumn(column.id, direction)}
                      />
                    )}
                  </ResizableColumnHeader>
                );
              })}
              {/* Add Column Button */}
              <div className="flex items-center justify-center h-11">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-[#0066FF]">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-slate-800 z-50">
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Add Column</div>
                    <DropdownMenuItem onClick={() => { const c = getVisibleColumns().at(-1); if (c) insertColumn(c.id, 'right', 'free_form'); }} className="cursor-pointer text-sm">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Free Form
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { const c = getVisibleColumns().at(-1); if (c) insertColumn(c.id, 'right', 'date'); }} className="cursor-pointer text-sm">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Date
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { const c = getVisibleColumns().at(-1); if (c) insertColumn(c.id, 'right', 'days_in_stage', true); }} className="cursor-pointer text-sm">
                      <Plus className="h-3.5 w-3.5 mr-2 text-purple-500" /> Days in Stage
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Grouped Sections with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
          <div>
            {/* Show either won/finished leads section or normal pipeline stages */}
            {(ownerFilter === 'won' ? [stages.find(s => s.status === 'funded')!] : ownerFilter === 'dead' ? [lostStage] : stages).map((stage) => {
              const stageLeads = getLeadsByStatus(stage.status);
              const isCollapsed = collapsedSections[stage.status];

              return (
                <Collapsible
                  key={stage.status}
                  id={`section-${stage.status}`}
                  open={!isCollapsed}
                  onOpenChange={() => toggleSection(stage.status)}
                >
                  {/* Stage Header Row - entire bar is clickable to expand/collapse */}
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center h-11 px-3 gap-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none">
                      <Checkbox
                        checked={stageLeads.length > 0 && stageLeads.every(l => selectedLeadIds.has(l.id))}
                        onCheckedChange={() => toggleAllInStage(stage.status)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded-none border-slate-300 dark:border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 flex-shrink-0"
                        disabled={stageLeads.length === 0}
                      />
                      <span 
                        className="font-medium text-xs px-3 py-1 rounded-full"
                        style={{ backgroundColor: stage.hexColor, color: 'white' }}
                      >
                        {stage.title}
                      </span>
                      <button 
                        className="text-slate-400 hover:text-slate-600"
                        onClick={(e) => { e.stopPropagation(); handleAddLead(stage.status); }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <div className="flex-1" />
                      <span className="text-xs text-slate-500">{stageLeads.length} leads</span>
                      <div className="p-1">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {/* Inline Add Lead Row */}
                    {addingToStage === stage.status && (
                      <div 
                        className="grid border-b border-slate-200 bg-blue-50"
                        style={{ gridTemplateColumns: `${getGridTemplate()} 40px` }}
                      >
                        {getVisibleColumns().map((column) => {
                          const isUtilityCol = ['drag_handle', 'checkbox', 'avatar'].includes(column.id);
                          return (
                            <div 
                              key={column.id}
                              className={cn(
                                "flex items-center h-12 border-r border-slate-200",
                                isUtilityCol ? "justify-center px-1" : "px-3"
                              )}
                            >
                              {column.id === 'name' && (
                                <input
                                  type="text"
                                  value={newLeadName}
                                  onChange={(e) => setNewLeadName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveNewLead();
                                    if (e.key === 'Escape') { setAddingToStage(null); setNewLeadName(''); }
                                  }}
                                  onBlur={handleSaveNewLead}
                                  autoFocus
                                  placeholder="Enter lead name..."
                                  className="w-full bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                />
                              )}
                            </div>
                          );
                        })}
                        <div className="h-12" />
                      </div>
                    )}

                    {/* Empty State */}
                    {stageLeads.length === 0 && addingToStage !== stage.status ? (
                      <div 
                        className="grid border-b border-slate-200"
                        style={{ gridTemplateColumns: `${getGridTemplate()} 40px` }}
                      >
                        {getVisibleColumns().map((column) => {
                          const isUtilityCol = ['drag_handle', 'checkbox', 'avatar'].includes(column.id);
                          return (
                            <div 
                              key={column.id}
                              className={cn(
                                "flex items-center h-12 border-r border-slate-200",
                                isUtilityCol ? "justify-center px-1" : "px-3"
                              )}
                            >
                              {column.id === 'name' && (
                                <span className="text-sm text-slate-400 italic">No leads in this stage</span>
                              )}
                            </div>
                          );
                        })}
                        <div className="h-12" />
                      </div>
                    ) : (
                      <TooltipProvider>
                        <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        <div>
                          {stageLeads.map((lead, idx) => {
                            const touchpoint = touchpoints[lead.id];
                            const ownerName = lead.assigned_to ? teamMemberMap[lead.assigned_to] : null;
                            const isCallingThis = callingLeadId === lead.id;
                            // Calculate magic column values
                            const stageEntry = stages.find(s => s.status === lead.status);
                            const daysSinceUpdate = differenceInDays(new Date(), new Date(lead.updated_at));
                            
                            // Render cell content based on column
                            const renderCellContent = (column: typeof columns[0]) => {
                              switch (column.id) {
                                case 'drag_handle':
                                  return null;
                                case 'checkbox':
                                  return (
                                    <Checkbox
                                      checked={selectedLeadIds.has(lead.id)}
                                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 rounded-none border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                    />
                                  );
                                case 'avatar':
                                  const avatarSrc = getLeadAvatar(lead.name);
                                  return (
                                    <Avatar className="h-7 w-7 bg-[#0066FF] flex-shrink-0">
                                      {avatarSrc && <AvatarImage src={avatarSrc} alt={lead.name} className="object-cover" />}
                                      <AvatarFallback className="text-[10px] text-white font-semibold bg-[#0066FF]">
                                        {getInitials(lead.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  );
                                case 'name':
                                  return (
                                    <InlineEditableCell
                                      value={lead.name}
                                      onChange={(newValue) => updateLeadFieldMutation.mutate({ id: lead.id, field: 'name', value: newValue })}
                                      onSingleClick={() => setDetailDialogLead(lead)}
                                      editOnDoubleClick={true}
                                      placeholder="Enter name"
                                      displayClassName="text-[13px] text-slate-800 dark:text-slate-200 font-medium"
                                    />
                                  );
                                case 'stage':
                                  const allStagesForDropdown = [...stages, lostStage];
                                  const currentStageEntry = allStagesForDropdown.find(s => s.status === lead.status);
                                  return (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button 
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1.5 hover:opacity-80 w-full justify-center"
                                        >
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap border-transparent",
                                              currentStageEntry?.bgColor,
                                              currentStageEntry?.textColor
                                            )}
                                          >
                                            {currentStageEntry?.title}
                                          </Badge>
                                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-40 bg-white dark:bg-slate-800 z-50">
                                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase">Move to</div>
                                        {stages.map((s) => (
                                          <DropdownMenuItem
                                            key={s.status}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (s.status !== lead.status) {
                                                updateStatusMutation.mutate({ id: lead.id, status: s.status, previousStatus: lead.status });
                                              }
                                            }}
                                            className={cn("cursor-pointer gap-2 text-sm", s.status === lead.status && "bg-slate-100")}
                                          >
                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.hexColor }} />
                                            <span className={cn(s.status === lead.status && "font-semibold")}>{s.title}</span>
                                            {s.status === lead.status && <span className="ml-auto text-[#0066FF]">✓</span>}
                                          </DropdownMenuItem>
                                        ))}
                                        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (lead.status !== 'lost') {
                                              updateStatusMutation.mutate({ id: lead.id, status: 'lost', previousStatus: lead.status });
                                            }
                                          }}
                                          className={cn("cursor-pointer gap-2 text-sm text-red-600", lead.status === 'lost' && "bg-red-50")}
                                        >
                                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500" />
                                          <span className={cn(lead.status === 'lost' && "font-semibold")}>Mark as Lost</span>
                                          {lead.status === 'lost' && <span className="ml-auto text-red-500">✓</span>}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  );
                                case 'company':
                                  return (
                                    <InlineEditableCell
                                      value={lead.company_name || ''}
                                      onChange={(newValue) => updateLeadFieldMutation.mutate({ id: lead.id, field: 'company_name', value: newValue || null })}
                                      placeholder="Add company"
                                      displayClassName="text-[13px] text-slate-500"
                                    />
                                  );
                                case 'contact':
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {lead.phone && (
                                        <HoverCard openDelay={200} closeDelay={100}>
                                          <HoverCardTrigger asChild>
                                            <button
                                              onClick={(e) => handleCall(e, lead)}
                                              disabled={isCallingThis}
                                              className="inline-flex items-center gap-1 h-6 px-2 rounded bg-green-50/50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200/50 dark:border-green-700/50 hover:border-green-300 dark:hover:border-green-600 disabled:opacity-50 transition-colors"
                                            >
                                              {isCallingThis ? <Loader2 className="h-3 w-3 text-green-500 animate-spin" /> : <Phone className="h-3 w-3 text-green-500/70 dark:text-green-400" />}
                                              <span className="text-[11px] font-medium text-green-600/70 dark:text-green-400">Call</span>
                                            </button>
                                          </HoverCardTrigger>
                                          <HoverCardContent side="top" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-green-600" />
                                                <span className="text-sm font-medium">Phone Contact</span>
                                              </div>
                                              <div className="space-y-1.5 text-sm">
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Name</span>
                                                  <span className="font-medium">{lead.name}</span>
                                                </div>
                                                {lead.company_name && (
                                                  <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Company</span>
                                                    <span>{lead.company_name}</span>
                                                  </div>
                                                )}
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Phone</span>
                                                  <span className="font-mono text-green-700">{lead.phone}</span>
                                                </div>
                                              </div>
                                              <div className="pt-1 border-t">
                                                <span className="text-xs text-muted-foreground">Click to initiate call</span>
                                              </div>
                                            </div>
                                          </HoverCardContent>
                                        </HoverCard>
                                      )}
                                      <HoverCard openDelay={200} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <button
                                            onClick={(e) => lead.email ? handleEmail(e, lead) : e.stopPropagation()}
                                            disabled={!lead.email}
                                            className={`inline-flex items-center gap-1 h-6 px-2 rounded border transition-colors ${
                                              lead.email 
                                                ? 'bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-blue-200/50 dark:border-blue-700/50 hover:border-blue-300 dark:hover:border-blue-600'
                                                : 'bg-muted/30 border-muted-foreground/10 opacity-50 cursor-not-allowed'
                                            }`}
                                          >
                                            <Mail className={`h-3 w-3 ${lead.email ? 'text-blue-500/70 dark:text-blue-400' : 'text-muted-foreground/50'}`} />
                                            <span className={`text-[11px] font-medium ${lead.email ? 'text-blue-600/70 dark:text-blue-400' : 'text-muted-foreground/50'}`}>Email</span>
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                                          {lead.email ? (
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-[#0066FF]" />
                                                <span className="text-sm font-medium">Email Contact</span>
                                              </div>
                                              <div className="space-y-1.5 text-sm">
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Name</span>
                                                  <span className="font-medium">{lead.name}</span>
                                                </div>
                                                {lead.company_name && (
                                                  <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Company</span>
                                                    <span>{lead.company_name}</span>
                                                  </div>
                                                )}
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Email</span>
                                                  <span className="font-mono text-[#0066FF] text-xs truncate max-w-[140px]">{lead.email}</span>
                                                </div>
                                              </div>
                                              <div className="pt-1 border-t">
                                                <span className="text-xs text-muted-foreground">Click to compose email</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium text-muted-foreground">No email on file</span>
                                              </div>
                                              <p className="text-xs text-muted-foreground">
                                                Add an email address to this contact to enable email actions.
                                              </p>
                                            </div>
                                          )}
                                        </HoverCardContent>
                                      </HoverCard>
                                      {!lead.phone && !lead.email && <span className="text-slate-300 text-xs">—</span>}
                                    </div>
                                  );
                                case 'owner':
                                  return (
                                    <InlineEditableCell
                                      value={lead.assigned_to || ''}
                                      onChange={(newValue) => updateLeadFieldMutation.mutate({ id: lead.id, field: 'assigned_to', value: newValue || null })}
                                      type="select"
                                      options={teamMembers.map(tm => ({ id: tm.id, label: tm.name }))}
                                      placeholder="Assign"
                                    />
                                  );
                                case 'source':
                                  return (
                                    <InlineEditableCell
                                      value={lead.source || ''}
                                      onChange={(newValue) => updateLeadFieldMutation.mutate({ id: lead.id, field: 'source', value: newValue || null })}
                                      placeholder="Add source"
                                      displayClassName="text-[12px] text-slate-400"
                                    />
                                  );
                                case 'last_touch':
                                  return <span className="text-[12px] text-slate-400 capitalize">{touchpoint?.type || '—'}</span>;
                                case 'notes':
                                  return (
                                    <InlineEditableCell
                                      value={lead.notes || ''}
                                      onChange={(newValue) => updateLeadFieldMutation.mutate({ id: lead.id, field: 'notes', value: newValue || null })}
                                      placeholder="Add notes..."
                                      displayClassName="text-[12px] text-slate-500 truncate"
                                    />
                                  );
                                case 'updated':
                                  return <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false })}</span>;
                                default:
                                  if (column.type === 'magic') {
                                    const daysInPipeline = differenceInDays(new Date(), new Date(lead.created_at));
                                    switch (column.magicType) {
                                      case 'created_date': return <span className="text-xs text-purple-600">{new Date(lead.created_at).toLocaleDateString()}</span>;
                                      case 'days_in_pipeline': return <span className="text-xs text-purple-600 font-medium">{daysInPipeline}d</span>;
                                      case 'last_updated': return <span className="text-xs text-purple-600">{formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</span>;
                                      case 'freshness':
                                        const color = daysSinceUpdate <= 1 ? 'text-green-600' : daysSinceUpdate <= 7 ? 'text-yellow-600' : 'text-red-600';
                                        const label = daysSinceUpdate <= 1 ? '🟢' : daysSinceUpdate <= 7 ? '🟡' : '🔴';
                                        return <span className={cn("text-xs font-medium", color)}>{label}</span>;
                                      case 'days_in_stage': return <span className="text-xs text-purple-600 font-medium">{daysSinceUpdate}d</span>;
                                      case 'stage_entered_date': return <span className="text-xs text-purple-600">{lead.qualified_at ? new Date(lead.qualified_at).toLocaleDateString() : '—'}</span>;
                                      case 'days_since_contact': return <span className="text-xs text-purple-600">{touchpoint ? `${daysSinceUpdate}d` : '—'}</span>;
                                      case 'last_contact_type': return <span className="text-xs text-purple-600 capitalize">{touchpoint?.type || '—'}</span>;
                                      case 'email_count': case 'call_count': case 'task_count': case 'file_count': case 'comment_count': case 'meeting_count':
                                        return <span className="text-xs text-purple-600">0</span>;
                                      case 'lead_id': return <span className="text-xs text-purple-600 font-mono truncate" title={lead.id}>{lead.id.slice(0, 8)}</span>;
                                      default: return <span className="text-xs text-purple-400">—</span>;
                                    }
                                  }
                                  return <span className="text-xs text-slate-400">—</span>;
                              }
                            };
                            
                            return (
                              <SortableLeadRow 
                                key={lead.id} 
                                lead={lead}
                                gridTemplate={`${getGridTemplate()} 40px`}
                                onClick={() => setDetailDialogLead(lead)}
                              >
                                {getVisibleColumns().filter(c => c.id !== 'drag_handle').map((column) => {
                                  const isUtilityCol = ['checkbox', 'avatar'].includes(column.id);
                                  const isCenteredCol = column.id === 'stage';
                                  return (
                                    <div 
                                      key={column.id} 
                                      className={cn(
                                        "flex items-center h-12 overflow-hidden border-r border-slate-200 dark:border-slate-700",
                                        isUtilityCol ? "justify-center px-1" : isCenteredCol ? "justify-center px-2" : "px-3"
                                      )}
                                    >
                                      {renderCellContent(column)}
                                    </div>
                                  );
                                })}
                                <div className="h-12" />
                              </SortableLeadRow>
                            );
                          })}
                        </div>
                        </SortableContext>
                      </TooltipProvider>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
          </DndContext>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead' : 'leads'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data associated with {selectedLeadIds.size === 1 ? 'this lead' : 'these leads'} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={detailDialogLead}
        open={!!detailDialogLead}
        onOpenChange={(open) => !open && setDetailDialogLead(null)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
          queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
        }}
      />

      {/* Pipeline Sharing Modal */}
      {evanId && (
        <PipelineSharingModal
          open={sharingModalOpen}
          onOpenChange={setSharingModalOpen}
          ownerId={evanId}
          ownerName="Evan"
        />
      )}

      {/* Stage Manager Modal */}
      <StageManagerModal
        open={stageManagerOpen}
        onOpenChange={setStageManagerOpen}
        stages={dbPipelineStages.length > 0 
          ? dbPipelineStages.map(s => ({ id: s.id, name: s.name, color: s.color || '#64748b' }))
          : stages.map(s => ({ id: s.status, name: s.title, color: s.hexColor }))
        }
        pipelineName={pipelineName}
        onPipelineNameChange={(name) => {
          if (selectedPipelineId) {
            updatePipelineNameMutation.mutate({ id: selectedPipelineId, name });
          }
        }}
        onSave={(updatedStages) => {
          saveStagesMutation.mutate(updatedStages);
        }}
      />

      {/* Column Manager Modal */}
      <ColumnManagerModal
        open={columnManagerOpen}
        onOpenChange={setColumnManagerOpen}
        columns={columns}
        onColumnsChange={(newColumns) => {
          setColumns(newColumns);
        }}
      />

      {/* Move Boxes Modal */}
      <MoveBoxesModal
        open={moveBoxesOpen}
        onOpenChange={setMoveBoxesOpen}
        selectedLeadIds={Array.from(selectedLeadIds)}
        onMoveComplete={clearSelection}
      />

      {/* Call Confirmation Dialog */}
      <AlertDialog open={callConfirmOpen} onOpenChange={setCallConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Call</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to call <span className="font-semibold">{pendingCallLead?.name}</span> at{' '}
              <span className="font-semibold">{pendingCallLead?.phone}</span>. This will open the calls page and initiate the call.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCallLead(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCall}>
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Confirmation Dialog */}
      <AlertDialog open={emailConfirmOpen} onOpenChange={setEmailConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compose Email</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to email <span className="font-semibold">{pendingEmailLead?.name}</span> at{' '}
              <span className="font-semibold">{pendingEmailLead?.email}</span>. This will open Gmail with a new compose window.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEmailLead(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Type Selection Dialog */}
      <AlertDialog open={emailTypeSelectionOpen} onOpenChange={(open) => {
        setEmailTypeSelectionOpen(open);
        if (!open) setPendingEmailLead(null);
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Choose Email Type</AlertDialogTitle>
            <AlertDialogDescription>
              Select how you'd like to compose your email to <span className="font-semibold">{pendingEmailLead?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 text-left"
              onClick={() => handleEmailTypeSelect('custom')}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">✏️ Custom Email</span>
                <span className="text-xs text-muted-foreground">Write your own email from scratch</span>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 text-left"
              onClick={() => handleEmailTypeSelect('introduction')}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">👋 Introduction Email</span>
                <span className="text-xs text-muted-foreground">AI-generated intro and company overview</span>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 text-left"
              onClick={() => handleEmailTypeSelect('follow_up')}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">🔄 Follow-up Email</span>
                <span className="text-xs text-muted-foreground">AI-generated follow-up based on lead context</span>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 text-left"
              onClick={() => handleEmailTypeSelect('rate_alert')}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">📊 Rate Alert Email</span>
                <span className="text-xs text-muted-foreground">AI-generated rate update notification</span>
              </div>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Compose Dialog */}
      <GmailComposeDialog
        isOpen={composeDialogOpen}
        onClose={() => {
          setComposeDialogOpen(false);
          setComposeTo('');
          setComposeSubject('');
          setComposeBody('');
          setComposeLeadId(null);
        }}
        to={composeTo}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        sending={composeSending}
        recipientName={composeRecipientName}
        templates={emailTemplates}
      />

      {/* Generating Email Loading Overlay */}
      {generatingEmail && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">Generating your email...</p>
            <p className="text-sm text-muted-foreground">AI is crafting the perfect message</p>
          </div>
        </div>
      )}
    </EvanLayout>
  );
};

export default EmployeePipeline;
