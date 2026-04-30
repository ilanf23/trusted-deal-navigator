import { useState, useMemo, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Shield,
  ShieldCheck,
  Users,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  UserPlus,
  CheckCircle2,
  XCircle,
  Mail,
  ArrowUpDown,
  Trash2,
  Pencil,
  UserMinus,
} from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

type AppRole = 'admin' | 'super_admin' | 'partner';

interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
  status: 'active' | 'inactive';
}

type SortField = 'email' | 'role' | 'created_at';
type SortDirection = 'asc' | 'desc';

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string; bgColor: string }> = {
  super_admin: {
    label: 'Super Admin',
    icon: ShieldCheck,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
  },
  partner: {
    label: 'Partner',
    icon: Users,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300',
  },
};

const ITEMS_PER_PAGE = 10;

const UsersAndRoles = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Users & Roles');
    return () => { setPageTitle(null); };
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | AppRole>('all');
  const [sortField, setSortField] = useState<SortField>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    targetUserId: string;
    targetEmail: string;
    newRole: AppRole;
  }>({ open: false, targetUserId: '', targetEmail: '', newRole: 'admin' });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-and-roles'],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('users')
        .select('user_id, email, app_role, created_at, is_active')
        .not('user_id', 'is', null)
        .order('email');

      if (error) throw error;

      return (members || []).map((m) => ({
        user_id: m.user_id!,
        email: m.email || 'No email',
        role: (m.app_role as AppRole) || 'admin',
        created_at: m.created_at,
        status: m.is_active ? ('active' as const) : ('inactive' as const),
      })) as UserWithRole[];
    },
  });

  const currentUserIsSuperAdmin = useMemo(
    () => users?.some((u) => u.user_id === user?.id && u.role === 'super_admin') ?? false,
    [users, user?.id],
  );

  // Derived data
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];

    let filtered = users;

    // Tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter((u) => u.role === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) => u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'email') cmp = a.email.localeCompare(b.email);
      else if (sortField === 'role') cmp = a.role.localeCompare(b.role);
      else if (sortField === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [users, activeTab, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats
  const stats = useMemo(() => {
    if (!users) return { total: 0, superAdmins: 0, admins: 0, partners: 0 };
    return {
      total: users.length,
      superAdmins: users.filter((u) => u.role === 'super_admin').length,
      admins: users.filter((u) => u.role === 'admin').length,
      partners: users.filter((u) => u.role === 'partner').length,
    };
  }, [users]);

  // Handlers
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map((u) => u.user_id)));
    }
  };

  const handleRoleChange = (targetUserId: string, targetEmail: string, newRole: AppRole) => {
    setConfirmDialog({ open: true, targetUserId, targetEmail, newRole });
    setPassword('');
  };

  const confirmRoleChange = async () => {
    if (!password || !user?.email) return;
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        toast({ title: 'Authentication failed', description: 'Incorrect password.', variant: 'destructive' });
        setLoading(false);
        return;
      }

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
      setConfirmDialog({ open: false, targetUserId: '', targetEmail: '', newRole: 'admin' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update role.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-1" />
    );
  };

  return (
    <div data-full-bleed className="p-4 md:p-6 space-y-5">
      {/* Actions */}
      <div className="flex justify-end">
        <Button size="sm" className="w-fit">
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-foreground' },
          { label: 'Super Admins', value: stats.superAdmins, icon: ShieldCheck, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Partners', value: stats.partners, icon: Users, color: 'text-purple-600 dark:text-purple-400' },
        ].map((stat) => (
          <Card key={stat.label} className="border border-border">
            <CardContent className="p-3 md:p-4 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-bold text-foreground leading-none">{isLoading ? '—' : stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as typeof activeTab);
            setCurrentPage(1);
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
            <TabsTrigger value="all" className="text-xs">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="super_admin" className="text-xs">Super ({stats.superAdmins})</TabsTrigger>
            <TabsTrigger value="admin" className="text-xs">Admins ({stats.admins})</TabsTrigger>
            <TabsTrigger value="partner" className="text-xs">Partners ({stats.partners})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 sm:max-w-xs ml-auto">
          <Input
            placeholder="Search by email or role…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
          <span className="text-sm font-medium text-foreground">{selectedUsers.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {(['super_admin', 'admin', 'partner'] as AppRole[]).map((role) => {
              const cfg = ROLE_CONFIG[role];
              const blockedBySuperAdminRule = role === 'super_admin' && !currentUserIsSuperAdmin;
              return (
                <Button
                  key={role}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={blockedBySuperAdminRule}
                  onClick={() => {
                    toast({
                      title: 'Bulk role change',
                      description: `Select users individually to change roles (security requirement).`,
                    });
                  }}
                >
                  <cfg.icon className="w-3 h-3 mr-1" />
                  Set {cfg.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground">No users found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? 'Try adjusting your search or filters' : 'No users have been created yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('email')}
                        className="flex items-center font-medium text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        User <SortIcon field="email" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('role')}
                        className="flex items-center font-medium text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        Role <SortIcon field="role" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('created_at')}
                        className="flex items-center font-medium text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        Joined <SortIcon field="created_at" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => {
                    const roleCfg = ROLE_CONFIG[u.role];
                    const RoleIcon = roleCfg.icon;
                    return (
                      <TableRow key={u.user_id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(u.user_id)}
                            onCheckedChange={() => toggleSelectUser(u.user_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                                {getInitials(u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium text-foreground truncate">{u.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${roleCfg.bgColor} gap-1`}>
                            <RoleIcon className="w-3 h-3" />
                            {roleCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Quick role buttons */}
                            <div className="hidden group-hover:flex items-center gap-1 mr-1">
                              {(['super_admin', 'admin', 'partner'] as AppRole[]).map((role) => {
                                const cfg = ROLE_CONFIG[role];
                                const Icon = cfg.icon;
                                const isCurrent = u.role === role;
                                const isSuperAdminOp = role === 'super_admin' || u.role === 'super_admin';
                                const blockedBySuperAdminRule = isSuperAdminOp && !currentUserIsSuperAdmin;
                                return (
                                  <Button
                                    key={role}
                                    size="sm"
                                    variant={isCurrent ? 'default' : 'ghost'}
                                    className={`h-7 px-2 text-xs ${isCurrent ? '' : 'opacity-60 hover:opacity-100'}`}
                                    disabled={isCurrent || u.user_id === user?.id || blockedBySuperAdminRule}
                                    onClick={() => handleRoleChange(u.user_id, u.email, role)}
                                  >
                                    <Icon className="w-3 h-3 mr-0.5" />
                                    {cfg.label}
                                  </Button>
                                );
                              })}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem>
                                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {(['super_admin', 'admin', 'partner'] as AppRole[]).map((role) => {
                                  const cfg = ROLE_CONFIG[role];
                                  const Icon = cfg.icon;
                                  const isSuperAdminOp = role === 'super_admin' || u.role === 'super_admin';
                                  const blockedBySuperAdminRule = isSuperAdminOp && !currentUserIsSuperAdmin;
                                  return (
                                    <DropdownMenuItem
                                      key={role}
                                      disabled={u.role === role || u.user_id === user?.id || blockedBySuperAdminRule}
                                      onClick={() => handleRoleChange(u.user_id, u.email, role)}
                                    >
                                      <Icon className={`w-3.5 h-3.5 mr-2 ${cfg.color}`} />
                                      Set as {cfg.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <UserMinus className="w-3.5 h-3.5 mr-2" /> Deactivate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {paginatedUsers.map((u) => {
                const roleCfg = ROLE_CONFIG[u.role];
                const RoleIcon = roleCfg.icon;
                return (
                  <div key={u.user_id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                            {getInitials(u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`${roleCfg.bgColor} gap-1 text-[10px] px-1.5 py-0`}>
                              <RoleIcon className="w-2.5 h-2.5" />
                              {roleCfg.label}
                            </Badge>
                            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Active
                            </span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(['super_admin', 'admin', 'partner'] as AppRole[]).map((role) => {
                            const cfg = ROLE_CONFIG[role];
                            const Icon = cfg.icon;
                            const isSuperAdminOp = role === 'super_admin' || u.role === 'super_admin';
                            const blockedBySuperAdminRule = isSuperAdminOp && !currentUserIsSuperAdmin;
                            return (
                              <DropdownMenuItem
                                key={role}
                                disabled={u.role === role || u.user_id === user?.id || blockedBySuperAdminRule}
                                onClick={() => handleRoleChange(u.user_id, u.email, role)}
                              >
                                <Icon className={`w-3.5 h-3.5 mr-2 ${cfg.color}`} />
                                Set as {cfg.label}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedUsers.length)} of{' '}
                  {filteredAndSortedUsers.length}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Role Change Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => !loading && setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Change <strong>{confirmDialog.targetEmail}</strong> to{' '}
              <strong className="capitalize">{confirmDialog.newRole}</strong>. Enter your password to confirm.
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
            <Button
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
              disabled={loading}
            >
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
