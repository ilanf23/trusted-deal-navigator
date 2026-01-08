import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Contract = Database['public']['Tables']['contracts']['Row'];
type ContractStatus = Database['public']['Enums']['contract_status'];

interface Client {
  id: string;
  user_id: string;
  email: string | null;
  company_name: string | null;
}

const statusColors: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-yellow-100 text-yellow-800',
  signed: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const AdminContracts = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [newContract, setNewContract] = useState({
    client_id: '',
    title: '',
    content: '',
  });

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, user_id, email, company_name');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchClients();
  }, []);

  const handleCreateContract = async () => {
    if (!newContract.client_id || !newContract.title || !newContract.content) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('contracts').insert({
        client_id: newContract.client_id,
        title: newContract.title,
        content: newContract.content,
        status: 'draft',
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Contract created successfully' });
      setIsCreateOpen(false);
      setNewContract({ client_id: '', title: '', content: '' });
      fetchContracts();
    } catch (error) {
      console.error('Error creating contract:', error);
      toast({ title: 'Error', description: 'Failed to create contract', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendContract = async (contractId: string) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', contractId);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Contract sent to client' });
      fetchContracts();
    } catch (error) {
      console.error('Error sending contract:', error);
      toast({ title: 'Error', description: 'Failed to send contract', variant: 'destructive' });
    }
  };

  const getClientEmail = (clientId: string) => {
    const client = clients.find(c => c.user_id === clientId);
    return client?.email || client?.company_name || 'Unknown';
  };

  const filteredContracts = contracts.filter((contract) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return contract.title.toLowerCase().includes(searchLower);
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contracts</h1>
            <p className="text-muted-foreground">Create and manage client contracts</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>Draft a contract to send to a client</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="client">Client *</Label>
                  <Select value={newContract.client_id} onValueChange={(value) => setNewContract({ ...newContract, client_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.user_id} value={client.user_id}>
                          {client.email || client.company_name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newContract.title}
                    onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                    placeholder="Commercial Loan Agreement"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Contract Content *</Label>
                  <Textarea
                    id="content"
                    value={newContract.content}
                    onChange={(e) => setNewContract({ ...newContract, content: e.target.value })}
                    placeholder="Enter the full contract terms and conditions..."
                    rows={10}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateContract} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Contract
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search contracts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No contracts found. Create your first contract to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell>{getClientEmail(contract.client_id)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[contract.status]}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(contract.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setIsViewOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {contract.status === 'draft' && (
                            <Button size="sm" onClick={() => handleSendContract(contract.id)}>
                              Send
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedContract?.title}</DialogTitle>
              <DialogDescription>
                Status: {selectedContract?.status} | Created: {selectedContract?.created_at ? new Date(selectedContract.created_at).toLocaleDateString() : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm">
              {selectedContract?.content}
            </div>
            {selectedContract?.signature_data && (
              <div className="border-t pt-4">
                <p className="font-medium">Signed by: {selectedContract.signer_name}</p>
                <p className="text-sm text-muted-foreground">IP: {selectedContract.signer_ip}</p>
                <p className="text-sm text-muted-foreground">
                  Date: {selectedContract.signed_at ? new Date(selectedContract.signed_at).toLocaleString() : ''}
                </p>
                <img src={selectedContract.signature_data} alt="Signature" className="mt-2 border rounded" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminContracts;
