import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { DropboxBrowser } from '@/components/admin/DropboxBrowser';

const Dropbox = () => {
  return (
    <EmployeeLayout>
      <div className="h-[calc(100vh-4rem)] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 md:-mx-8 md:-mb-8">
        <DropboxBrowser />
      </div>
    </EmployeeLayout>
  );
};

export default Dropbox;
