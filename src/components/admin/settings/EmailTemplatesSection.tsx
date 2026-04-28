import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Copy, Trash2, Mail } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { getSignatureHtml } from '@/lib/email-signature';

interface EmailTemplate {
  id: string;
  user_id: string | null;
  name: string;
  subject: string;
  body: string;
  is_shared: boolean;
  created_at: string | null;
  updated_at: string | null;
}

const VARIABLES = ['{{first_name}}', '{{last_name}}', '{{company}}', '{{deal_value}}', '{{my_name}}'];

const useTemplates = (filter: 'mine' | 'shared') => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['email-templates', filter, user?.id],
    queryFn: async (): Promise<EmailTemplate[]> => {
      const query = supabase.from('email_templates').select('*').order('updated_at', { ascending: false });
      const { data, error } =
        filter === 'mine'
          ? await query.eq('user_id', user?.id ?? '').eq('is_shared', false)
          : await query.eq('is_shared', true);
      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
    enabled: !!user,
  });
};

const TemplateEditorDialog = ({
  open,
  onOpenChange,
  template,
  isShared,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: EmailTemplate | null;
  isShared: boolean;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');

  useEffect(() => {
    setName(template?.name ?? '');
    setSubject(template?.subject ?? '');
    setBody(template?.body ?? '');
  }, [template]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .update({ name, subject, body })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert({
          user_id: user.id,
          name,
          subject,
          body,
          is_shared: isShared,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success(template ? 'Template updated' : 'Template created');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const insertVariable = (v: string) => {
    setBody((prev) => prev + ` ${v}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold outreach intro" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          </div>
          <div>
            <Label>Body</Label>
            <RichTextEditor value={body} onChange={setBody} minHeight="220px" maxHeight="400px" />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Variables:</span>
            {VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="text-[11px] px-2 py-0.5 rounded border border-border bg-muted hover:bg-muted/70"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!name || !subject || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TemplateTable = ({ filter, canEdit }: { filter: 'mine' | 'shared'; canEdit: boolean }) => {
  const { data, isLoading } = useTemplates(filter);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const isShared = filter === 'shared';

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
  });

  const duplicate = useMutation({
    mutationFn: async (t: EmailTemplate) => {
      const { error } = await supabase.from('email_templates').insert({
        user_id: t.user_id,
        name: `${t.name} (copy)`,
        subject: t.subject,
        body: t.body,
        is_shared: t.is_shared,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-templates'] }),
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" /> New template
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#eee6f6] text-[#3b2778]">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Name</th>
              <th className="text-left px-4 py-2 font-semibold">Subject</th>
              <th className="text-left px-4 py-2 font-semibold w-32">Last updated</th>
              {canEdit && <th className="px-4 py-2 w-24" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                  No templates yet.
                </td>
              </tr>
            )}
            {data?.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-muted-foreground truncate max-w-md">{t.subject}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}
                </td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1 rounded hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => duplicate.mutate(t)}
                        className="p-1 rounded hover:bg-muted"
                        aria-label="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`)) remove.mutate(t.id);
                        }}
                        className="p-1 rounded hover:bg-muted text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TemplateEditorDialog
        open={creating || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        template={editing}
        isShared={isShared}
      />
    </div>
  );
};

const SignatureTab = () => {
  const { user } = useAuth();
  const { teamMember } = useTeamMember();
  const { settings, update } = useUserPreferences();
  const [body, setBody] = useState('');
  const [useGmail, setUseGmail] = useState(false);

  const defaultSig = useMemo(
    () => getSignatureHtml(teamMember?.name ?? 'You', user?.email ?? '', teamMember?.position ?? 'Team'),
    [teamMember, user],
  );

  useEffect(() => {
    setBody(settings?.email_signature ?? defaultSig);
  }, [settings?.email_signature, defaultSig]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium">Use Gmail signature instead</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When on, your signature is pulled from Gmail at send time.
          </p>
        </div>
        <Switch checked={useGmail} onCheckedChange={setUseGmail} />
      </div>

      <div>
        <Label>Email signature</Label>
        <RichTextEditor value={body} onChange={setBody} minHeight="180px" maxHeight="320px" />
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground tracking-wider">Live preview</Label>
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">— sample email body —</p>
          <Separator className="my-3" />
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>

      <Button
        onClick={async () => {
          try {
            await update.mutateAsync({ email_signature: body });
            toast.success('Signature saved');
          } catch {
            toast.error('Failed to save');
          }
        }}
        disabled={update.isPending}
      >
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save signature
      </Button>
    </div>
  );
};

const SendSettingsTab = () => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Default "From" name override</Label>
        <Input placeholder="Optional — leave blank to use your account name" className="mt-2" />
      </div>
      <div>
        <Label>Default reply-to address</Label>
        <Input placeholder="reply-to@example.com" className="mt-2" />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium">BCC self on every send</p>
          <p className="text-xs text-muted-foreground mt-0.5">A copy lands in your inbox for tracking.</p>
        </div>
        <Switch />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium">Track opens</p>
          <p className="text-xs text-muted-foreground mt-0.5">Requires Gmail integration.</p>
        </div>
        <Switch />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium">Track clicks</p>
          <p className="text-xs text-muted-foreground mt-0.5">Replaces links with redirected URLs.</p>
        </div>
        <Switch />
      </div>
      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
        Send settings persistence coming soon
      </Badge>
    </div>
  );
};

const EmailTemplatesSection = () => {
  const { teamMember, isOwner } = useTeamMember();
  const { userRole } = useAuth();
  const isAdmin = isOwner || userRole === 'super_admin' || userRole === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email Settings & Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your signature, personal templates, and send defaults.
        </p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Templates</TabsTrigger>
          {isAdmin && <TabsTrigger value="shared">Shared Templates</TabsTrigger>}
          <TabsTrigger value="signature">Email Signature</TabsTrigger>
          <TabsTrigger value="send">Send Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-6">
          <TemplateTable filter="mine" canEdit />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="shared" className="mt-6">
            <TemplateTable filter="shared" canEdit={isAdmin} />
          </TabsContent>
        )}
        <TabsContent value="signature" className="mt-6">
          <SignatureTab />
        </TabsContent>
        <TabsContent value="send" className="mt-6">
          <SendSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailTemplatesSection;
