import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { GmailCore } from '@/components/gmail/GmailCore';
import { useTeamMember } from '@/hooks/useTeamMember';
import { usePageDatabases } from '@/hooks/usePageDatabases';

const Gmail = () => {
  const { teamMember } = useTeamMember();
  usePageDatabases([
    { table: 'gmail-api', access: 'rpc', usage: 'Edge function proxy for Gmail API: list threads, send, archive, trash, mark read.', via: 'src/hooks/useGmail.ts via GmailCore' },
    { table: 'hidden_email_threads', access: 'readwrite', usage: 'User-hidden thread ids — toggled from the thread list.', via: 'src/hooks/useHiddenThreads.ts' },
    { table: 'outbound_emails', access: 'write', usage: 'Sent emails logged back into the DB for feed/attribution.', via: 'GmailCore send handler' },
    { table: 'gmail_connections', access: 'read', usage: 'Connected Gmail accounts for the current user.', via: 'src/hooks/useGmailConnection.ts' },
  ]);
  return (
    <EmployeeLayout>
      <GmailCore userId={teamMember?.name?.toLowerCase() || 'admin'} variant="crm" callbackPrefix="admin" returnPath="/admin/gmail" />
    </EmployeeLayout>
  );
};

export default Gmail;
