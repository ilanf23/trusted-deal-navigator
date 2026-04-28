import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, GripVertical, Plus, X, RotateCcw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  route: string;
  group?: string;
}

const DEFAULT_NAV: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard', route: '/admin/dashboard' },
    { label: 'Pipeline Feed', route: '/admin/pipeline/feed', group: 'CRM' },
    { label: 'Potential', route: '/admin/pipeline/potential', group: 'CRM' },
    { label: 'Underwriting', route: '/admin/pipeline/underwriting', group: 'CRM' },
    { label: 'Lender Management', route: '/admin/pipeline/lender-management', group: 'CRM' },
    { label: 'People', route: '/admin/contacts/people', group: 'CRM' },
    { label: 'Companies', route: '/admin/contacts/companies', group: 'CRM' },
    { label: 'Lender Programs', route: '/admin/lender-programs', group: 'CRM' },
    { label: "To Do's", route: '/admin/tasks', group: 'Workspace' },
    { label: 'Calendar', route: '/admin/calendar', group: 'Workspace' },
    { label: 'Calls', route: '/admin/calls', group: 'Workspace' },
    { label: 'Gmail', route: '/admin/gmail', group: 'Workspace' },
    { label: 'Dropbox', route: '/admin/dropbox', group: 'Workspace' },
    { label: 'Rate Watch', route: '/admin/rate-watch', group: 'Tools' },
    { label: 'Bug Reporting', route: '/admin/bug-reporting', group: 'Tools' },
  ],
  member: [
    { label: 'Dashboard', route: '/admin/dashboard' },
    { label: 'Potential', route: '/admin/pipeline/potential', group: 'CRM' },
    { label: 'People', route: '/admin/contacts/people', group: 'CRM' },
    { label: "To Do's", route: '/admin/tasks', group: 'Workspace' },
    { label: 'Calendar', route: '/admin/calendar', group: 'Workspace' },
  ],
  readonly: [
    { label: 'Dashboard', route: '/admin/dashboard' },
    { label: 'Pipeline', route: '/admin/pipeline/potential' },
    { label: 'People', route: '/admin/contacts/people' },
  ],
};

const ALL_AVAILABLE: NavItem[] = [
  ...DEFAULT_NAV.admin,
  { label: 'Marketing', route: '/admin/marketing', group: 'Tools' },
  { label: 'Newsletter', route: '/admin/newsletter', group: 'Tools' },
  { label: 'Score Sheet', route: '/admin/scorecard/score-sheet', group: 'Reports' },
  { label: 'Volume Log', route: '/superadmin/volume-log', group: 'Reports' },
  { label: 'Messages', route: '/admin/messages', group: 'Workspace' },
];

const NavEditor = ({ role }: { role: 'admin' | 'member' | 'readonly' }) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['nav-config', role],
    queryFn: async (): Promise<NavItem[]> => {
      const { data } = await supabase.from('nav_config').select('items').eq('role', role).maybeSingle();
      const items = data?.items as NavItem[] | undefined;
      return items ?? DEFAULT_NAV[role];
    },
  });

  const [items, setItems] = useState<NavItem[]>([]);
  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from('nav_config').select('id').eq('role', role).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('nav_config').update({ items }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nav_config').insert({ role, items });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nav-config'] });
      toast.success('Navigation saved');
    },
  });

  const removeItem = (route: string) => setItems((prev) => prev.filter((i) => i.route !== route));
  const addItem = (item: NavItem) => {
    if (items.find((i) => i.route === item.route)) return;
    setItems([...items, item]);
  };
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };
  const moveDown = (idx: number) => {
    if (idx >= items.length - 1) return;
    const next = [...items];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setItems(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const available = ALL_AVAILABLE.filter((a) => !items.find((i) => i.route === a.route));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active nav */}
      <div className="rounded-md border border-border">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
          <div>
            <h3 className="text-sm font-semibold">Active sidebar — {role}</h3>
            <p className="text-xs text-muted-foreground">{items.length} item(s)</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setItems(DEFAULT_NAV[role])}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
        </div>
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={item.route} className="px-3 py-2 flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
              <div className="flex-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{item.route}</div>
              </div>
              {item.group && (
                <Badge variant="outline" className="text-[10px]">
                  {item.group}
                </Badge>
              )}
              <button onClick={() => moveUp(idx)} className="p-1 rounded hover:bg-muted" aria-label="Up">
                ▲
              </button>
              <button onClick={() => moveDown(idx)} className="p-1 rounded hover:bg-muted" aria-label="Down">
                ▼
              </button>
              <button
                onClick={() => removeItem(item.route)}
                className="p-1 rounded hover:bg-muted text-destructive"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div className="rounded-md border border-border">
        <div className="px-4 py-2.5 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold">Available items</h3>
          <p className="text-xs text-muted-foreground">Click to add to sidebar.</p>
        </div>
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {available.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">All items are active.</p>
          )}
          {available.map((item) => (
            <button
              key={item.route}
              onClick={() => addItem(item)}
              className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-muted/50"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{item.route}</div>
              </div>
              {item.group && (
                <Badge variant="outline" className="text-[10px]">
                  {item.group}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 sticky bottom-0 bg-background pt-4 -mx-8 px-8 pb-2 border-t border-border">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save navigation for {role}
        </Button>
      </div>
    </div>
  );
};

const EditNavigationSection = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit navigation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize what appears in the main left sidebar per role. Saved configs read by <code>AdminSidebar</code> at mount;
          falls back to the default when no row exists.
        </p>
      </div>

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">Admin / Owner</TabsTrigger>
          <TabsTrigger value="member">Member</TabsTrigger>
          <TabsTrigger value="readonly">Read-only</TabsTrigger>
        </TabsList>
        <TabsContent value="admin" className="mt-6">
          <NavEditor role="admin" />
        </TabsContent>
        <TabsContent value="member" className="mt-6">
          <NavEditor role="member" />
        </TabsContent>
        <TabsContent value="readonly" className="mt-6">
          <NavEditor role="readonly" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditNavigationSection;
