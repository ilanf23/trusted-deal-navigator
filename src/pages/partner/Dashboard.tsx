import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, CheckCircle, DollarSign, Clock, Send, Eye, Loader2, ArrowRight, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';



const statusConfig: Record<string, { color: string; dot: string; bg: string }> = {
  submitted: { color: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  in_review: { color: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  approved: { color: 'text-green-700 dark:text-green-300', dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950/40' },
  declined: { color: 'text-red-700 dark:text-red-300', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/40' },
  funded: { color: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
};

const statusOrder = ['submitted', 'in_review', 'approved', 'funded', 'declined'];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const PartnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, funded: 0, commissions: 0 });
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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

      const counts: Record<string, number> = {};
      refs.forEach((r) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
      });

      setStats({
        total: refs.length,
        active: refs.filter((r) => ['in_review', 'approved'].includes(r.status)).length,
        funded: refs.filter((r) => r.status === 'funded').length,
        commissions: totalCommissions,
      });
      setStatusCounts(counts);
      setRecentReferrals(refs.slice(0, 5));
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel('partner-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_referrals', filter: `partner_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const statCards = [
    { title: 'Total Referrals', value: stats.total, icon: Users, iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400' },
    { title: 'Active Referrals', value: stats.active, icon: Clock, iconBg: 'bg-yellow-100 dark:bg-yellow-900/40', iconColor: 'text-yellow-600 dark:text-yellow-400' },
    { title: 'Funded Deals', value: stats.funded, icon: CheckCircle, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { title: 'Total Commissions', value: `$${stats.commissions.toLocaleString()}`, icon: DollarSign, iconBg: 'bg-green-100 dark:bg-green-900/40', iconColor: 'text-green-600 dark:text-green-400' },
  ];

  if (loading) {
    return (
      <PartnerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{getGreeting()}! 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your referral overview</p>
        </div>

        {/* Commission Summary */}
        <Card className="border-0 bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Total Commissions Earned</p>
                <p className="text-3xl md:text-4xl font-bold mt-1">${stats.commissions.toLocaleString()}</p>
              </div>
              <div className="text-right border-l border-white/20 pl-8">
                <p className="text-sm font-medium text-white/70">Funded Deals</p>
                <p className="text-3xl font-semibold mt-1">{stats.funded}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold mt-2 text-foreground">{card.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const link = `${window.location.origin}/questionnaire/new`;
              navigator.clipboard.writeText(link);
              toast.success('Invite link copied to clipboard!');
            }}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            Invite Borrower
          </Button>
          <Button onClick={() => navigate('/partner/referrals')} className="gap-2">
            <Send className="h-4 w-4" />
            Recommend Referral
          </Button>
          <Button variant="outline" onClick={() => navigate('/partner/commissions')} className="gap-2">
            <Eye className="h-4 w-4" />
            View Commissions
          </Button>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Referrals */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Recent Referrals</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/partner/referrals')} className="text-xs gap-1 text-muted-foreground">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentReferrals.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No referrals yet. Submit your first referral!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentReferrals.map((r) => {
                    const cfg = statusConfig[r.status] || statusConfig.submitted;
                    return (
                      <div key={r.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                            {getInitials(r.name || 'NA')}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{r.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.company_name && `${r.company_name} · `}
                              {format(new Date(r.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className={`${cfg.bg} ${cfg.color} border-0 gap-1.5`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {r.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusOrder.map((status) => {
                  const count = statusCounts[status] || 0;
                  const maxCount = Math.max(...Object.values(statusCounts), 1);
                  const pct = (count / maxCount) * 100;
                  const cfg = statusConfig[status] || statusConfig.submitted;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          <span className="text-sm capitalize text-foreground">{status.replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.dot} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerDashboard;
