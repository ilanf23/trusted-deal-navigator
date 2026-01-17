import AdminLayout from '@/components/admin/AdminLayout';

const EvansPage = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Evan's Page</h1>
          <p className="text-muted-foreground">Evan's dedicated workspace</p>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to Evan's Page</h2>
          <p className="text-muted-foreground">
            This is Evan's dedicated workspace. Content can be customized here.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default EvansPage;
