import { useParams } from 'react-router-dom';
import EmployeeRoute from './EmployeeRoute';
import Dashboard from '@/pages/admin/Dashboard';

const DynamicEmployeeDashboard = () => {
  const { name } = useParams<{ name: string }>();
  return (
    <EmployeeRoute employeeName={name!}>
      <Dashboard />
    </EmployeeRoute>
  );
};

export default DynamicEmployeeDashboard;
