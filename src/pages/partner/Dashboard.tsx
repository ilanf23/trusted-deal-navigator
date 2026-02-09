import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  funded: 'bg-emerald-100 text-emerald-800',
};

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, funded: 0, commissions: 0 });
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: referrals } = await supabase
        .from('partner_referrals')
        .select('*')
        .eq('partner_id', user.id)
        .order('created_at', { ascending: false });

      const { data: commissions } = await supabase
        .from('partner_commissions')
        .select('amount')
        .eq('partner_id', user.id);

      const refs = referrals || [];
      const totalCommissions = (commissions || []).reduce((sum, c) => sum + Number(c.amount), 0);

      setStats({
        total: refs.length,
        active: refs.filter(r => ['in_review', 'approved'].includes(r.status)).length,
        funded: refs.filter(r => r.status === 'funded').length,
        commissions: totalCommissions,
      });
      setRecentReferrals(refs.slice(0, 5));
    };

    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('partner-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_referrals', filter: `partner_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const cards = [
    { title: 'Total Referrals', value: stats.total, icon: Users, color: 'text-blue-600' },
    { title: 'Active Referrals', value: stats.active, icon: Clock, color: 'text-yellow-600' },
    { title: 'Funded Deals', value: stats.funded, icon: CheckCircle, color: 'text-emerald-600' },
    { title: 'Total Commissions', value: `$${stats.commissions.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
  ];

  return (
    <PartnerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Partner Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold mt-1">{card.value}</p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {recentReferrals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No referrals yet. Submit your first referral!</p>
            ) : (
              <div className="space-y-3">
                {recentReferrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.company_name} • {format(new Date(r.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <Badge className={statusColors[r.status] || 'bg-muted text-muted-foreground'} variant="secondary">
                      {r.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PartnerLayout>
  );
};

export default PartnerDashboard;
