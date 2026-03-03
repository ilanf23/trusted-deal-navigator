import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const PartnerCommissions = () => {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('partner_commissions')
        .select('*, partner_referrals(name, company_name)')
        .eq('partner_id', user.id)
        .order('created_at', { ascending: false });
      setCommissions(data || []);
    };
    fetch();
  }, [user]);

  const total = commissions.reduce((s, c) => s + Number(c.amount), 0);
  const pending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);
  const paid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0);

  const summaryCards = [
    { title: 'Total Earned', value: `$${total.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
    { title: 'Pending', value: `$${pending.toLocaleString()}`, icon: Clock, color: 'text-yellow-600' },
    { title: 'Paid', value: `$${paid.toLocaleString()}`, icon: CheckCircle, color: 'text-emerald-600' },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
    };
    return <Badge className={colors[status] || ''} variant="secondary">{status}</Badge>;
  };

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Commissions</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summaryCards.map((card) => (
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
            <CardTitle className="text-lg">Commission History</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No commissions yet.</p>
            ) : (
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.partner_referrals?.name || 'N/A'}
                        {c.partner_referrals?.company_name && (
                          <span className="text-muted-foreground text-xs ml-2">{c.partner_referrals.company_name}</span>
                        )}
                      </TableCell>
                      <TableCell>${Number(c.amount).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default PartnerCommissions;
