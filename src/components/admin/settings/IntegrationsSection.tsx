import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Mail,
  Calendar,
  HardDrive,
  Phone,
  Slack,
  Zap,
  FileSignature,
  Calculator,
  Webhook,
  ChevronRight,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface UserIntegrationMetadata {
  id: string;
  provider: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'custom', label: 'Custom provider' },
] as const;

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

const useApiKeys = () =>
  useQuery({
    queryKey: ['user-integrations'],
    queryFn: async (): Promise<UserIntegrationMetadata[]> => {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('id, provider, label, created_at, last_used_at, revoked_at')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

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
  const { user } = useAuth();
  const {
    data: apiKeys,
    isLoading: isApiKeysLoading,
    refetch: refetchApiKeys,
  } = useApiKeys();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('openai');
  const [customProvider, setCustomProvider] = useState('');
  const [label, setLabel] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const canSubmit =
    !!user &&
    !!label.trim() &&
    !!plaintext.trim() &&
    (selectedProvider !== 'custom' || !!customProvider.trim());

  const clearDialog = () => {
    setSelectedProvider('openai');
    setCustomProvider('');
    setLabel('');
    setPlaintext('');
  };

  const handleAddApiKey = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const provider =
        selectedProvider === 'custom' ? customProvider.trim().toLowerCase() : selectedProvider;

      const { error } = await supabase.functions.invoke('add-user-integration', {
        body: {
          provider,
          label: label.trim(),
          plaintext: plaintext.trim(),
        },
      });

      if (error) {
        toast.error(error.message || 'Failed to save API key');
        return;
      }

      toast.success('API key saved');
      setIsDialogOpen(false);
      clearDialog();
      await refetchApiKeys();
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeApiKey = async (integrationId: string) => {
    const confirmed = window.confirm(
      'Revoke this API key? This cannot be undone. You can paste a new key afterward.',
    );
    if (!confirmed) return;

    setRevokingId(integrationId);
    try {
      const { error } = await supabase.functions.invoke('revoke-user-integration', {
        body: { integration_id: integrationId },
      });
      if (error) {
        toast.error(error.message || 'Failed to revoke API key');
        return;
      }

      toast.success('API key revoked');
      await refetchApiKeys();
    } catch {
      toast.error('Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

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

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Keys
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paste once and store securely. Keys are never shown again in the UI.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white">
                <Plus className="h-4 w-4 mr-1.5" />
                Add API key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add API key</DialogTitle>
                <DialogDescription>
                  This key is encrypted at rest and only used server-side for outbound API calls.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-provider">Custom provider slug</Label>
                    <Input
                      id="custom-provider"
                      placeholder="e.g. anthropic"
                      value={customProvider}
                      onChange={(event) => setCustomProvider(event.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="integration-label">Label</Label>
                  <Input
                    id="integration-label"
                    placeholder="e.g. Production key"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="integration-secret">API key / token</Label>
                  <Textarea
                    id="integration-secret"
                    className="min-h-[120px]"
                    placeholder="Paste key here"
                    value={plaintext}
                    onChange={(event) => setPlaintext(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddApiKey}
                  disabled={!canSubmit || isSubmitting}
                  className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white"
                >
                  {isSubmitting ? 'Saving...' : 'Save key'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isApiKeysLoading ? (
          <p className="text-sm text-muted-foreground">Loading API keys...</p>
        ) : !apiKeys?.length ? (
          <p className="text-sm text-muted-foreground">
            No API keys saved yet. Add one to enable per-user third-party API access.
          </p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((integration) => (
              <div
                key={integration.id}
                className="border border-border rounded-md px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {integration.provider} · {integration.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Added{' '}
                    {formatDistanceToNow(new Date(integration.created_at), { addSuffix: true })}
                    {integration.last_used_at
                      ? ` · Last used ${formatDistanceToNow(new Date(integration.last_used_at), { addSuffix: true })}`
                      : ' · Never used'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRevokeApiKey(integration.id)}
                  disabled={revokingId === integration.id}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {revokingId === integration.id ? 'Revoking...' : 'Revoke'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsSection;
