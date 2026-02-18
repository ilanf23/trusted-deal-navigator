import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Module } from './ModuleCard';

const PORTALS = ['evan', 'brad', 'adam', 'maura', 'wendy', 'shared', 'partner', 'client'];

const PORTAL_STYLES: Record<string, string> = {
  evan:    'bg-indigo-50 text-indigo-600',
  brad:    'bg-blue-50 text-blue-600',
  adam:    'bg-violet-50 text-violet-600',
  maura:   'bg-pink-50 text-pink-600',
  wendy:   'bg-rose-50 text-rose-600',
  shared:  'bg-gray-100 text-gray-600',
  partner: 'bg-emerald-50 text-emerald-600',
  client:  'bg-amber-50 text-amber-600',
};

export interface BusinessRequirement {
  id: string;
  module_id?: string;
  requirement_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  status: string;
  assigned_to?: string;
  priority: string;
  portal?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft:       'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  implemented: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  verified:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const brSchema = z.object({
  module_id: z.string().optional(),
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  status: z.string(),
  assigned_to: z.string().optional(),
  priority: z.string(),
  portal: z.string().default('evan'),
});
type BRFormValues = z.infer<typeof brSchema>;

interface RequirementsTableProps {
  requirements: BusinessRequirement[];
  modules: Module[];
  onRefresh: () => void;
}

export default function RequirementsTable({ requirements, modules, onRefresh }: RequirementsTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [portalFilter, setPortalFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<BRFormValues>({
    resolver: zodResolver(brSchema),
    defaultValues: { title: '', description: '', acceptance_criteria: '', status: 'draft', priority: 'medium', assigned_to: '', portal: 'evan' },
  });

  const filtered = requirements.filter(r => {
    const matchSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.requirement_id.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchPortal = portalFilter === 'all' || (r.portal ?? 'evan') === portalFilter;
    return matchSearch && matchStatus && matchPortal;
  });

  const getNextReqId = () => {
    const nums = requirements.map(r => parseInt(r.requirement_id.replace('BR-', ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `BR-${String(next).padStart(3, '0')}`;
  };

  const handleAdd = async (values: BRFormValues) => {
    setSaving(true);
    const insertData = {
      title: values.title,
      description: values.description ?? null,
      acceptance_criteria: values.acceptance_criteria ?? null,
      status: values.status,
      priority: values.priority,
      assigned_to: values.assigned_to ?? null,
      requirement_id: getNextReqId(),
      module_id: values.module_id || null,
      portal: values.portal ?? 'evan',
    };
    const { error } = await supabase.from('business_requirements').insert(insertData as any);
    setSaving(false);
    if (error) { toast({ title: 'Error adding requirement', variant: 'destructive' }); return; }
    toast({ title: 'Requirement added' });
    form.reset();
    setAddOpen(false);
    onRefresh();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('business_requirements').update({ status }).eq('id', id);
    onRefresh();
  };

  const getModuleName = (moduleId?: string) => {
    if (!moduleId) return '—';
    return modules.find(m => m.id === moduleId)?.name ?? '—';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requirements…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="implemented">Implemented</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={portalFilter} onValueChange={setPortalFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Portals</SelectItem>
            {PORTALS.map(p => (
              <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Requirement
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border/60 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-24 text-xs font-semibold">ID</TableHead>
              <TableHead className="text-xs font-semibold">Title</TableHead>
              <TableHead className="text-xs font-semibold">Portal</TableHead>
              <TableHead className="text-xs font-semibold">Module</TableHead>
              <TableHead className="text-xs font-semibold">Priority</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Assigned To</TableHead>
              <TableHead className="text-xs font-semibold">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  No requirements found.
                </TableCell>
              </TableRow>
            ) : filtered.map(req => {
              const portalKey = (req.portal ?? 'evan').toLowerCase();
              const portalBadgeStyle = PORTAL_STYLES[portalKey] ?? PORTAL_STYLES.evan;
              const portalLabel = portalKey.charAt(0).toUpperCase() + portalKey.slice(1);
              return (
                <TableRow key={req.id} className="text-sm">
                  <TableCell className="font-mono text-xs text-muted-foreground">{req.requirement_id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-sm">{req.title}</p>
                      {req.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${portalBadgeStyle}`}>
                      {portalLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getModuleName(req.module_id)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${PRIORITY_STYLES[req.priority]}`}>
                      {req.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={req.status} onValueChange={val => updateStatus(req.id, val)}>
                      <SelectTrigger className="h-6 w-28 text-[11px] border-0 p-0 bg-transparent">
                        <Badge className={`text-[10px] px-1.5 py-0.5 border-0 cursor-pointer ${STATUS_STYLES[req.status]}`}>
                          {req.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {['draft','approved','implemented','verified'].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{req.assigned_to || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Business Requirement</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} placeholder="Requirement title" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="module_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="portal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PORTALS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="assigned_to" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <FormControl><Input {...field} placeholder="Developer name" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['draft','approved','implemented','verified'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['critical','high','medium','low'].map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} rows={2} placeholder="What needs to be built?" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="acceptance_criteria" render={({ field }) => (
                <FormItem>
                  <FormLabel>Acceptance Criteria</FormLabel>
                  <FormControl><Textarea {...field} rows={2} placeholder="How do we know it's done?" /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Adding…' : 'Add Requirement'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
