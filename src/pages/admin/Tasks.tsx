import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { TaskWorkspace } from '@/components/employee/tasks/TaskWorkspace';

const Tasks = () => {
  const { setPageTitle } = useAdminTopBar();
  usePageDatabases([
    { table: 'tasks', access: 'readwrite', usage: 'Task records — create, complete, edit, delete via TaskWorkspace.', via: 'src/hooks/useTasksData.ts' },
    { table: 'task_activities', access: 'write', usage: 'Activity-log entries written on every task change.', via: 'src/hooks/useTasksData.ts' },
    { table: 'potential', access: 'read', usage: 'Lead context shown alongside each task.', via: 'src/hooks/useTasksData.ts' },
  ]);
  useEffect(() => {
    setPageTitle('Tasks');
    return () => { setPageTitle(null); };
  }, []);

  return (
    <EmployeeLayout>
      <div data-full-bleed className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] overflow-y-auto space-y-2 px-4 md:px-6 lg:px-8 pb-8">
        {/* Task Workspace */}
        <TaskWorkspace />
      </div>
    </EmployeeLayout>
  );
};

export default Tasks;
