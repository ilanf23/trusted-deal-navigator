import { useEffect } from 'react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import CLXAssistant from '@/components/ai/CLXAssistant';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';

const AIAssistant = () => {
  const { setPageTitle } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('CLX Assistant');
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return (
    <EmployeeLayout>
      <div className="mx-auto h-[calc(100vh-9rem)] min-h-[520px] w-full max-w-7xl overflow-hidden rounded-2xl border bg-background shadow-sm md:rounded-3xl">
        <CLXAssistant />
      </div>
    </EmployeeLayout>
  );
};

export default AIAssistant;
