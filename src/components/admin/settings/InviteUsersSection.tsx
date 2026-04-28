import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, MoreHorizontal, Shield, ShieldOff, KeyRound, Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSettings, useUpdateWorkspaceSettings } from '@/hooks/useWorkspaceSettings';

type FilterChip = 'all' | 'admins' | 'members' | 'pending';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  app_role: string | null;
  is_owner: boolean | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

const InviteDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');
  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { email, name, role },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users'] });
      toast.success('Invite sent');
      onOpenChange(false);
      setEmail('');
      setName('');
    },
    onError: () => toast.error('Failed to send invite — check the send-invite edge function is deployed.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="user@example.com" />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="readonly">Read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} disabled={!email || send.isPending}>
            {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InviteUsersSection = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceSettings();
  const updateWorkspace = useUpdateWorkspaceSettings();

  const { data, isLoading } = useQuery({
    queryKey: ['workspace-users'],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, app_role, is_owner, is_active, avatar_url, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q));
    }
    if (filter === 'admins') {
      rows = rows.filter((r) => r.is_owner || r.app_role === 'super_admin' || r.app_role === 'admin');
    } else if (filter === 'members') {
      rows = rows.filter((r) => !(r.is_owner || r.app_role === 'super_admin'));
    } else if (filter === 'pending') {
      rows = rows.filter((r) => !r.is_active);
    }
    return rows;
  }, [data, search, filter]);

  const updateRole = useMutation({
    mutationFn: async ({ id, role, isOwner }: { id: string; role?: string; isOwner?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (role !== undefined) updates.app_role = role;
      if (isOwner !== undefined) updates.is_owner = isOwner;
      const { error } = await supabase.from('users').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users'] });
      toast.success('Updated');
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('users').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users'] });
      toast.success('User removed');
    },
  });

  const filterChips: { value: FilterChip; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'admins', label: 'Admins' },
    { value: 'members', label: 'Members' },
    { value: 'pending', label: 'Pending invites' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invite users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage workspace members and access.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Invite User
        </Button>
      </div>

      {/* Search + chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
            placeholder="Search by name or email"
          />
        </div>
        <div className="flex gap-2">
          {filterChips.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === c.value
                  ? 'bg-[#3b2778] border-[#3b2778] text-white'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-md border border-[#c8bdd6] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#eee6f6] text-[#3b2778]">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Name</th>
              <th className="text-left px-4 py-2 font-semibold">Email</th>
              <th className="text-left px-4 py-2 font-semibold w-32">Role</th>
              <th className="text-left px-4 py-2 font-semibold w-28">Status</th>
              <th className="text-left px-4 py-2 font-semibold w-32">Joined</th>
              <th className="px-4 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No users match your filters.
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[#c8bdd6] hover:bg-[#eee6f6]/40">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(u.name || '??').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  {u.is_owner ? (
                    <Badge className="bg-[#3b2778] text-white">Owner</Badge>
                  ) : (
                    <Badge variant="outline">{u.app_role ?? 'member'}</Badge>
                  )}
                </td>
                <td className="px-4 py-2">
                  {u.is_active ? (
                    <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      Pending
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateRole.mutate({ id: u.id, isOwner: !u.is_owner })}>
                        {u.is_owner ? (
                          <>
                            <ShieldOff className="h-4 w-4 mr-2" /> Revoke owner
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 mr-2" /> Make owner
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateRole.mutate({ id: u.id, role: 'admin' })}>
                        <Shield className="h-4 w-4 mr-2" /> Set role: admin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          if (!u.email) return;
                          const { error } = await supabase.auth.resetPasswordForEmail(u.email);
                          if (error) toast.error(error.message);
                          else toast.success('Reset link sent');
                        }}
                      >
                        <KeyRound className="h-4 w-4 mr-2" /> Reset password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActive.mutate({ id: u.id, active: !u.is_active })}>
                        <Ban className="h-4 w-4 mr-2" /> {u.is_active ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${u.name}?`)) remove.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Workspace toggles */}
      <div className="rounded-md border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">Workspace defaults</h3>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Only owners and admins can invite users</Label>
          <Switch
            checked={!!workspace.invite_admins_only}
            onCheckedChange={(v) => updateWorkspace.mutate({ invite_admins_only: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">New users get Google Sync enabled by default</Label>
          <Switch
            checked={!!workspace.default_google_sync}
            onCheckedChange={(v) => updateWorkspace.mutate({ default_google_sync: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm flex-1">Default role for new invites</Label>
          <Select
            value={workspace.default_invite_role ?? 'admin'}
            onValueChange={(v) => updateWorkspace.mutate({ default_invite_role: v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="readonly">Read-only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
};

export default InviteUsersSection;
