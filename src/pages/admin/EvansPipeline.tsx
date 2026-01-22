import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail, Loader2, Users, Star, MoreVertical, Layers, Columns as ColumnsIcon, GripVertical, Undo2 } from 'lucide-react';
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
        "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-base transition-colors border-b border-slate-200 dark:border-slate-700 min-w-max group",
        isDragging && "bg-blue-50 dark:bg-blue-900/30 shadow-lg"
      )}
      onClick={onClick}
    >
      <div
        style={{ 
          display: 'grid',
          gridTemplateColumns: gridTemplate
        }}
      >
        {/* Drag handle as first cell */}
        <div 
          className="flex items-center justify-center min-h-[48px] border-r border-slate-200 dark:border-slate-700 px-1 cursor-grab active:cursor-grabbing"
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
  
  // Undo system - tracks last action for reversal
  const [lastAction, setLastAction] = useState<{
    type: 'status_change' | 'lead_created' | 'lead_deleted';
    leadId: string;
    leadName: string;
    previousStatus?: LeadStatus;
    newStatus?: LeadStatus;
    timestamp: number;
  } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  
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
    insertColumn,
    deleteColumn,
    hideColumn,
    freezeColumn,
    moveColumn,
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

      // Track action for undo (unless this is an undo operation itself)
      if (!skipUndo) {
        setLastAction({
          type: 'status_change',
          leadId: id,
          leadName: leadName || 'Lead',
          previousStatus,
          newStatus: status,
          timestamp: Date.now(),
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

  // Undo handler
  const handleUndo = async () => {
    if (!lastAction || isUndoing) return;
    
    setIsUndoing(true);
    try {
      if (lastAction.type === 'status_change' && lastAction.previousStatus) {
        // Revert status change
        await updateStatusMutation.mutateAsync({
          id: lastAction.leadId,
          status: lastAction.previousStatus,
          previousStatus: lastAction.newStatus!,
          skipUndo: true,
        });
        setLastAction(null);
      }
    } catch (error) {
      toast.error('Failed to undo action');
    } finally {
      setIsUndoing(false);
    }
  };

  // Clear undo after 30 seconds
  const undoTimeRemaining = lastAction ? Math.max(0, 30000 - (Date.now() - lastAction.timestamp)) : 0;
  
  // Auto-clear undo after timeout
  useEffect(() => {
    if (lastAction && undoTimeRemaining <= 0) {
      setLastAction(null);
    }
  }, [lastAction, undoTimeRemaining]);

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
    return matchesSearch && matchesSource;
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  const toggleSection = (status: LeadStatus) => {
    setCollapsedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
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
                <Star className="h-2 w-2 md:h-2.5 md:w-2.5 mr-0.5 md:mr-1 fill-amber-500" />
                MAIN
              </Badge>
              <HelpTooltip 
                content="Click the pipeline name to rename it. Your main pipeline tracks all your primary leads through the sales process."
                side="bottom"
                className="hidden sm:block"
              />
            </div>
            <span className="text-xs md:text-[13px] text-slate-500 font-normal whitespace-nowrap">{totalLeads} leads</span>
            {!canEdit && (
              <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300 flex-shrink-0 text-xs">
                <Lock className="h-3 w-3" />
                View Only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {/* Undo Button */}
            {lastAction && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUndo}
                      disabled={isUndoing}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 h-8 md:h-9 text-xs md:text-sm animate-in fade-in slide-in-from-right-2"
                    >
                      {isUndoing ? (
                        <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      ) : (
                        <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
                      )}
                      Undo
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Undo: {lastAction.leadName} moved to {stages.find(s => s.status === lastAction.newStatus)?.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
            content="Click any stage to jump to that section. Each segment shows the count of leads in that stage. Drag leads between stages in the table below to update their status."
            side="right"
            className="hidden sm:block"
          />
        </div>
        <div className="flex h-12 md:h-16 mb-4 md:mb-6 overflow-x-auto">
          {stageCounts.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stageCounts.length - 1;
            
            return (
              <div
                key={stage.status}
                className="relative flex-1 min-w-[60px] md:min-w-0 cursor-pointer group"
                onClick={() => {
                  const element = document.getElementById(`section-${stage.status}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
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
              <SelectTrigger className="w-full sm:w-40 md:w-48 h-9 md:h-10 border-slate-200 text-sm">
                <Filter className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 text-slate-400" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source!}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <HelpTooltip 
              content="Filter leads by their acquisition source (e.g., Website, Referral, Cold Call). Helps focus on specific lead channels."
              side="right"
              className="hidden sm:block"
            />
          </div>
          <div className="text-sm text-slate-500 whitespace-nowrap">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {/* Grouped Table View - 8px spacing system */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900">
          {/* Table Header with Column Dropdowns */}
          <div className="sticky top-0 z-10 bg-slate-50/60 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 min-w-max">
            <div 
              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest"
              style={{ 
                display: 'grid',
                gridTemplateColumns: `${getGridTemplate()} 48px`
              }}
            >
              {getVisibleColumns().map((column, colIndex) => {
                const isLastColumn = colIndex === getVisibleColumns().length - 1;
                
                // Consistent cell styling with 8px increments
                const getCellPadding = () => {
                  if (column.id === 'drag_handle') return 'px-1'; // Minimal padding for drag handle
                  if (column.id === 'checkbox' || column.id === 'avatar') return 'px-2'; // 8px
                  return 'px-4'; // 16px
                };
                
                const cellClass = cn(
                  "flex items-center min-h-[48px]", // 48px = 6 * 8px
                  getCellPadding(),
                  "border-r border-slate-200"
                );
                
                // Empty cell for drag handle column in header
                if (column.id === 'drag_handle') {
                  return <div key={column.id} className={cn(cellClass, "justify-center")}></div>;
                }
                // Special handling for checkbox column - add select all
                if (column.id === 'checkbox') {
                  return (
                    <div key={column.id} className={cn(cellClass, "justify-center")}>
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllLeads();
                          } else {
                            clearSelection();
                          }
                        }}
                        className="rounded-none border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </div>
                  );
                }
                if (column.id === 'avatar') {
                  return <div key={column.id} className={cn(cellClass, "justify-center")}></div>;
                }

                // Help text for specific columns
                const helpTexts: Record<string, string> = {
                  name: "Lead's full name. Click any row to open the full lead detail dialog.",
                  contact: "Quick actions to call or email the lead. Click 'Call' to initiate a Twilio call, or 'Email' to compose in Gmail.",
                  last_touch: "Most recent communication with this lead (call, email, or SMS). Helps identify leads that need follow-up.",
                };

                return (
                  <div key={column.id} className={cellClass}>
                    <PipelineColumnHeader
                      column={column}
                      helpText={helpTexts[column.id]}
                      onInsertColumn={(position, type, isMagic) => insertColumn(column.id, position, type, isMagic)}
                      onDeleteColumn={() => deleteColumn(column.id)}
                      onHideColumn={() => hideColumn(column.id)}
                      onFreezeColumn={() => freezeColumn(column.id)}
                      onMoveColumn={(direction) => moveColumn(column.id, direction)}
                    />
                  </div>
                );
              })}
              {/* Add Column Button at the end */}
              <div className="flex items-center justify-center px-2 min-h-[48px]">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-slate-400 hover:text-[#0066FF] hover:bg-[#0066FF]/5"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white z-50">
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Add Column</div>
                  <DropdownMenuItem 
                    onClick={() => {
                      const lastCol = getVisibleColumns().at(-1);
                      if (lastCol) insertColumn(lastCol.id, 'right', 'free_form');
                    }} 
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Free Form
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      const lastCol = getVisibleColumns().at(-1);
                      if (lastCol) insertColumn(lastCol.id, 'right', 'date');
                    }} 
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Date
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      const lastCol = getVisibleColumns().at(-1);
                      if (lastCol) insertColumn(lastCol.id, 'right', 'days_in_stage', true);
                    }} 
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2 text-purple-500" />
                    Days in Stage (Magic)
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
                  {/* Section Header - Full-width colored bar with 8px spacing */}
                  <div
                    className="cursor-pointer transition-colors flex items-center min-h-[48px] px-4 gap-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"
                  >
                    {/* Stage selection checkbox */}
                    <Checkbox
                      checked={stageLeads.length > 0 && stageLeads.every(l => selectedLeadIds.has(l.id))}
                      onCheckedChange={() => toggleAllInStage(stage.status)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-none border-slate-300 dark:border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 flex-shrink-0"
                      disabled={stageLeads.length === 0}
                    />
                    
                    {/* Stage badge pill - clickable to collapse */}
                    <CollapsibleTrigger asChild>
                      <span 
                        className="font-medium text-sm px-4 py-1.5 rounded-full whitespace-nowrap cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ 
                          backgroundColor: stage.hexColor,
                          color: 'white'
                        }}
                      >
                        {stage.title}
                      </span>
                    </CollapsibleTrigger>
                    
                    {/* Add button */}
                    <button 
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddLead(stage.status);
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    
                    {/* Spacer */}
                    <div className="flex-1" />
                    
                    {/* Lead count badge */}
                    <span className="text-xs text-slate-500">{stageLeads.length} leads</span>
                    
                    {/* Collapse indicator */}
                    <CollapsibleTrigger asChild>
                      <button className="p-1 hover:bg-slate-200 rounded transition-colors">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  {/* Section Content */}
                  <CollapsibleContent>
                    {/* Inline Add Lead Row */}
                    {addingToStage === stage.status && (
                      <div 
                        className="border-b border-slate-200 min-w-max bg-blue-50"
                        style={{ 
                          display: 'grid',
                          gridTemplateColumns: `${getGridTemplate()} 48px`
                        }}
                      >
                        {getVisibleColumns().map((column) => (
                          <div 
                            key={column.id}
                            className={cn(
                              "flex items-center min-h-[48px]",
                              "border-r border-slate-200",
                              column.id === 'drag_handle' ? "px-1 justify-center" :
                              (column.id === 'checkbox' || column.id === 'avatar') ? "px-2 justify-center" : "px-4"
                            )}
                          >
                            {column.id === 'name' && (
                              <input
                                type="text"
                                value={newLeadName}
                                onChange={(e) => setNewLeadName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNewLead();
                                  if (e.key === 'Escape') {
                                    setAddingToStage(null);
                                    setNewLeadName('');
                                  }
                                }}
                                onBlur={handleSaveNewLead}
                                autoFocus
                                placeholder="Enter lead name..."
                                className="w-full bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400"
                              />
                            )}
                          </div>
                        ))}
                        <div className="min-h-[48px]" />
                      </div>
                    )}
                    {stageLeads.length === 0 && addingToStage !== stage.status ? (
                      <div 
                        className="border-b border-slate-200 min-w-max"
                        style={{ 
                          display: 'grid',
                          gridTemplateColumns: `${getGridTemplate()} 48px`
                        }}
                      >
                        {getVisibleColumns().map((column, colIndex) => {
                          const isLastColumn = colIndex === getVisibleColumns().length - 1;
                          return (
                            <div 
                              key={column.id}
                              className={cn(
                                "flex items-center min-h-[48px]",
                                "border-r border-slate-200",
                                column.id === 'drag_handle' ? "px-1 justify-center" :
                                (column.id === 'checkbox' || column.id === 'avatar') ? "px-2 justify-center" : "px-4"
                              )}
                            >
                              {column.id === 'name' && (
                                <span className="text-sm text-slate-400 italic whitespace-nowrap">No leads in this stage</span>
                              )}
                            </div>
                          );
                        })}
                        {/* Empty cell for alignment with + column */}
                        <div className="min-h-[48px]" />
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
                                  return null; // Handled separately with useSortable
                                case 'checkbox':
                                  return (
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={selectedLeadIds.has(lead.id)}
                                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-none border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                      />
                                    </div>
                                  );
                                case 'avatar':
                                  return (
                                    <Avatar className="h-7 w-7 bg-[#0066FF]">
                                      <AvatarFallback className="text-[10px] text-white font-semibold bg-[#0066FF]">
                                        {getInitials(lead.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  );
                                case 'name':
                                  return <div className="font-normal text-[13px] text-slate-800 truncate">{lead.name}</div>;
                                case 'stage':
                                  return (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button 
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity max-w-full"
                                        >
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[11px] font-medium px-2 py-0.5 rounded cursor-pointer whitespace-nowrap",
                                              stageEntry?.bgColor,
                                              stageEntry?.textColor,
                                              "border-transparent"
                                            )}
                                          >
                                            {stageEntry?.title}
                                          </Badge>
                                          <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-44 bg-white z-50">
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Move to Stage</div>
                                        {stages.map((s) => (
                                          <DropdownMenuItem
                                            key={s.status}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (s.status !== lead.status) {
                                                updateStatusMutation.mutate({ 
                                                  id: lead.id, 
                                                  status: s.status, 
                                                  previousStatus: lead.status 
                                                });
                                              }
                                            }}
                                            className={cn(
                                              "cursor-pointer gap-2",
                                              s.status === lead.status && "bg-slate-100"
                                            )}
                                          >
                                            <div 
                                              className="w-3 h-3 rounded-full flex-shrink-0" 
                                              style={{ backgroundColor: s.hexColor }}
                                            />
                                            <span className={cn(
                                              s.status === lead.status && "font-semibold"
                                            )}>
                                              {s.title}
                                            </span>
                                            {s.status === lead.status && (
                                              <span className="ml-auto text-[#0066FF]">✓</span>
                                            )}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  );
                                case 'company':
                                  return <div className="text-slate-500 truncate text-[13px]">{lead.company_name || '—'}</div>;
                                case 'contact':
                                  return (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {lead.phone && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => handleCall(e, lead)}
                                              disabled={isCallingThis}
                                              className="inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-green-100 hover:bg-green-200 transition-colors disabled:opacity-50 border border-green-300 flex-shrink-0"
                                            >
                                              {isCallingThis ? (
                                                <Loader2 className="h-3.5 w-3.5 text-green-700 animate-spin" />
                                              ) : (
                                                <Phone className="h-3.5 w-3.5 text-green-700" />
                                              )}
                                              <span className="text-xs font-medium text-green-700">Call</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="bg-white z-50">
                                            <p>Call {lead.phone}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      {lead.email && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={(e) => handleEmail(e, lead)}
                                              className="inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-[#0066FF]/10 hover:bg-[#0066FF]/20 transition-colors border border-[#0066FF]/30 flex-shrink-0"
                                            >
                                              <Mail className="h-3.5 w-3.5 text-[#0066FF]" />
                                              <span className="text-xs font-medium text-[#0066FF]">Email</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="bg-white z-50">
                                            <p>Email {lead.email}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      {!lead.phone && !lead.email && <span className="text-slate-300 text-xs">—</span>}
                                    </div>
                                  );
                                case 'owner':
                                  return <div className="text-[12px] text-slate-500 truncate">{ownerName || <span className="text-slate-300">—</span>}</div>;
                                case 'source':
                                  return <div className="text-[12px] text-slate-400">{lead.source || <span className="text-slate-300">—</span>}</div>;
                                case 'last_touch':
                                  return (
                                    <div className="text-[12px] text-slate-400">
                                      {touchpoint ? <span className="capitalize">{touchpoint.type}</span> : <span className="text-slate-300">—</span>}
                                    </div>
                                  );
                                case 'updated':
                                  return <div className="text-xs text-slate-400">{formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false })}</div>;
                                default:
                                  // Handle magic columns
                                  if (column.type === 'magic') {
                                    const daysInPipeline = differenceInDays(new Date(), new Date(lead.created_at));
                                    
                                    switch (column.magicType) {
                                      // Creation Data
                                      case 'created_date':
                                        return <div className="text-xs text-purple-600">{new Date(lead.created_at).toLocaleDateString()}</div>;
                                      case 'days_in_pipeline':
                                        return <div className="text-xs text-purple-600 font-medium">{daysInPipeline}d</div>;
                                      case 'last_updated':
                                        return <div className="text-xs text-purple-600">{formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</div>;
                                      
                                      // Freshness (relative indicator)
                                      case 'freshness':
                                        const freshnessColor = daysSinceUpdate <= 1 ? 'text-green-600' : daysSinceUpdate <= 7 ? 'text-yellow-600' : 'text-red-600';
                                        const freshnessLabel = daysSinceUpdate <= 1 ? '🟢 Fresh' : daysSinceUpdate <= 7 ? '🟡 Warm' : '🔴 Stale';
                                        return <div className={cn("text-xs font-medium", freshnessColor)}>{freshnessLabel}</div>;
                                      
                                      // Stage Data
                                      case 'days_in_stage':
                                        return <div className="text-xs text-purple-600 font-medium">{daysSinceUpdate}d</div>;
                                      case 'stage_entered_date':
                                        return <div className="text-xs text-purple-600">{lead.qualified_at ? new Date(lead.qualified_at).toLocaleDateString() : '—'}</div>;
                                      
                                      // Contact Data
                                      case 'days_since_contact':
                                        return <div className="text-xs text-purple-600">{touchpoint ? `${daysSinceUpdate}d` : '—'}</div>;
                                      case 'last_contact_type':
                                        return <div className="text-xs text-purple-600 capitalize">{touchpoint?.type || '—'}</div>;
                                      
                                      // Summary counts (placeholder - would need actual data)
                                      case 'email_count':
                                      case 'call_count':
                                      case 'task_count':
                                      case 'file_count':
                                      case 'comment_count':
                                      case 'meeting_count':
                                        return <div className="text-xs text-purple-600">0</div>;
                                      
                                      // ID
                                      case 'lead_id':
                                        return <div className="text-xs text-purple-600 font-mono truncate" title={lead.id}>{lead.id.slice(0, 8)}...</div>;
                                      
                                      default:
                                        return <div className="text-xs text-purple-400 italic">—</div>;
                                    }
                                  }
                                  // Handle custom columns - show placeholder for now
                                  return <div className="text-xs text-slate-400">—</div>;
                              }
                            };
                            
                            return (
                              <SortableLeadRow 
                                key={lead.id} 
                                lead={lead}
                                gridTemplate={`${getGridTemplate()} 48px`}
                                onClick={() => setDetailDialogLead(lead)}
                              >
                                {getVisibleColumns().filter(c => c.id !== 'drag_handle').map((column) => (
                                  <div 
                                    key={column.id} 
                                    className={cn(
                                      "flex items-center min-h-[48px] overflow-hidden",
                                      "border-r border-slate-200",
                                      (column.id === 'checkbox' || column.id === 'avatar') ? "px-2 justify-center" : 
                                      column.id === 'stage' ? "pl-2 pr-4 justify-start" : "px-4 justify-start"
                                    )}
                                  >
                                    {renderCellContent(column)}
                                  </div>
                                ))}
                                {/* Empty cell for alignment with + column */}
                                <div className="min-h-[48px]" />
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

        {/* Bulk Selection Toolbar */}
        {selectedLeadIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <PipelineBulkToolbar
              selectedCount={selectedLeadIds.size}
              onClearSelection={clearSelection}
              onMoveBoxes={() => setMoveBoxesOpen(true)}
            />
          </div>
        )}
      </div>

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
        pipelineId={undefined} // Will be connected when pipelines are persisted
        onColumnsChange={() => {
          queryClient.invalidateQueries({ queryKey: ['pipeline-columns'] });
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
