import { useState, useMemo, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Mail, 
  Send, 
  Users, 
  FileText, 
  Plus, 
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Clock,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Loader2,
  Filter,
  UserCheck,
  Building2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  unsubscribed_count: number;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  content: string;
  updated_at: string;
}

const LEAD_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'initial_review', label: 'Initial Review' },
  { value: 'moving_to_underwriting', label: 'Moving to UW' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'underwriting', label: 'Underwriting' },
  { value: 'ready_for_wu_approval', label: 'Ready for Approval' },
  { value: 'pre_approval_issued', label: 'Pre-Approval Issued' },
  { value: 'won', label: 'Won' },
];

const Newsletter = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Newsletter');
    return () => { setPageTitle(null); };
  }, []);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', content: '' });
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', subject: '', content: '' });
  
  // Lead selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [sendingCampaign, setSendingCampaign] = useState(false);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['newsletter-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    }
  });

  // Fetch leads with emails
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-for-newsletter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, name, email, company_name, status, source, created_at')
        .not('email', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    }
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['newsletter-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    }
  });

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = new Set(leads.map(l => l.source).filter(Boolean));
    return ['all', ...Array.from(sources)] as string[];
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      const matchesSearch = leadSearchQuery === '' || 
        lead.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
        lead.company_name?.toLowerCase().includes(leadSearchQuery.toLowerCase());
      return matchesStatus && matchesSource && matchesSearch;
    });
  }, [leads, statusFilter, sourceFilter, leadSearchQuery]);

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; subject: string; content: string; status: string }) => {
      const { data: campaign, error } = await supabase
        .from('newsletter_campaigns')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-campaigns'] });
      setCreateCampaignOpen(false);
      setNewCampaign({ name: '', subject: '', content: '' });
      toast.success('Campaign created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create campaign: ' + error.message);
    }
  });

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, recipientIds, subject, content }: { 
      campaignId: string; 
      recipientIds: string[]; 
      subject: string; 
      content: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('send-newsletter', {
        body: { campaignId, recipientIds, subject, content },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-campaigns'] });
      setSelectedLeadIds(new Set());
      setSendingCampaign(false);
      toast.success(`Newsletter sent! ${data.delivered} emails delivered${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
    },
    onError: (error) => {
      setSendingCampaign(false);
      toast.error('Failed to send campaign: ' + error.message);
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; subject: string; content: string }) => {
      const { error } = await supabase
        .from('newsletter_templates')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-templates'] });
      setCreateTemplateOpen(false);
      setNewTemplate({ name: '', description: '', subject: '', content: '' });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    }
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('newsletter_campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-campaigns'] });
      toast.success('Campaign deleted');
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('newsletter_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-templates'] });
      toast.success('Template deleted');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Sent</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Scheduled</Badge>;
      case 'sending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Sending</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLeadStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      discovery: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      pre_qualification: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      document_collection: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      underwriting: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      approval: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      funded: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return <Badge className={colors[status] || 'bg-gray-500/10 text-gray-500'}>{status.replace('_', ' ')}</Badge>;
  };

  // Calculate stats
  const leadsWithEmail = leads.length;
  const sentCampaigns = campaigns.filter(c => c.status === 'sent').length;
  const avgOpenRate = sentCampaigns > 0
    ? campaigns
        .filter(c => c.status === 'sent' && c.recipients_count > 0)
        .reduce((acc, c) => acc + (c.opened_count / c.recipients_count) * 100, 0) / 
        Math.max(1, campaigns.filter(c => c.status === 'sent' && c.recipients_count > 0).length)
    : 0;
  const avgClickRate = sentCampaigns > 0
    ? campaigns
        .filter(c => c.status === 'sent' && c.recipients_count > 0)
        .reduce((acc, c) => acc + (c.clicked_count / c.recipients_count) * 100, 0) / 
        Math.max(1, campaigns.filter(c => c.status === 'sent' && c.recipients_count > 0).length)
    : 0;

  const stats = [
    { label: 'Leads with Email', value: leadsWithEmail.toLocaleString(), icon: Users },
    { label: 'Campaigns Sent', value: sentCampaigns.toString(), icon: Send },
    { label: 'Avg. Open Rate', value: avgOpenRate > 0 ? `${avgOpenRate.toFixed(1)}%` : '—', icon: Eye },
    { label: 'Avg. Click Rate', value: avgClickRate > 0 ? `${avgClickRate.toFixed(1)}%` : '—', icon: TrendingUp },
  ];

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle lead selection
  const toggleLeadSelection = (leadId: string) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setSelectedLeadIds(newSet);
  };

  // Select all filtered leads
  const selectAllFiltered = () => {
    const newSet = new Set(selectedLeadIds);
    filteredLeads.forEach(lead => newSet.add(lead.id));
    setSelectedLeadIds(newSet);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  // Handle send campaign
  const handleSendCampaign = async () => {
    if (selectedLeadIds.size === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.content) {
      toast.error('Please fill in all campaign fields');
      return;
    }

    setSendingCampaign(true);

    try {
      // First create the campaign
      const { data: campaign, error } = await supabase
        .from('newsletter_campaigns')
        .insert([{
          name: newCampaign.name,
          subject: newCampaign.subject,
          content: newCampaign.content,
          status: 'sending',
          recipients_count: selectedLeadIds.size,
        }])
        .select()
        .single();

      if (error) throw error;

      // Then send the emails
      await sendCampaignMutation.mutateAsync({
        campaignId: campaign.id,
        recipientIds: Array.from(selectedLeadIds),
        subject: newCampaign.subject,
        content: newCampaign.content,
      });

      setCreateCampaignOpen(false);
      setNewCampaign({ name: '', subject: '', content: '' });
    } catch (error: any) {
      setSendingCampaign(false);
      toast.error('Failed to send campaign: ' + error.message);
    }
  };

  // Use template
  const useTemplate = (template: Template) => {
    setNewCampaign({
      name: `Campaign from ${template.name}`,
      subject: template.subject || '',
      content: template.content,
    });
    setCreateCampaignOpen(true);
  };

  return (
    <AdminLayout>
      <div data-full-bleed className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Create & Send Campaign</DialogTitle>
                <DialogDescription>
                  Select recipients and compose your email campaign.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="recipients" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="recipients" className="gap-2">
                      <Users className="w-4 h-4" />
                      Select Recipients ({selectedLeadIds.size})
                    </TabsTrigger>
                    <TabsTrigger value="compose" className="gap-2">
                      <Edit className="w-4 h-4" />
                      Compose Email
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="recipients" className="flex-1 overflow-hidden mt-4">
                    <div className="space-y-4 h-full flex flex-col">
                      {/* Filters */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <Input 
                            placeholder="Search leads..." 
                            value={leadSearchQuery}
                            onChange={(e) => setLeadSearchQuery(e.target.value)}
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-[180px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Source" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueSources.map(source => (
                              <SelectItem key={source} value={source}>
                                {source === 'all' ? 'All Sources' : source}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Selection actions */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {filteredLeads.length} leads shown, {selectedLeadIds.size} selected
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                            <UserCheck className="w-4 h-4 mr-1" />
                            Select All Shown
                          </Button>
                          {selectedLeadIds.size > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                              Clear Selection
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Leads table */}
                      <ScrollArea className="flex-1 border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Company</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Source</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leadsLoading ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            ) : filteredLeads.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No leads found matching your filters
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredLeads.map((lead) => (
                                <TableRow 
                                  key={lead.id} 
                                  className={selectedLeadIds.has(lead.id) ? 'bg-primary/5' : ''}
                                  onClick={() => toggleLeadSelection(lead.id)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedLeadIds.has(lead.id)}
                                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{lead.name}</TableCell>
                                  <TableCell>{lead.email}</TableCell>
                                  <TableCell>
                                    {lead.company_name && (
                                      <span className="flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        {lead.company_name}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                                  <TableCell>{lead.source || '—'}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="compose" className="flex-1 overflow-auto mt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="campaign-name">Campaign Name</Label>
                        <Input 
                          id="campaign-name" 
                          placeholder="e.g., February Rate Update"
                          value={newCampaign.name}
                          onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Email Subject</Label>
                        <Input 
                          id="subject" 
                          placeholder="e.g., Exclusive Rates for February"
                          value={newCampaign.subject}
                          onChange={(e) => setNewCampaign(prev => ({ ...prev, subject: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="content">Email Content</Label>
                        <p className="text-xs text-muted-foreground">
                          Use {"{{name}}"} to personalize with recipient's name
                        </p>
                        <Textarea 
                          id="content" 
                          placeholder="Dear {{name}},

We're excited to share our latest rates and opportunities with you...

Best regards,
The Commercial Lending X Team"
                          className="min-h-[250px] font-mono text-sm"
                          value={newCampaign.content}
                          onChange={(e) => setNewCampaign(prev => ({ ...prev, content: e.target.value }))}
                        />
                      </div>

                      {/* Selected recipients summary */}
                      {selectedLeadIds.size > 0 && (
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            {selectedLeadIds.size} recipients selected
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Emails will be sent to all selected leads when you click "Send Campaign"
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setCreateCampaignOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => createCampaignMutation.mutate({ ...newCampaign, status: 'draft' })}
                  disabled={!newCampaign.name || !newCampaign.subject || createCampaignMutation.isPending}
                >
                  Save as Draft
                </Button>
                <Button 
                  onClick={handleSendCampaign}
                  disabled={!newCampaign.name || !newCampaign.subject || !newCampaign.content || selectedLeadIds.size === 0 || sendingCampaign}
                >
                  {sendingCampaign ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to {selectedLeadIds.size} Recipients
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns" className="gap-2">
              <Mail className="w-4 h-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Campaigns</CardTitle>
                    <CardDescription>View and manage your email campaigns</CardDescription>
                  </div>
                  <div className="w-64">
                    <Input 
                      placeholder="Search campaigns..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No campaigns yet. Create your first campaign to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Open Rate</TableHead>
                        <TableHead>Click Rate</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-sm text-muted-foreground">{campaign.subject}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>{campaign.recipients_count.toLocaleString()}</TableCell>
                          <TableCell>
                            {campaign.recipients_count > 0 
                              ? `${((campaign.opened_count / campaign.recipients_count) * 100).toFixed(1)}%` 
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {campaign.recipients_count > 0 
                              ? `${((campaign.clicked_count / campaign.recipients_count) * 100).toFixed(1)}%` 
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {campaign.sent_at 
                              ? new Date(campaign.sent_at).toLocaleDateString()
                              : campaign.scheduled_for
                                ? new Date(campaign.scheduled_for).toLocaleDateString()
                                : '—'
                            }
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Create New Template Card */}
              <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
                <DialogTrigger asChild>
                  <Card className="border-dashed cursor-pointer hover:border-primary/50 transition-colors">
                    <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="font-medium">Create New Template</span>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New Template</DialogTitle>
                    <DialogDescription>
                      Create a reusable email template for your campaigns.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input 
                        id="template-name" 
                        placeholder="e.g., Monthly Newsletter"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-desc">Description</Label>
                      <Input 
                        id="template-desc" 
                        placeholder="Brief description of this template"
                        value={newTemplate.description}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-subject">Default Subject</Label>
                      <Input 
                        id="template-subject" 
                        placeholder="e.g., Your Monthly Update"
                        value={newTemplate.subject}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-content">Template Content</Label>
                      <Textarea 
                        id="template-content" 
                        placeholder="Write your template content here..."
                        className="min-h-[200px]"
                        value={newTemplate.content}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateTemplateOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createTemplateMutation.mutate(newTemplate)}
                      disabled={!newTemplate.name || !newTemplate.content || createTemplateMutation.isPending}
                    >
                      {createTemplateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Template
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Loading State */}
              {templatesLoading && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Template Cards */}
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description || 'No description'}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      Last modified: {new Date(template.updated_at).toLocaleDateString()}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => useTemplate(template)}>
                        <Send className="w-4 h-4 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Open and click rates over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Performance chart will appear here</p>
                    <p className="text-sm">Send campaigns to see analytics</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lead Growth</CardTitle>
                  <CardDescription>New leads with emails over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Growth chart will appear here</p>
                    <p className="text-sm">Add leads to see growth data</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Campaign Performance</CardTitle>
                  <CardDescription>Comparison of your sent campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.filter(c => c.status === 'sent').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No sent campaigns yet. Send your first campaign to see performance data.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Delivered</TableHead>
                          <TableHead>Opens</TableHead>
                          <TableHead>Clicks</TableHead>
                          <TableHead>Unsubscribes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.filter(c => c.status === 'sent').map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.name}</TableCell>
                            <TableCell>{campaign.recipients_count.toLocaleString()}</TableCell>
                            <TableCell>{campaign.delivered_count.toLocaleString()}</TableCell>
                            <TableCell>
                              {campaign.opened_count.toLocaleString()}
                              {campaign.recipients_count > 0 && (
                                <span className="text-muted-foreground">
                                  {' '}({((campaign.opened_count / campaign.recipients_count) * 100).toFixed(1)}%)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {campaign.clicked_count.toLocaleString()}
                              {campaign.recipients_count > 0 && (
                                <span className="text-muted-foreground">
                                  {' '}({((campaign.clicked_count / campaign.recipients_count) * 100).toFixed(1)}%)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{campaign.unsubscribed_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Newsletter;
