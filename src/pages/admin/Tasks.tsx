import EvanLayout from '@/components/evan/EvanLayout';
import { TaskWorkspace } from '@/components/evan/tasks/TaskWorkspace';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

const Tasks = () => {
  return (
    <EvanLayout>
      <div className="space-y-2">
        {/* Clean Apple-style Header */}
        <div className="pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
            <DbTableBadge tables={['tasks']} />
          </div>
          <p className="text-muted-foreground mt-1">Manage your work</p>
        </div>

        {/* Task Workspace */}
        <TaskWorkspace />
      </div>
    </EvanLayout>
  );
};

export default Tasks;
