import EvanLayout from '@/components/evan/EvanLayout';
import { GmailCore } from '@/components/gmail/GmailCore';
import { useTeamMember } from '@/hooks/useTeamMember';

const Gmail = () => {
  const { teamMember } = useTeamMember();
  return (
    <EvanLayout>
      <GmailCore userId={teamMember?.name?.toLowerCase() || 'admin'} variant="crm" callbackPrefix="admin" returnPath="/admin/gmail" />
    </EvanLayout>
  );
};

export default Gmail;
