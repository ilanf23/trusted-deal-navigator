import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { GmailCore } from '@/components/gmail/GmailCore';
import { useTeamMember } from '@/hooks/useTeamMember';

const Gmail = () => {
  const { teamMember } = useTeamMember();
  return (
    <EmployeeLayout>
      <GmailCore userId={teamMember?.name?.toLowerCase() || 'admin'} variant="crm" callbackPrefix="admin" returnPath="/admin/gmail" />
    </EmployeeLayout>
  );
};

export default Gmail;
