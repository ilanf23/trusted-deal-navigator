import { useState } from 'react';
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
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  BarChart3
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
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data for campaigns
const mockCampaigns = [
  { 
    id: '1', 
    name: 'January Rate Update', 
    subject: 'New Year, New Rates - Special Offers Inside',
    status: 'sent',
    sentAt: '2026-01-10T10:00:00Z',
    recipients: 1250,
    openRate: 42.5,
    clickRate: 12.3
  },
  { 
    id: '2', 
    name: 'Q1 Market Insights', 
    subject: 'Commercial Real Estate Trends to Watch in 2026',
    status: 'scheduled',
    scheduledFor: '2026-01-20T09:00:00Z',
    recipients: 1180,
    openRate: null,
    clickRate: null
  },
  { 
    id: '3', 
    name: 'Welcome Series - Email 1', 
    subject: 'Welcome to Commercial Lending X',
    status: 'draft',
    recipients: 0,
    openRate: null,
    clickRate: null
  },
  { 
    id: '4', 
    name: 'Holiday Promotion', 
    subject: 'End of Year Financing Options',
    status: 'sent',
    sentAt: '2025-12-15T11:00:00Z',
    recipients: 1100,
    openRate: 38.2,
    clickRate: 8.7
  },
];

// Mock subscribers
const mockSubscribers = [
  { id: '1', email: 'john.smith@company.com', name: 'John Smith', subscribedAt: '2025-11-15', status: 'active', source: 'Website' },
  { id: '2', email: 'sarah.jones@enterprise.com', name: 'Sarah Jones', subscribedAt: '2025-12-01', status: 'active', source: 'Lead Form' },
  { id: '3', email: 'mike.wilson@startup.io', name: 'Mike Wilson', subscribedAt: '2025-12-20', status: 'active', source: 'Website' },
  { id: '4', email: 'lisa.chen@corp.com', name: 'Lisa Chen', subscribedAt: '2026-01-05', status: 'unsubscribed', source: 'Referral' },
  { id: '5', email: 'david.brown@biz.com', name: 'David Brown', subscribedAt: '2026-01-10', status: 'active', source: 'Website' },
];

// Mock templates
const mockTemplates = [
  { id: '1', name: 'Rate Update', description: 'Monthly rate update template', lastModified: '2026-01-08' },
  { id: '2', name: 'Market Insights', description: 'Quarterly market analysis newsletter', lastModified: '2026-01-05' },
  { id: '3', name: 'Welcome Email', description: 'New subscriber welcome message', lastModified: '2025-12-20' },
  { id: '4', name: 'Promotional Offer', description: 'Special financing offers template', lastModified: '2025-12-15' },
];

const Newsletter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', content: '' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Sent</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Scheduled</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = [
    { label: 'Total Subscribers', value: '1,247', icon: Users, change: '+12%' },
    { label: 'Campaigns Sent', value: '24', icon: Send, change: '+3' },
    { label: 'Avg. Open Rate', value: '41.2%', icon: Eye, change: '+2.5%' },
    { label: 'Avg. Click Rate', value: '11.8%', icon: TrendingUp, change: '+1.2%' },
  ];

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
                <Button variant="secondary" onClick={() => setCreateCampaignOpen(false)}>
                  Save as Draft
                </Button>
                <Button onClick={() => setCreateCampaignOpen(false)}>
                  <Send className="w-4 h-4 mr-2" />
                  Send Now
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
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-500">{stat.change}</span> from last month
                </p>
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
                    {mockCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="text-sm text-muted-foreground">{campaign.subject}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>{campaign.recipients.toLocaleString()}</TableCell>
                        <TableCell>
                          {campaign.openRate !== null ? `${campaign.openRate}%` : '—'}
                        </TableCell>
                        <TableCell>
                          {campaign.clickRate !== null ? `${campaign.clickRate}%` : '—'}
                        </TableCell>
                        <TableCell>
                          {campaign.sentAt 
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledFor
                              ? new Date(campaign.scheduledFor).toLocaleDateString()
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
                              <DropdownMenuItem className="text-destructive">
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
                      <Input placeholder="Search subscribers..." className="pl-8" />
                    </div>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Subscriber
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                    {mockSubscribers.map((subscriber) => (
                      <TableRow key={subscriber.id}>
                        <TableCell className="font-medium">{subscriber.email}</TableCell>
                        <TableCell>{subscriber.name}</TableCell>
                        <TableCell>
                          {subscriber.status === 'active' ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unsubscribed</Badge>
                          )}
                        </TableCell>
                        <TableCell>{subscriber.source}</TableCell>
                        <TableCell>{new Date(subscriber.subscribedAt).toLocaleDateString()}</TableCell>
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
                              <DropdownMenuItem className="text-destructive">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Create New Template Card */}
              <Card className="border-dashed cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="font-medium">Create New Template</span>
                </CardContent>
              </Card>

              {/* Template Cards */}
              {mockTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
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
                          <DropdownMenuItem className="text-destructive">
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
                      Last modified: {new Date(template.lastModified).toLocaleDateString()}
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
                    <p className="text-sm">Connect to analytics to see data</p>
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
                    <p className="text-sm">Connect to analytics to see data</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Campaign Performance</CardTitle>
                  <CardDescription>Comparison of your last 5 campaigns</CardDescription>
                </CardHeader>
                <CardContent>
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
                      {mockCampaigns.filter(c => c.status === 'sent').map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>{campaign.recipients.toLocaleString()}</TableCell>
                          <TableCell>{Math.round(campaign.recipients * 0.98).toLocaleString()}</TableCell>
                          <TableCell>
                            {Math.round(campaign.recipients * (campaign.openRate! / 100)).toLocaleString()} ({campaign.openRate}%)
                          </TableCell>
                          <TableCell>
                            {Math.round(campaign.recipients * (campaign.clickRate! / 100)).toLocaleString()} ({campaign.clickRate}%)
                          </TableCell>
                          <TableCell>{Math.round(campaign.recipients * 0.002)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
