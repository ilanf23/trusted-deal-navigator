import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, Calendar, HardDrive, Phone, Slack, Zap, FileSignature, Calculator, Webhook, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { LucideIcon } from 'lucide-react';

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  status: 'connected' | 'available' | 'coming-soon' | 'managed';
  connectAction?: () => void;
}

const useConnectionStatuses = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['integration-status', user?.id],
    queryFn: async () => {
      if (!user) return { gmail: false, dropbox: false };
      const [gm, dx] = await Promise.all([
        supabase.from('gmail_connections').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('dropbox_connections').select('id').eq('user_id', user.id).maybeSingle(),
      ]);
      return {
        gmail: !!gm.data,
        dropbox: !!dx.data,
      };
    },
    enabled: !!user,
  });
};

const Card = ({ card }: { card: IntegrationCard }) => {
  const { icon: Icon, status } = card;

  const statusBadge = {
    connected: <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>,
    available: <Badge variant="outline">Available</Badge>,
    'coming-soon': <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Coming soon</Badge>,
    managed: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Managed</Badge>,
  }[status];

  return (
    <div className="rounded-lg border border-border p-5 bg-card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center"
          style={{ backgroundColor: card.color + '20', color: card.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {statusBadge}
      </div>
      <div>
        <h3 className="text-sm font-semibold">{card.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.description}</p>
      </div>
      <div className="mt-auto flex gap-2">
        {status === 'connected' ? (
          <>
            <Button size="sm" variant="outline" className="flex-1">
              Configure
            </Button>
            <Button size="sm" variant="ghost" onClick={card.connectAction}>
              Disconnect
            </Button>
          </>
        ) : status === 'available' ? (
          <Button size="sm" className="flex-1" onClick={card.connectAction}>
            Connect <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : status === 'managed' ? (
          <Button size="sm" variant="outline" className="flex-1" disabled>
            Managed by admin
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="flex-1" disabled>
            Coming soon
          </Button>
        )}
      </div>
    </div>
  );
};

const IntegrationsSection = () => {
  const navigate = useNavigate();
  const { data: status } = useConnectionStatuses();

  const cards: IntegrationCard[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Two-way email sync, contact tracking, and template insertion in compose.',
      icon: Mail,
      color: '#ea4335',
      status: status?.gmail ? 'connected' : 'available',
      connectAction: () => navigate('/admin/gmail'),
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Sync meetings, busy/free, and join links.',
      icon: Calendar,
      color: '#4285f4',
      status: 'available',
      connectAction: () => navigate('/admin/calendar'),
    },
    {
      id: 'drive',
      name: 'Google Drive',
      description: 'Attach files from Drive and auto-store deal documents.',
      icon: HardDrive,
      color: '#0f9d58',
      status: status?.dropbox ? 'connected' : 'available',
      connectAction: () => navigate('/admin/dropbox'),
    },
    {
      id: 'twilio',
      name: 'Twilio Voice',
      description: 'Inbound and outbound calling with browser SDK.',
      icon: Phone,
      color: '#f22f46',
      status: 'managed',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Notifications and command palette in your Slack workspace.',
      icon: Slack,
      color: '#4a154b',
      status: 'coming-soon',
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Push contacts to audiences, sync campaign engagement.',
      icon: Mail,
      color: '#ffe01b',
      status: 'coming-soon',
    },
    {
      id: 'docusign',
      name: 'DocuSign',
      description: 'Send agreements and track signatures from a deal record.',
      icon: FileSignature,
      color: '#000000',
      status: 'coming-soon',
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync invoices and payment status to your books.',
      icon: Calculator,
      color: '#2ca01c',
      status: 'coming-soon',
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Trigger any of 5,000+ apps from CRM events.',
      icon: Zap,
      color: '#ff4f00',
      status: 'coming-soon',
    },
    {
      id: 'webhook',
      name: 'Custom Webhook',
      description: 'Generate a URL + secret to receive realtime events.',
      icon: Webhook,
      color: '#3b2778',
      status: 'coming-soon',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services. Real status shown for Gmail, Calendar, and Drive — others are placeholders pending wiring.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
};

export default IntegrationsSection;
