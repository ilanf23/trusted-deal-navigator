import { useEffect, useState } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type Invoice = Database['public']['Tables']['invoices']['Row'];
const statusColors: Record<string, string> = { draft: 'bg-gray-100 text-gray-800', sent: 'bg-blue-100 text-blue-800', viewed: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800' };

const PortalInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user) return;
      const { data } = await supabase.from('invoices').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
      setInvoices(data || []);
      setLoading(false);
    };
    fetchInvoices();
  }, [user]);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">My Invoices</h1><p className="text-muted-foreground">View your invoices and payment status</p></div>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : invoices.length === 0 ? <div className="text-center py-8 text-muted-foreground">No invoices yet.</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Amount</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>${Number(invoice.amount).toFixed(2)}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                      <TableCell><Badge className={statusColors[invoice.status]}>{invoice.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
};
export default PortalInvoices;
