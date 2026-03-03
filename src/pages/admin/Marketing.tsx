import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { Loader2, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const COLORS = ['hsl(217, 71%, 22%)', 'hsl(32, 95%, 44%)', 'hsl(187, 71%, 35%)', 'hsl(215, 16%, 47%)', 'hsl(142, 71%, 35%)', 'hsl(0, 84%, 60%)'];

const statusColors: Record<LeadStatus, string> = {
  initial_review: 'bg-blue-100 text-blue-800',
  moving_to_underwriting: 'bg-cyan-100 text-cyan-800',
  onboarding: 'bg-amber-100 text-amber-800',
  underwriting: 'bg-orange-100 text-orange-800',
  ready_for_wu_approval: 'bg-purple-100 text-purple-800',
  pre_approval_issued: 'bg-violet-100 text-violet-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  discovery: 'bg-blue-50 text-blue-700',
  questionnaire: 'bg-indigo-100 text-indigo-800',
  pre_qualification: 'bg-cyan-50 text-cyan-700',
  document_collection: 'bg-yellow-100 text-yellow-800',
  approval: 'bg-green-50 text-green-700',
  funded: 'bg-purple-100 text-purple-800',
  review_kill_keep: 'bg-red-100 text-red-800',
  waiting_on_needs_list: 'bg-amber-100 text-amber-800',
  waiting_on_client: 'bg-yellow-100 text-yellow-800',
  complete_files_for_review: 'bg-teal-100 text-teal-800',
  need_structure_from_brad: 'bg-indigo-100 text-indigo-800',
  maura_underwriting: 'bg-pink-100 text-pink-800',
  brad_underwriting: 'bg-sky-100 text-sky-800',
  uw_paused: 'bg-gray-100 text-gray-800',
};

const AdminMarketing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [leadsBySource, setLeadsBySource] = useState<{ name: string; value: number; converted: number }[]>([]);
  const [leadsByStatus, setLeadsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [monthlyLeads, setMonthlyLeads] = useState<{ month: string; leads: number; qualified: number; converted: number }[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    conversionRate: 0,
    qualifiedLeads: 0,
    newLeadsThisWeek: 0,
    avgTimeToQualify: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: leadsData, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        
        if (error) throw error;

        if (leadsData) {
          setLeads(leadsData);
          
          // Get unique sources
          const uniqueSources = [...new Set(leadsData.map(l => l.source).filter(Boolean))] as string[];
          setSources(uniqueSources);

          // Total leads
          const total = leadsData.length;
          
          // Leads by source with conversion data
          const sourceMap = new Map<string, { total: number; converted: number }>();
          leadsData.forEach(lead => {
            const source = lead.source || 'Unknown';
            const current = sourceMap.get(source) || { total: 0, converted: 0 };
            current.total += 1;
            if (lead.status === 'funded') current.converted += 1;
            sourceMap.set(source, current);
          });
          setLeadsBySource(
            Array.from(sourceMap.entries())
              .map(([name, data]) => ({ name, value: data.total, converted: data.converted }))
              .sort((a, b) => b.value - a.value)
          );

          // Leads by status
          const statusMap = new Map<string, number>();
          leadsData.forEach(lead => {
            statusMap.set(lead.status, (statusMap.get(lead.status) || 0) + 1);
          });
          setLeadsByStatus(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })));

          // Monthly leads (last 6 months) with qualified and converted
          const monthlyMap = new Map<string, { leads: number; qualified: number; converted: number }>();
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            monthlyMap.set(key, { leads: 0, qualified: 0, converted: 0 });
          }
          leadsData.forEach(lead => {
            const date = new Date(lead.created_at);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            if (monthlyMap.has(key)) {
              const current = monthlyMap.get(key)!;
              current.leads += 1;
              if (lead.status === 'approval' || lead.status === 'funded') current.qualified += 1;
              if (lead.status === 'funded') current.converted += 1;
            }
          });
          setMonthlyLeads(Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })));

          // Stats
          const qualified = leadsData.filter(l => l.status === 'approval' || l.status === 'funded').length;
          const converted = leadsData.filter(l => l.status === 'funded').length;
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const newThisWeek = leadsData.filter(l => new Date(l.created_at) > oneWeekAgo).length;
          
          setStats({
            totalLeads: total,
            conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
            qualifiedLeads: qualified,
            newLeadsThisWeek: newThisWeek,
            avgTimeToQualify: 12, // Mock average days
          });
        }
      } catch (error) {
        console.error('Error fetching marketing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredLeadsBySource = selectedSource === 'all' 
    ? leads 
    : leads.filter(l => l.source === selectedSource);

  const handleViewLeads = (source: string) => {
    navigate(`/admin/leads?source=${encodeURIComponent(source)}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Marketing Analytics</h1>
            <p className="text-muted-foreground">Track lead sources, conversion rates, and trends</p>
          </div>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map(source => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="w-3 h-3 text-green-500 mr-1" />
                +{stats.newLeadsThisWeek} this week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Qualified</CardTitle>
              <Target className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.qualifiedLeads}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalLeads > 0 ? Math.round((stats.qualifiedLeads / stats.totalLeads) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="w-3 h-3 text-green-500 mr-1" />
                +5% vs last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New This Week</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.newLeadsThisWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {sources.length} sources
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Days to Qualify</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgTimeToQualify}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowDownRight className="w-3 h-3 text-green-500 mr-1" />
                -2 days vs avg
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Lead Trend</CardTitle>
              <CardDescription>New leads, qualified, and converted over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyLeads}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="leads" stackId="1" stroke="hsl(217, 71%, 22%)" fill="hsl(217, 71%, 22%)" fillOpacity={0.6} name="Total Leads" />
                    <Area type="monotone" dataKey="qualified" stackId="2" stroke="hsl(142, 71%, 35%)" fill="hsl(142, 71%, 35%)" fillOpacity={0.6} name="Qualified" />
                    <Area type="monotone" dataKey="converted" stackId="3" stroke="hsl(32, 95%, 44%)" fill="hsl(32, 95%, 44%)" fillOpacity={0.6} name="Converted" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Status Distribution</CardTitle>
              <CardDescription>Current pipeline breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {leadsByStatus.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads by Source Table */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Source</CardTitle>
            <CardDescription>Click on a source to view all leads from that channel</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Total Leads</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Converted</TableHead>
                  <TableHead className="text-right">Conversion Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsBySource.map((source, index) => (
                  <TableRow key={source.name} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        {source.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{source.value}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{source.converted}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={source.converted / source.value >= 0.15 ? "default" : "secondary"}>
                        {source.value > 0 ? Math.round((source.converted / source.value) * 100) : 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleViewLeads(source.name)}>
                        View Leads
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Source Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
            <CardDescription>Compare lead volume and conversions across channels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsBySource} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="hsl(217, 71%, 22%)" name="Total Leads" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="converted" fill="hsl(142, 71%, 35%)" name="Converted" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Leads from Selected Source */}
        {selectedSource !== 'all' && (
          <Card>
            <CardHeader>
              <CardTitle>Leads from {selectedSource}</CardTitle>
              <CardDescription>{filteredLeadsBySource.length} leads from this source</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeadsBySource.slice(0, 10).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.company_name || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">{lead.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMarketing;
