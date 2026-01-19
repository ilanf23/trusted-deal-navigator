import AdminLayout from '@/components/admin/AdminLayout';
import { TaskBoard } from '@/components/evan/dashboard/TaskBoard';
import { ListTodo } from 'lucide-react';

const EvansTasks = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border bg-card">
            <ListTodo className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage your to-dos</p>
          </div>
        </div>

        {/* Task Board */}
        <TaskBoard />
      </div>
    </AdminLayout>
  );
};

export default EvansTasks;
