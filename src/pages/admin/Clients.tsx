import { useEffect, useState } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataTable, Column } from '@/components/shared/DataTable';

interface Client {
  id: string;
  user_id: string;
  email: string | null;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  created_at: string;
}

const clientColumns: Column<Client>[] = [
  {
    key: 'email',
    header: 'Email',
    render: (row) => <span className="font-medium">{row.email || '-'}</span>,
  },
  {
    key: 'company_name',
    header: 'Company',
    render: (row) => row.company_name || '-',
  },
  {
    key: 'contact_person',
    header: 'Contact Person',
    className: 'hidden md:table-cell',
    render: (row) => row.contact_person || '-',
  },
  {
    key: 'phone',
    header: 'Phone',
    className: 'hidden md:table-cell',
    render: (row) => row.phone || '-',
  },
  {
    key: 'created_at',
    header: 'Joined',
    render: (row) => new Date(row.created_at).toLocaleDateString(),
  },
];

const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Clients');
    return () => { setPageTitle(null); };
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter((client) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      client.email?.toLowerCase().includes(searchLower) ||
      client.company_name?.toLowerCase().includes(searchLower) ||
      client.contact_person?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <AdminLayout>
      <div data-full-bleed className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <div>
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <DataTable<Client>
                columns={clientColumns}
                data={filteredClients}
                rowId={(row) => row.id}
                emptyState="No clients found. Clients will appear here once they sign up."
                className="min-w-[600px]"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
