import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, Users, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type AppRole = 'admin' | 'client' | 'partner';

interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
}

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  partner: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  client: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const UsersAndRoles = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    targetUserId: string;
    targetEmail: string;
    newRole: AppRole;
  }>({ open: false, targetUserId: '', targetEmail: '', newRole: 'client' });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-and-roles'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email')
        .order('email');

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Merge
      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role as AppRole));

      return (profiles || []).map((p) => ({
        user_id: p.user_id,
        email: p.email || 'No email',
        role: roleMap.get(p.user_id) || ('client' as AppRole),
      })) as UserWithRole[];
    },
  });

  const handleRoleChange = (targetUserId: string, targetEmail: string, newRole: AppRole) => {
    setConfirmDialog({ open: true, targetUserId, targetEmail, newRole });
    setPassword('');
  };

  const confirmRoleChange = async () => {
    if (!password || !user?.email) return;
    setLoading(true);

    try {
      // Re-authenticate with password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        toast({ title: 'Authentication failed', description: 'Incorrect password.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('manage-user-role', {
        body: {
          target_user_id: confirmDialog.targetUserId,
          new_role: confirmDialog.newRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Role updated', description: `${confirmDialog.targetEmail} is now ${confirmDialog.newRole}.` });
      queryClient.invalidateQueries({ queryKey: ['users-and-roles'] });
      setConfirmDialog({ open: false, targetUserId: '', targetEmail: '', newRole: 'client' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update role.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage user permissions and access levels</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROLE_COLORS[u.role]}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(['admin', 'partner', 'client'] as AppRole[]).map((role) => (
                        <Button
                          key={role}
                          size="sm"
                          variant={u.role === role ? 'default' : 'outline'}
                          disabled={u.role === role || u.user_id === user?.id}
                          onClick={() => handleRoleChange(u.user_id, u.email, role)}
                          className="text-xs capitalize"
                        >
                          {role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                          {role === 'partner' && <Users className="w-3 h-3 mr-1" />}
                          {role === 'client' && <UserCog className="w-3 h-3 mr-1" />}
                          {role}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => !loading && setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Change <strong>{confirmDialog.targetEmail}</strong> to <strong className="capitalize">{confirmDialog.newRole}</strong>. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmRoleChange()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={confirmRoleChange} disabled={!password || loading}>
              {loading ? 'Verifying...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersAndRoles;
