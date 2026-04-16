import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { TaskWorkspace } from '@/components/employee/tasks/TaskWorkspace';

const Tasks = () => {
  const { setPageTitle } = useAdminTopBar();
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
