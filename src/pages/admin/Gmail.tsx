import EvanLayout from '@/components/evan/EvanLayout';
import { GmailCore } from '@/components/gmail/GmailCore';

const EvansGmail = () => {
  return (
    <EvanLayout>
      <GmailCore userId="evan" variant="crm" callbackPrefix="admin" returnPath="/team/evan/gmail" />
    </EvanLayout>
  );
};

export default EvansGmail;
