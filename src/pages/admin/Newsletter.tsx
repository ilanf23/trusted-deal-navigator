import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Send, 
  Users, 
  FileText, 
  Plus, 
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Clock,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Loader2
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
import { Label } from '@/components/ui/label';
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

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string | null;
  subscribed_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  content: string;
  updated_at: string;
}

const Newsletter = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [addSubscriberOpen, setAddSubscriberOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', content: '' });
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', subject: '', content: '' });
  const [newSubscriber, setNewSubscriber] = useState({ email: '', name: '', source: 'Manual' });

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

  // Fetch subscribers
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery({
    queryKey: ['newsletter-subscribers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });
      if (error) throw error;
      return data as Subscriber[];
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

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; subject: string; content: string; status: string }) => {
      const { error } = await supabase
        .from('newsletter_campaigns')
        .insert([data]);
      if (error) throw error;
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

  // Add subscriber mutation
  const addSubscriberMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; source: string }) => {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ ...data, status: 'active' }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscribers'] });
      setAddSubscriberOpen(false);
      setNewSubscriber({ email: '', name: '', source: 'Manual' });
      toast.success('Subscriber added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add subscriber: ' + error.message);
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

  // Delete subscriber mutation
  const deleteSubscriberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscribers'] });
      toast.success('Subscriber removed');
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

  // Calculate stats
  const activeSubscribers = subscribers.filter(s => s.status === 'active').length;
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
    { label: 'Total Subscribers', value: activeSubscribers.toLocaleString(), icon: Users },
    { label: 'Campaigns Sent', value: sentCampaigns.toString(), icon: Send },
    { label: 'Avg. Open Rate', value: avgOpenRate > 0 ? `${avgOpenRate.toFixed(1)}%` : '—', icon: Eye },
    { label: 'Avg. Click Rate', value: avgClickRate > 0 ? `${avgClickRate.toFixed(1)}%` : '—', icon: TrendingUp },
  ];

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubscribers = subscribers.filter(s =>
    s.email.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
    (s.name && s.name.toLowerCase().includes(subscriberSearch.toLowerCase()))
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
            <p className="text-muted-foreground">Manage email campaigns, subscribers, and templates</p>
          </div>
          <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  Create a new email campaign to send to your subscribers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
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
                  <Textarea 
                    id="content" 
                    placeholder="Write your email content here..."
                    className="min-h-[200px]"
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateCampaignOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => createCampaignMutation.mutate({ ...newCampaign, status: 'draft' })}
                  disabled={!newCampaign.name || !newCampaign.subject || createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save as Draft
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
            <TabsTrigger value="subscribers" className="gap-2">
              <Users className="w-4 h-4" />
              Subscribers
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
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search campaigns..." 
                      className="pl-8"
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
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
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

          {/* Subscribers Tab */}
          <TabsContent value="subscribers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscribers</CardTitle>
                    <CardDescription>Manage your newsletter subscribers</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search subscribers..." 
                        className="pl-8"
                        value={subscriberSearch}
                        onChange={(e) => setSubscriberSearch(e.target.value)}
                      />
                    </div>
                    <Dialog open={addSubscriberOpen} onOpenChange={setAddSubscriberOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Subscriber
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Subscriber</DialogTitle>
                          <DialogDescription>
                            Add a new subscriber to your newsletter list.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="sub-email">Email</Label>
                            <Input 
                              id="sub-email" 
                              type="email"
                              placeholder="email@example.com"
                              value={newSubscriber.email}
                              onChange={(e) => setNewSubscriber(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sub-name">Name (optional)</Label>
                            <Input 
                              id="sub-name" 
                              placeholder="John Smith"
                              value={newSubscriber.name}
                              onChange={(e) => setNewSubscriber(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAddSubscriberOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => addSubscriberMutation.mutate(newSubscriber)}
                            disabled={!newSubscriber.email || addSubscriberMutation.isPending}
                          >
                            {addSubscriberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Subscriber
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {subscribersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSubscribers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No subscribers yet. Add your first subscriber to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Subscribed</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscribers.map((subscriber) => (
                        <TableRow key={subscriber.id}>
                          <TableCell className="font-medium">{subscriber.email}</TableCell>
                          <TableCell>{subscriber.name || '—'}</TableCell>
                          <TableCell>
                            {subscriber.status === 'active' ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : subscriber.status === 'unsubscribed' ? (
                              <Badge variant="secondary">Unsubscribed</Badge>
                            ) : (
                              <Badge variant="destructive">Bounced</Badge>
                            )}
                          </TableCell>
                          <TableCell>{subscriber.source || '—'}</TableCell>
                          <TableCell>{new Date(subscriber.subscribed_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Mail className="w-4 h-4 mr-2" />
                                  Send Email
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteSubscriberMutation.mutate(subscriber.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove
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
                      <Button size="sm" className="flex-1">
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
                  <CardTitle>Subscriber Growth</CardTitle>
                  <CardDescription>New subscribers over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Growth chart will appear here</p>
                    <p className="text-sm">Add subscribers to see growth data</p>
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
