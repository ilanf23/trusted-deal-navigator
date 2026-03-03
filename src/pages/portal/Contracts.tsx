import { useEffect, useState } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Contract = Database['public']['Tables']['contracts']['Row'];

const statusColors: Record<string, string> = { draft: 'bg-gray-100 text-gray-800', sent: 'bg-blue-100 text-blue-800', viewed: 'bg-yellow-100 text-yellow-800', signed: 'bg-green-100 text-green-800', expired: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800' };

const PortalContracts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContracts = async () => {
      if (!user) return;
      const { data } = await supabase.from('contracts').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
      setContracts(data || []);
      setLoading(false);
    };
    fetchContracts();
  }, [user]);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">My Contracts</h1><p className="text-muted-foreground">View and sign your contracts</p></div>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : contracts.length === 0 ? <div className="text-center py-8 text-muted-foreground">No contracts yet.</div> : (
              <Table className="min-w-[500px]">
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell><Badge className={statusColors[contract.status]}>{contract.status}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell">{new Date(contract.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => navigate(`/portal/contracts/${contract.id}`)}><Eye className="w-4 h-4 mr-1" />View</Button>
                      </TableCell>
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
export default PortalContracts;
