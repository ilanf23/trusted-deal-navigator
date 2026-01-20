import AdminLayout from '@/components/admin/AdminLayout';
import { TaskWorkspace } from '@/components/evan/tasks/TaskWorkspace';

const EvansTasks = () => {
  return (
    <AdminLayout>
      <div className="space-y-2">
        {/* Clean Apple-style Header */}
        <div className="pb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage your work</p>
        </div>

        {/* Task Workspace */}
        <TaskWorkspace />
      </div>
    </AdminLayout>
  );
};

export default EvansTasks;
