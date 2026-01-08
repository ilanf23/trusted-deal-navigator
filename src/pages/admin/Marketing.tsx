import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Loader2, TrendingUp, Users, Target, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const COLORS = ['hsl(217, 71%, 22%)', 'hsl(32, 95%, 44%)', 'hsl(187, 71%, 35%)', 'hsl(215, 16%, 47%)'];

const AdminMarketing = () => {
  const [loading, setLoading] = useState(true);
  const [leadsBySource, setLeadsBySource] = useState<{ name: string; value: number }[]>([]);
  const [leadsByStatus, setLeadsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [monthlyLeads, setMonthlyLeads] = useState<{ month: string; leads: number }[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    conversionRate: 0,
    qualifiedLeads: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: leads, error } = await supabase.from('leads').select('*');
        
        if (error) throw error;

        if (leads) {
          // Total leads
          const total = leads.length;
          
          // Leads by source
          const sourceMap = new Map<string, number>();
          leads.forEach(lead => {
            const source = lead.source || 'Unknown';
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
          });
          setLeadsBySource(Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value })));

          // Leads by status
          const statusMap = new Map<string, number>();
          leads.forEach(lead => {
            statusMap.set(lead.status, (statusMap.get(lead.status) || 0) + 1);
          });
          setLeadsByStatus(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })));

          // Monthly leads (last 6 months)
          const monthlyMap = new Map<string, number>();
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleDateString('en-US', { month: 'short' });
            monthlyMap.set(key, 0);
          }
          leads.forEach(lead => {
            const date = new Date(lead.created_at);
            const key = date.toLocaleDateString('en-US', { month: 'short' });
            if (monthlyMap.has(key)) {
              monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
            }
          });
          setMonthlyLeads(Array.from(monthlyMap.entries()).map(([month, leads]) => ({ month, leads })));

          // Stats
          const qualified = leads.filter(l => l.status === 'qualified' || l.status === 'converted').length;
          const converted = leads.filter(l => l.status === 'converted').length;
          
          setStats({
            totalLeads: total,
            conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
            qualifiedLeads: qualified,
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
        <div>
          <h1 className="text-3xl font-bold">Marketing</h1>
          <p className="text-muted-foreground">Analytics and lead performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Leads
              </CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Qualified Leads
              </CardTitle>
              <Target className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.qualifiedLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversion Rate
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Lead Trend</CardTitle>
              <CardDescription>New leads over the past 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyLeads}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" stroke="hsl(217, 71%, 22%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads by Status</CardTitle>
              <CardDescription>Distribution of lead statuses</CardDescription>
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
                      label={({ name, value }) => `${name}: ${value}`}
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Leads by Source</CardTitle>
              <CardDescription>Where your leads are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadsBySource}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(217, 71%, 22%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMarketing;
