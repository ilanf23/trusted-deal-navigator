import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { DropboxBrowser } from '@/components/admin/DropboxBrowser';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

const Dropbox = () => {
  const { user } = useAuth();
  usePageDatabases([
    { table: 'dropbox_connections', access: 'read', usage: 'Checks whether the current user has linked a personal Dropbox account.', via: 'useQuery in Dropbox.tsx' },
    { table: 'dropbox_files', access: 'readwrite', usage: 'File metadata cache — used by DropboxBrowser to list/search/move/delete.', via: 'src/hooks/useDropbox.ts via DropboxBrowser' },
    { table: 'dropbox-api', access: 'rpc', usage: 'Edge function proxy to Dropbox API: list, upload, delete, move, search, sync.', via: 'src/hooks/useDropbox.ts' },
    { table: 'dropbox-auth', access: 'rpc', usage: 'Edge function handling Dropbox OAuth connect flow.', via: 'src/hooks/useDropboxConnection.ts' },
  ]);

  // Check if this user has their own Dropbox connection (no fallback)
  const { data: hasDropboxSetup, isLoading: checkingSetup } = useQuery({
    queryKey: ['dropbox-setup-check', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dropbox_connections')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  if (checkingSetup) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </EmployeeLayout>
    );
  }

  if (!hasDropboxSetup) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <CardTitle className="text-lg">Manual Setup Required</CardTitle>
              <CardDescription>
                Dropbox requires individual OAuth configuration for your account. Please contact the dev builder to connect your Dropbox.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="h-[calc(100vh-4rem)] -mr-4 -mb-4 sm:-mr-6 sm:-mb-6 md:-mr-8 md:-mb-8">
        <DropboxBrowser />
      </div>
    </EmployeeLayout>
  );
};

export default Dropbox;
