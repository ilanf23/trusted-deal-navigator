import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EvanLayout from '@/components/evan/EvanLayout';
import { TaskWorkspace } from '@/components/evan/tasks/TaskWorkspace';

const Tasks = () => {
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Tasks');
    return () => { setPageTitle(null); };
  }, []);

  return (
    <EvanLayout>
      <div className="space-y-2">
        {/* Task Workspace */}
        <TaskWorkspace />
      </div>
    </EvanLayout>
  );
};

export default Tasks;
