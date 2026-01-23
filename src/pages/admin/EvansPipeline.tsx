import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail, Loader2, Users, Star, MoreVertical, Layers, Columns as ColumnsIcon, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import { useUndo } from '@/contexts/UndoContext';
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

// Brand colors: Blue (#0066FF) for early stages, Orange (#FF8000) for later stages
const stages: { status: LeadStatus; title: string; bgColor: string; borderColor: string; textColor: string; barColor: string; hexColor: string }[] = [
  { status: 'discovery', title: 'Discovery', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#3385FF]', textColor: 'text-[#3385FF]', barColor: 'bg-[#0066FF]', hexColor: '#3385FF' },
  { status: 'pre_qualification', title: 'Pre-Qualification', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#4D94FF]', textColor: 'text-[#4D94FF]', barColor: 'bg-[#1a75ff]', hexColor: '#4D94FF' },
  { status: 'document_collection', title: 'Doc Collection', bgColor: 'bg-[#3385ff]/10', borderColor: 'border-[#66A3FF]', textColor: 'text-[#66A3FF]', barColor: 'bg-[#3385ff]', hexColor: '#66A3FF' },
  { status: 'underwriting', title: 'Underwriting', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF9933]', textColor: 'text-[#FF9933]', barColor: 'bg-[#FF8000]', hexColor: '#FF9933' },
  { status: 'approval', title: 'Approval', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#EB8F33]', textColor: 'text-[#EB8F33]', barColor: 'bg-[#e67300]', hexColor: '#EB8F33' },
  { status: 'funded', title: 'Funded', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-600', textColor: 'text-emerald-700', barColor: 'bg-emerald-600', hexColor: '#059669' },
];

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

const EvansPipeline = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember, isOwner } = useTeamMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<LeadStatus, boolean>>({} as Record<LeadStatus, boolean>);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [stageManagerOpen, setStageManagerOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState('Main Pipeline');
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['evans-pipeline-leads', evanId],
    queryFn: async () => {
      if (!evanId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', evanId)
        .order('updated_at', { ascending: false });
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

  // Fetch team members for "Assigned To" column
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  const teamMemberMap = teamMembers.reduce((acc, tm) => {
    acc[tm.id] = tm.name;
    return acc;
  }, {} as Record<string, string>);

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
    setCallingLeadId(pendingCallLead.id);
    setCallConfirmOpen(false);
    // Navigate to calls page first
    navigate('/team/evan/calls');
    // Then initiate the call
    makeCallMutation.mutate({ phone: pendingCallLead.phone, leadId: pendingCallLead.id });
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

  const handleEmailTypeSelect = (emailType: string) => {
    if (!pendingEmailLead?.email) return;
    setEmailTypeSelectionOpen(false);
    navigate(`/team/evan/gmail?compose=true&to=${encodeURIComponent(pendingEmailLead.email)}&name=${encodeURIComponent(pendingEmailLead.name)}&emailType=${encodeURIComponent(emailType)}&leadId=${encodeURIComponent(pendingEmailLead.id)}`);
    setPendingEmailLead(null);
  };

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, previousStatus, leadName, skipUndo }: { id: string; status: LeadStatus; previousStatus: LeadStatus; leadName?: string; skipUndo?: boolean }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const updates: Partial<Lead> = { status };
      if (status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'funded') {
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

      if (previousStatus === 'discovery' && status === 'pre_qualification') {
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
      if (!(variables.previousStatus === 'discovery' && variables.status === 'pre_qualification')) {
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
      const { error } = await supabase.from('leads').update({ assigned_to: ownerId }).in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      toast.success(`${selectedLeadIds.size} lead(s) reassigned`);
      clearSelection();
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
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesOwner = ownerFilter === 'all' || lead.assigned_to === ownerFilter;
    return matchesSearch && matchesSource && matchesOwner;
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
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF]"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full font-['Inter',_'SF_Pro_Display',_system-ui,_sans-serif]">
        {/* Header - responsive layout */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 md:mb-6 gap-3 md:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {isEditingName ? (
                <input
                  type="text"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  onBlur={() => {
                    if (editingNameValue.trim()) {
                      setPipelineName(editingNameValue.trim());
                    }
                    setIsEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingNameValue.trim()) {
                        setPipelineName(editingNameValue.trim());
                      }
                      setIsEditingName(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                  className="text-lg md:text-xl font-medium tracking-tight text-slate-800 bg-transparent border-b-2 border-[#0066FF] outline-none px-0 py-0"
                  style={{ width: `${Math.max(editingNameValue.length, 8)}ch` }}
                />
              ) : (
                <h1 
                  className="text-lg md:text-xl font-medium tracking-tight text-slate-800 cursor-pointer hover:text-[#0066FF] transition-colors"
                  onClick={() => {
                    if (canEdit) {
                      setEditingNameValue(pipelineName);
                      setIsEditingName(true);
                    }
                  }}
                  title={canEdit ? "Click to edit pipeline name" : undefined}
                >
                  {pipelineName}
                </h1>
              )}
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] md:text-[10px] font-semibold px-1.5 md:px-2 py-0.5 flex-shrink-0">
                MAIN
              </Badge>
              <HelpTooltip 
                content="Click the pipeline name to rename it. Your main pipeline tracks all your primary leads through the sales process."
                side="bottom"
                className="hidden sm:block"
              />
            </div>
            <span className="text-xs md:text-[13px] text-slate-500 font-normal whitespace-nowrap">{totalLeads} leads</span>
            <span className="text-xs text-slate-400 font-normal">•</span>
            <span className="text-xs md:text-[13px] text-slate-500 font-normal whitespace-nowrap">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {!canEdit && (
              <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300 flex-shrink-0 text-xs">
                <Lock className="h-3 w-3" />
                View Only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {canEdit && evanId && (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSharingModalOpen(true)}
                  className="border-[#0066FF]/30 text-[#0066FF] hover:bg-[#0066FF]/5 h-8 md:h-9 text-xs md:text-sm"
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
              onClick={() => navigate('/team/evan/leads')}
              className="h-8 md:h-9 px-2 md:px-4 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 text-xs md:text-sm"
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">List View</span>
              <span className="sm:hidden">List</span>
            </Button>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 md:h-9 border-slate-200 text-slate-600 hover:bg-slate-50 text-xs md:text-sm px-2 md:px-3">
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

        {/* Pipeline Progress Bar - responsive */}
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
                    stage.barColor,
                    isFirst && "rounded-l-md",
                    isLast && "rounded-r-md"
                  )}
                  style={{
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

        {/* Bulk Selection Toolbar - positioned below stage progress */}
        {selectedLeadIds.size > 0 && (
          <div className="mb-4">
            <PipelineBulkToolbar
              selectedCount={selectedLeadIds.size}
              onClearSelection={clearSelection}
              onMoveBoxes={() => setMoveBoxesOpen(true)}
              onDeleteBoxes={() => setDeleteConfirmOpen(true)}
              onAssignOwner={handleBulkAssignOwner}
              teamMembers={teamMembers}
            />
          </div>
        )}

        {/* Filters - responsive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 mb-3 md:mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 md:h-10 pl-3 md:pl-4 text-sm border-slate-200 focus:border-[#0066FF] focus:ring-[#0066FF]/20"
            />
            <HelpTooltip 
              content="Search by lead name, email, or company. Results filter in real-time as you type."
              side="right"
              className="hidden sm:block"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-32 md:w-40 h-9 md:h-10 border-slate-200 dark:border-slate-600 text-sm">
                <Filter className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 text-slate-400" />
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
              <SelectTrigger className="w-full sm:w-32 md:w-40 h-9 md:h-10 border-slate-200 dark:border-slate-600 text-sm">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 text-slate-400" />
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 z-50">
                <SelectItem value="all">All Owners</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
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
                          column.id === 'name' ? "Lead's full name. Click any row to open details." :
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
            {stages.map((stage) => {
              const stageLeads = getLeadsByStatus(stage.status);
              const isCollapsed = collapsedSections[stage.status];

              return (
                <Collapsible
                  key={stage.status}
                  id={`section-${stage.status}`}
                  open={!isCollapsed}
                  onOpenChange={() => toggleSection(stage.status)}
                >
                  {/* Stage Header Row */}
                  <div className="flex items-center h-11 px-3 gap-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <Checkbox
                      checked={stageLeads.length > 0 && stageLeads.every(l => selectedLeadIds.has(l.id))}
                      onCheckedChange={() => toggleAllInStage(stage.status)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded-none border-slate-300 dark:border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 flex-shrink-0"
                      disabled={stageLeads.length === 0}
                    />
                    <CollapsibleTrigger asChild>
                      <span 
                        className="font-medium text-xs px-3 py-1 rounded-full cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: stage.hexColor, color: 'white' }}
                      >
                        {stage.title}
                      </span>
                    </CollapsibleTrigger>
                    <button 
                      className="text-slate-400 hover:text-slate-600"
                      onClick={(e) => { e.stopPropagation(); handleAddLead(stage.status); }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <div className="flex-1" />
                    <span className="text-xs text-slate-500">{stageLeads.length} leads</span>
                    <CollapsibleTrigger asChild>
                      <button className="p-1 hover:bg-slate-200 rounded">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>
                    </CollapsibleTrigger>
                  </div>

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
                                  return (
                                    <Avatar className="h-7 w-7 bg-[#0066FF] flex-shrink-0">
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
                                      placeholder="Enter name"
                                      displayClassName="text-[13px] text-slate-800 dark:text-slate-200"
                                    />
                                  );
                                case 'stage':
                                  return (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button 
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 hover:opacity-80"
                                        >
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap border-transparent",
                                              stageEntry?.bgColor,
                                              stageEntry?.textColor
                                            )}
                                          >
                                            {stageEntry?.title}
                                          </Badge>
                                          <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
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
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => handleCall(e, lead)}
                                              disabled={isCallingThis}
                                              className="inline-flex items-center gap-1 h-6 px-2 rounded bg-green-100 hover:bg-green-200 border border-green-300 disabled:opacity-50"
                                            >
                                              {isCallingThis ? <Loader2 className="h-3 w-3 text-green-700 animate-spin" /> : <Phone className="h-3 w-3 text-green-700" />}
                                              <span className="text-[11px] font-medium text-green-700">Call</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Call {lead.phone}</p></TooltipContent>
                                        </Tooltip>
                                      )}
                                      {lead.email && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => handleEmail(e, lead)}
                                              className="inline-flex items-center gap-1 h-6 px-2 rounded bg-[#0066FF]/10 hover:bg-[#0066FF]/20 border border-[#0066FF]/30"
                                            >
                                              <Mail className="h-3 w-3 text-[#0066FF]" />
                                              <span className="text-[11px] font-medium text-[#0066FF]">Email</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Email {lead.email}</p></TooltipContent>
                                        </Tooltip>
                                      )}
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
                                  return (
                                    <div 
                                      key={column.id} 
                                      className={cn(
                                        "flex items-center h-12 overflow-hidden border-r border-slate-200 dark:border-slate-700",
                                        isUtilityCol ? "justify-center px-1" : "px-3"
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
        stages={stages.map(s => ({ id: s.status, name: s.title, color: s.barColor.replace('bg-[', '').replace(']', '').replace('bg-emerald-600', '#10b981') }))}
        pipelineName={pipelineName}
        onPipelineNameChange={(name) => {
          setPipelineName(name);
          toast.success('Pipeline name updated');
        }}
        onSave={(updatedStages) => {
          // For now, just show a toast - full persistence requires database migration
          toast.success(`Saved ${updatedStages.length} stages`);
          console.log('Updated stages:', updatedStages);
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
    </AdminLayout>
  );
};

export default EvansPipeline;
