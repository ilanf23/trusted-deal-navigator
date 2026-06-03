import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { DropboxBrowser } from '@/components/admin/DropboxBrowser';
import { usePageDatabases } from '@/hooks/usePageDatabases';

const Dropbox = () => {
  usePageDatabases([
    { table: 'dropbox_connections', access: 'read', usage: 'Checks whether the current user has linked a personal Dropbox account.', via: 'dropbox-auth getStatus via useDropboxConnection' },
    { table: 'dropbox_files', access: 'readwrite', usage: 'Per-user file metadata cache used by DropboxBrowser to list/search/move/delete.', via: 'src/hooks/useDropbox.ts via DropboxBrowser' },
    { table: 'dropbox-files / dropbox-mutations / dropbox-search', access: 'rpc', usage: 'Edge functions proxy to Dropbox API and DB search (routed by src/lib/dropboxRouter.ts).', via: 'src/hooks/useDropbox.ts' },
    { table: 'dropbox-auth', access: 'rpc', usage: 'Edge function handling Dropbox OAuth connect flow.', via: 'src/hooks/useDropboxConnection.ts' },
  ]);

  return (
    <EmployeeLayout>
      <div className="h-[calc(100vh-4rem)] -mr-4 -mb-4 sm:-mr-6 sm:-mb-6 md:-mr-8 md:-mb-8">
        <DropboxBrowser />
      </div>
    </EmployeeLayout>
  );
};

export default Dropbox;
