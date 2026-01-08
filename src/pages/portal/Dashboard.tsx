import { useEffect, useState } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Receipt, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const PortalDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ contracts: 0, invoices: 0, messages: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      const [contracts, invoices, messages] = await Promise.all([
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('client_id', user.id).in('status', ['sent', 'viewed']),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('client_id', user.id).in('status', ['sent', 'viewed', 'overdue']),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', user.id),
      ]);
      setStats({ contracts: contracts.count || 0, invoices: invoices.count || 0, messages: messages.count || 0 });
    };
    fetchStats();
  }, [user]);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome to Your Portal</h1>
          <p className="text-muted-foreground">Manage your contracts, invoices, and communicate with our team</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Contracts</CardTitle><FileText className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.contracts}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle><Receipt className="h-5 w-5 text-amber-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.invoices}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Conversations</CardTitle><MessageSquare className="h-5 w-5 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.messages}</div></CardContent></Card>
        </div>
      </div>
    </PortalLayout>
  );
};
export default PortalDashboard;
