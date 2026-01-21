import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// Pipeline stages with colors matching the screenshot style
const stages: { status: LeadStatus; title: string; color: string; bgColor: string; textColor: string }[] = [
  { status: 'discovery', title: 'Discovery', color: 'bg-amber-500', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  { status: 'pre_qualification', title: 'Pre-Qual', color: 'bg-orange-500', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  { status: 'document_collection', title: 'Doc Collection', color: 'bg-yellow-500', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { status: 'underwriting', title: 'Underwriting', color: 'bg-teal-500', bgColor: 'bg-teal-100', textColor: 'text-teal-800' },
  { status: 'approval', title: 'Approval', color: 'bg-cyan-600', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
  { status: 'funded', title: 'Funded', color: 'bg-emerald-600', bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
];

const EvansPipeline = () => {
  const queryClient = useQueryClient();
  const { teamMember, isOwner } = useTeamMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<LeadStatus, boolean>>({} as Record<LeadStatus, boolean>);

  // Check if current user can edit (is Evan or is owner/super admin)
  const canEdit = isOwner || teamMember?.name?.toLowerCase() === 'evan';

  // Get Evan's team member ID
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

  // Fetch last touchpoint for each lead
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
      
      // Group by lead_id and take the most recent
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

      // Send questionnaire email when moving from discovery to pre_qualification
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-emerald-500',
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-amber-500',
      'bg-cyan-500',
      'bg-rose-500',
      'bg-indigo-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Calculate stage counts and total
  const stageCounts = stages.map(stage => ({
    ...stage,
    count: getLeadsByStatus(stage.status).length
  }));
  const totalLeads = filteredLeads.length;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Evan's Pipeline</h1>
            <span className="text-muted-foreground">{totalLeads} Count</span>
            {!canEdit && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                View Only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/user/evan/leads">
              <Button variant="outline" size="sm">
                <List className="w-4 h-4 mr-2" />
                List View
              </Button>
            </Link>
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        <div className="flex h-14 mb-6 rounded-lg overflow-hidden shadow-sm">
          {stageCounts.map((stage, index) => {
            const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 100 / stages.length;
            return (
              <div
                key={stage.status}
                className={cn(
                  stage.color,
                  "flex items-center justify-center text-white font-medium transition-all cursor-pointer hover:opacity-90",
                  index === 0 && "rounded-l-lg",
                  index === stages.length - 1 && "rounded-r-lg"
                )}
                style={{ flex: Math.max(percentage, 8) }}
                onClick={() => {
                  const element = document.getElementById(`section-${stage.status}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold">{stage.count}</span>
                  <span className="text-xs opacity-90">{stage.title}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-3"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source!}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {/* Grouped Table View */}
        <div className="flex-1 overflow-auto border rounded-lg bg-background">
          {/* Table Header */}
          <div className="sticky top-0 z-10 bg-muted/50 border-b">
            <div className="grid grid-cols-[40px_40px_minmax(180px,1fr)_100px_minmax(120px,1fr)_minmax(140px,1fr)_120px_120px_140px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
              <div></div>
              <div></div>
              <div>Name</div>
              <div>Stage</div>
              <div>Company</div>
              <div>Contact</div>
              <div>Source</div>
              <div>Last Touchpoint</div>
              <div>Updated</div>
            </div>
          </div>

          {/* Grouped Sections */}
          <div className="divide-y">
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
                  {/* Section Header */}
                  <CollapsibleTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors border-l-4",
                        stage.status === 'discovery' && "border-l-amber-500",
                        stage.status === 'pre_qualification' && "border-l-orange-500",
                        stage.status === 'document_collection' && "border-l-yellow-500",
                        stage.status === 'underwriting' && "border-l-teal-500",
                        stage.status === 'approval' && "border-l-cyan-600",
                        stage.status === 'funded' && "border-l-emerald-600"
                      )}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge 
                        className={cn(
                          "font-medium rounded-sm",
                          stage.bgColor,
                          stage.textColor,
                          "border-0"
                        )}
                      >
                        {stage.title}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stageLeads.length} {stageLeads.length === 1 ? 'lead' : 'leads'}
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  {/* Section Content */}
                  <CollapsibleContent>
                    {stageLeads.length === 0 ? (
                      <div className="px-12 py-4 text-sm text-muted-foreground italic">
                        No leads in this stage
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {stageLeads.map((lead) => {
                          const touchpoint = touchpoints[lead.id];
                          return (
                            <div
                              key={lead.id}
                              className="grid grid-cols-[40px_40px_minmax(180px,1fr)_100px_minmax(120px,1fr)_minmax(140px,1fr)_120px_120px_140px] gap-2 px-3 py-2 hover:bg-muted/20 cursor-pointer items-center text-sm"
                              onClick={() => setDetailDialogLead(lead)}
                            >
                              <div className="flex items-center justify-center">
                                <input type="checkbox" className="rounded border-muted-foreground/30" />
                              </div>
                              <div>
                                <Avatar className={cn("h-7 w-7", getAvatarColor(lead.name))}>
                                  <AvatarFallback className="text-[10px] text-white font-medium">
                                    {getInitials(lead.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="font-medium truncate">{lead.name}</div>
                              <div>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 rounded-sm",
                                    stage.bgColor,
                                    stage.textColor,
                                    "border-0"
                                  )}
                                >
                                  {stage.title}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground truncate">
                                {lead.company_name || '—'}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {lead.phone && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <Phone className="h-3 w-3" />
                                  </div>
                                )}
                                {lead.email && (
                                  <div className="flex items-center gap-1 text-xs truncate">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[100px]">{lead.email}</span>
                                  </div>
                                )}
                                {!lead.phone && !lead.email && '—'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {lead.source || '—'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {touchpoint ? (
                                  <span className="capitalize">
                                    {touchpoint.type} • {formatDistanceToNow(new Date(touchpoint.date), { addSuffix: false })}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>
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
    </AdminLayout>
  );
};

export default EvansPipeline;
