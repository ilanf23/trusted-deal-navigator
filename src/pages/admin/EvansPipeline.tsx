import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail, Loader2, Users, Star, MoreVertical, Layers, Columns as ColumnsIcon } from 'lucide-react';
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

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// Brand colors: Blue (#0066FF) for early stages, Orange (#FF8000) for later stages
const stages: { status: LeadStatus; title: string; bgColor: string; borderColor: string; textColor: string; barColor: string; hexColor: string }[] = [
  { status: 'discovery', title: 'Discovery', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#0066FF]', textColor: 'text-[#0066FF]', barColor: 'bg-[#0066FF]', hexColor: '#0066FF' },
  { status: 'pre_qualification', title: 'Pre-Qual', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#0066FF]', textColor: 'text-[#0066FF]', barColor: 'bg-[#1a75ff]', hexColor: '#1a75ff' },
  { status: 'document_collection', title: 'Doc Collection', bgColor: 'bg-[#3385ff]/10', borderColor: 'border-[#3385ff]', textColor: 'text-[#3385ff]', barColor: 'bg-[#3385ff]', hexColor: '#3385ff' },
  { status: 'underwriting', title: 'Underwriting', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF8000]', textColor: 'text-[#FF8000]', barColor: 'bg-[#FF8000]', hexColor: '#FF8000' },
  { status: 'approval', title: 'Approval', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF8000]', textColor: 'text-[#FF8000]', barColor: 'bg-[#e67300]', hexColor: '#e67300' },
  { status: 'funded', title: 'Funded', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-600', textColor: 'text-emerald-700', barColor: 'bg-emerald-600', hexColor: '#059669' },
];

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
  const [editingNameValue, setEditingNameValue] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [moveBoxesOpen, setMoveBoxesOpen] = useState(false);
  const [addingToStage, setAddingToStage] = useState<LeadStatus | null>(null);
  const [newLeadName, setNewLeadName] = useState('');
  
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
    setCallingLeadId(lead.id);
    makeCallMutation.mutate({ phone: lead.phone, leadId: lead.id });
  };

  const handleEmail = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.email) {
      toast.error('No email address available');
      return;
    }
    // Navigate to Gmail with compose pre-filled
    navigate(`/team/evan/gmail?compose=true&to=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(lead.name)}`);
  };

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, previousStatus }: { id: string; status: LeadStatus; previousStatus: LeadStatus }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const updates: Partial<Lead> = { status };
      if (status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'funded') {
        updates.converted_at = new Date().toISOString();
      }
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;

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
        toast.success('Lead status updated');
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      toast.success('Lead created');
      setAddingToStage(null);
      setNewLeadName('');
    },
    onError: () => toast.error('Failed to create lead'),
  });

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
      <div className="flex flex-col h-full">
        {/* Header - 8px spacing system: mb-6 = 24px */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
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
                  className="text-2xl font-semibold tracking-tight text-slate-900 bg-transparent border-b-2 border-[#0066FF] outline-none px-0 py-0"
                  style={{ width: `${Math.max(editingNameValue.length, 8)}ch` }}
                />
              ) : (
                <h1 
                  className="text-2xl font-semibold tracking-tight text-slate-900 cursor-pointer hover:text-[#0066FF] transition-colors"
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
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-semibold px-2 py-0.5 flex-shrink-0">
                <Star className="h-2.5 w-2.5 mr-1 fill-amber-500" />
                MAIN
              </Badge>
              <HelpTooltip 
                content="Click the pipeline name to rename it. Your main pipeline tracks all your primary leads through the sales process."
                side="bottom"
              />
            </div>
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">{totalLeads} leads</span>
            {!canEdit && (
              <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300 flex-shrink-0">
                <Lock className="h-3 w-3" />
                View Only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && evanId && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSharingModalOpen(true)}
                  className="border-[#0066FF]/30 text-[#0066FF] hover:bg-[#0066FF]/5 h-9"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <HelpTooltip 
                  content="Share this pipeline with team members. You can give them view-only or full edit access to collaborate on leads."
                  side="bottom"
                />
              </div>
            )}
            <Link to="/team/evan/leads">
              <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50 h-9">
                <List className="w-4 h-4 mr-2" />
                List View
              </Button>
            </Link>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50">
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white z-50">
                  <DropdownMenuItem onClick={() => setStageManagerOpen(true)} className="cursor-pointer">
                    <Layers className="h-4 w-4 mr-2" />
                    Stages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColumnManagerOpen(true)} className="cursor-pointer">
                    <ColumnsIcon className="h-4 w-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Pipeline Progress Bar - 8px spacing: mb-8 = 32px */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Stage Progress</span>
          <HelpTooltip 
            content="Click any stage to jump to that section. Each segment shows the count of leads in that stage. Drag leads between stages in the table below to update their status."
            side="right"
          />
        </div>
        <div className="flex h-16 mb-6">
          {stageCounts.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stageCounts.length - 1;
            
            return (
              <div
                key={stage.status}
                className="relative flex-1 cursor-pointer group"
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
                  <div className="flex flex-col items-center text-white pl-2">
                    <span className="text-2xl font-bold tracking-tight leading-none">{stage.count}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-95 mt-0.5 whitespace-nowrap">{stage.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters - 8px spacing: gap-4 = 16px, mb-4 = 16px */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]">
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-4 text-sm border-slate-200 focus:border-[#0066FF] focus:ring-[#0066FF]/20"
            />
            <HelpTooltip 
              content="Search by lead name, email, or company. Results filter in real-time as you type."
              side="right"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48 h-10 border-slate-200">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Filter by source" />
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
            />
          </div>
          <div className="text-sm text-slate-500 whitespace-nowrap">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {/* Grouped Table View - 8px spacing system */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-300 rounded-md bg-white">
          {/* Table Header with Column Dropdowns */}
          <div className="sticky top-0 z-10 bg-slate-50/60 border-b border-slate-200 min-w-max">
            <div 
              className="text-sm font-semibold text-slate-600 uppercase tracking-wider"
              style={{ 
                display: 'grid',
                gridTemplateColumns: `${getGridTemplate()} 48px`
              }}
            >
              {getVisibleColumns().map((column, colIndex) => {
                const isLastColumn = colIndex === getVisibleColumns().length - 1;
                
                // Consistent cell styling with 8px increments
                const getCellPadding = () => {
                  if (column.id === 'checkbox' || column.id === 'avatar') return 'px-2'; // 8px
                  return 'px-4'; // 16px
                };
                
                const cellClass = cn(
                  "flex items-center min-h-[48px]", // 48px = 6 * 8px
                  getCellPadding(),
                  "border-r border-slate-200"
                );
                
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

          {/* Grouped Sections */}
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
                  <CollapsibleTrigger asChild>
                    <div
                      className="cursor-pointer transition-colors flex items-center min-h-[48px] px-4 gap-3 bg-slate-100 border-b border-slate-200"
                    >
                      {/* Checkbox placeholder for alignment */}
                      <div className="w-5 h-5 rounded border border-slate-300 flex-shrink-0" />
                      
                      {/* Stage badge pill */}
                      <span 
                        className="font-semibold text-base px-4 py-1.5 rounded-full whitespace-nowrap"
                        style={{ 
                          backgroundColor: stage.hexColor,
                          color: 'white'
                        }}
                      >
                        {stage.title}
                      </span>
                      
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
                      
                      {/* Collapse indicator */}
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                    </div>
                  </CollapsibleTrigger>

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
                                  return <div className="font-medium text-slate-900 truncate">{lead.name}</div>;
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
                                  return <div className="text-slate-600 truncate text-[13px]">{lead.company_name || '—'}</div>;
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
                                  return <div className="text-xs text-slate-600 truncate">{ownerName || <span className="text-slate-300">—</span>}</div>;
                                case 'source':
                                  return <div className="text-xs text-slate-500">{lead.source || <span className="text-slate-300">—</span>}</div>;
                                case 'last_touch':
                                  return (
                                    <div className="text-xs text-slate-500">
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
                              <div
                                key={lead.id}
                                className="hover:bg-slate-50 cursor-pointer text-base transition-colors border-b border-slate-200 min-w-max"
                                style={{ 
                                  display: 'grid',
                                  gridTemplateColumns: `${getGridTemplate()} 48px`
                                }}
                                onClick={() => setDetailDialogLead(lead)}
                              >
                                {getVisibleColumns().map((column, colIndex) => {
                                  const isLastColumn = colIndex === getVisibleColumns().length - 1;
                                  return (
                                    <div 
                                      key={column.id} 
                                      className={cn(
                                        "flex items-center min-h-[48px] overflow-hidden",
                                        "border-r border-slate-200",
                                        (column.id === 'checkbox' || column.id === 'avatar') ? "px-2 justify-center" : "px-4 justify-start"
                                      )}
                                    >
                                      {renderCellContent(column)}
                                    </div>
                                  );
                                })}
                                {/* Empty cell for alignment with + column */}
                                <div className="min-h-[48px]" />
                              </div>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
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
    </AdminLayout>
  );
};

export default EvansPipeline;
