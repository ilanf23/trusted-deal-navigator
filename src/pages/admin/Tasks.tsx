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
      <div data-full-bleed className="space-y-2">
        {/* Task Workspace */}
        <TaskWorkspace />
      </div>
    </EmployeeLayout>
  );
};

export default Tasks;
