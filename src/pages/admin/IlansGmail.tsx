import AdminLayout from '@/components/admin/AdminLayout';
import { GmailCore } from '@/components/gmail/GmailCore';

const IlansGmail = () => {
  return (
    <AdminLayout>
      <GmailCore userId="ilan" variant="basic" callbackPrefix="superadmin" />
    </AdminLayout>
  );
};

export default IlansGmail;
