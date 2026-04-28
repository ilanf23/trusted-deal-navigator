import { useEffect, useState } from 'react';
import { Gift, Copy, Mail } from 'lucide-react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { toast } from 'sonner';

const ReferAFriend = () => {
  const { teamMember } = useTeamMember();
  const { setPageTitle } = useAdminTopBar();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    "Hey — wanted to share the CRM I use to run my book. It's saved me hours every week. You can try it here:",
  );

  const refLink = `https://commerciallendingx.com/?ref=${teamMember?.id ?? 'you'}`;

  useEffect(() => {
    setPageTitle('Refer a friend');
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const copy = async () => {
    await navigator.clipboard.writeText(refLink);
    toast.success('Referral link copied');
  };

  return (
    <EmployeeLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Hero */}
        <div className="rounded-xl bg-gradient-to-br from-[#3b2778] to-[#5e3fa6] p-8 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
              <Gift className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Get $100 for every team you refer</h1>
          </div>
          <p className="text-sm text-white/80 max-w-xl">
            Share CommercialLendingX with another broker. When they sign up and stay active for 30 days, you'll earn
            $100 — and they'll get a discount on their first month.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sent', value: '0' },
            { label: 'Signed up', value: '0' },
            { label: 'Earned', value: '$0' },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Personal link */}
        <div className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold mb-2">Your referral link</h2>
          <div className="flex gap-2">
            <Input value={refLink} readOnly className="font-mono text-xs" />
            <Button variant="outline" onClick={copy}>
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
          </div>
        </div>

        {/* Email composer */}
        <div className="rounded-md border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold">Send an invite</h2>
          <Input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          <Button
            onClick={() => {
              const subject = encodeURIComponent("Try CommercialLendingX");
              const body = encodeURIComponent(`${message}\n\n${refLink}`);
              window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
            }}
            disabled={!email}
          >
            <Mail className="h-4 w-4 mr-2" /> Send invite
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens your default mail client — server-side delivery and tracking lands in v2.
          </p>
        </div>
      </div>
    </EmployeeLayout>
  );
};

export default ReferAFriend;
