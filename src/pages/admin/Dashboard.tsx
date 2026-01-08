import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, Receipt, MessageSquare, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalLeads: number;
  activeClients: number;
  pendingInvoices: number;
  unreadMessages: number;
  pendingContracts: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    activeClients: 0,
    pendingInvoices: 0,
    unreadMessages: 0,
    pendingContracts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch leads count
        const { count: leadsCount } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true });

        // Fetch clients count
        const { count: clientsCount } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'client');

        // Fetch pending invoices
        const { count: invoicesCount } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .in('status', ['sent', 'viewed', 'overdue']);

        // Fetch unread messages
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .is('read_at', null);

        // Fetch pending contracts
        const { count: contractsCount } = await supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .in('status', ['sent', 'viewed']);

        setStats({
          totalLeads: leadsCount || 0,
          activeClients: clientsCount || 0,
          pendingInvoices: invoicesCount || 0,
          unreadMessages: messagesCount || 0,
          pendingContracts: contractsCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total Leads', value: stats.totalLeads, icon: UserPlus, color: 'text-blue-600' },
    { title: 'Active Clients', value: stats.activeClients, icon: Users, color: 'text-green-600' },
    { title: 'Pending Invoices', value: stats.pendingInvoices, icon: Receipt, color: 'text-amber-600' },
    { title: 'Pending Contracts', value: stats.pendingContracts, icon: FileText, color: 'text-purple-600' },
    { title: 'Unread Messages', value: stats.unreadMessages, icon: MessageSquare, color: 'text-pink-600' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your admin dashboard</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks for your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href="/admin/leads" className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                <div className="font-medium">Manage Leads</div>
                <div className="text-sm text-muted-foreground">View and qualify new leads</div>
              </a>
              <a href="/admin/contracts" className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                <div className="font-medium">Create Contract</div>
                <div className="text-sm text-muted-foreground">Draft and send new contracts</div>
              </a>
              <a href="/admin/invoices" className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                <div className="font-medium">Create Invoice</div>
                <div className="text-sm text-muted-foreground">Bill clients for services</div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across the portal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm text-center py-8">
                Activity feed will appear here as you use the portal
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
