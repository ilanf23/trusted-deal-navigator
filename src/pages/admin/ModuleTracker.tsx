import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminLayout from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import {
  Plus, LayoutGrid, TableProperties, GitBranch, Search,
  Layers, Activity, CheckCircle, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ModuleCard, { type Module, type ModuleFeature } from '@/components/admin/modules/ModuleCard';
import ModuleDetailDialog from '@/components/admin/modules/ModuleDetailDialog';
import RequirementsTable, { type BusinessRequirement } from '@/components/admin/modules/RequirementsTable';
import ModulePipelineBoard from '@/components/admin/modules/ModulePipelineBoard';

const PORTALS = ['evan', 'brad', 'adam', 'maura', 'wendy', 'shared', 'partner', 'client'];

const moduleSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  business_owner: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  icon: z.string().optional(),
  portal: z.string().default('evan'),
});
type ModuleFormValues = z.infer<typeof moduleSchema>;

const ICONS = ['Box','LayoutDashboard','Mail','Phone','FileText','Users','Kanban','BarChart3',
  'Settings','Shield','Bell','Search','Star','Zap','Globe','Database','ClipboardList','Bug','Calendar','MessageSquare','TrendingUp'];

export default function ModuleTracker() {
  const { toast } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [requirements, setRequirements] = useState<BusinessRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const [portalFilter, setPortalFilter] = useState('all');
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [colCount, setColCount] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: { name: '', description: '', business_owner: '', priority: 'medium', status: 'planned', icon: 'Box', portal: 'evan' },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [modulesRes, tasksRes, requirementsRes] = await Promise.all([
      supabase.from('modules').select('*').order('created_at'),
      supabase.from('module_tasks').select('module_id, status'),
      supabase.from('business_requirements').select('*').order('requirement_id'),
    ]);

    const tasks = tasksRes.data ?? [];
    const mods: Module[] = (modulesRes.data ?? []).map(m => {
      const modTasks = tasks.filter(t => t.module_id === m.id);
      return {
        ...m,
        taskCount: modTasks.length,
        doneCount: modTasks.filter(t => t.status === 'done').length,
      };
    });
    setModules(mods);
    setRequirements((requirementsRes.data ?? []) as BusinessRequirement[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Detect actual column count from grid layout
  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const observer = new ResizeObserver(() => {
      const firstChild = gridEl.firstElementChild as HTMLElement | null;
      if (!firstChild) return;
      const cols = Math.round(gridEl.offsetWidth / firstChild.offsetWidth);
      setColCount(Math.max(1, cols));
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, []);

  // Reset open rows when search changes
  useEffect(() => { setOpenRows(new Set()); }, [moduleSearch]);

  const toggleRow = (rowIdx: number) => {
    setOpenRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  };

  const handleAddModule = async (values: ModuleFormValues) => {
    setSaving(true);
    const { error } = await supabase.from('modules').insert(values as any);
    setSaving(false);
    if (error) { toast({ title: 'Error adding module', variant: 'destructive' }); return; }
    toast({ title: 'Module added!' });
    form.reset();
    setAddModuleOpen(false);
    fetchData();
  };

  const openDetail = (module: Module) => {
    setSelectedModule(module);
    setDetailOpen(true);
  };

  // Summary stats
  const totalModules = modules.length;
  const inProgress = modules.filter(m => m.status === 'in_progress').length;
  const complete = modules.filter(m => m.status === 'complete').length;
  const completePct = totalModules > 0 ? Math.round(complete / totalModules * 100) : 0;
  const openReqs = requirements.filter(r => r.status === 'draft' || r.status === 'approved').length;

  return (
    <AdminLayout>
      {/* Page background + gradient hero */}
      <div className="relative -m-6 min-h-screen bg-[#F8F8FA]">
        {/* Top gradient overlay */}
        <div
          className="absolute inset-x-0 top-0 h-[200px] pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, rgba(99,102,241,0.06), transparent)' }}
        />

        <div className="relative z-10 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="relative inline-block">
                <h1 className="font-bold text-4xl tracking-tight text-gray-900">Module Tracker</h1>
                {/* Gradient accent underline */}
                <div
                  className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)' }}
                />
              </div>
              <p className="text-sm text-gray-500 font-medium mt-2">Business requirements and development pipeline</p>
            </div>
            <Button onClick={() => setAddModuleOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Module
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Modules',
                value: totalModules,
                leftBorder: 'border-l-indigo-500',
                iconBg: 'bg-indigo-50',
                iconColor: 'text-indigo-500',
                Icon: Layers,
              },
              {
                label: 'In Progress',
                value: inProgress,
                leftBorder: 'border-l-amber-500',
                iconBg: 'bg-amber-50',
                iconColor: 'text-amber-500',
                Icon: Activity,
              },
              {
                label: 'Complete',
                value: `${completePct}%`,
                leftBorder: 'border-l-emerald-500',
                iconBg: 'bg-emerald-50',
                iconColor: 'text-emerald-500',
                Icon: CheckCircle,
              },
              {
                label: 'Open Requirements',
                value: openReqs,
                leftBorder: 'border-l-rose-500',
                iconBg: 'bg-rose-50',
                iconColor: 'text-rose-500',
                Icon: AlertCircle,
              },
            ].map(stat => (
              <div
                key={stat.label}
                className={`bg-white rounded-2xl shadow-sm border-l-[3px] ${stat.leftBorder} px-5 py-4 flex items-start justify-between`}
              >
                <div>
                  <p className="text-[38px] font-bold leading-none tracking-tight text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">{stat.label}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <stat.Icon className={`w-4 h-4 ${stat.iconColor}`} strokeWidth={1.8} />
                </div>
              </div>
            ))}
          </div>

          {/* Tabs — custom pill segmented control */}
          <Tabs defaultValue="board">
            <TabsList className="bg-gray-100 rounded-xl p-1 h-auto gap-0.5">
              <TabsTrigger
                value="board"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 data-[state=active]:font-semibold gap-1.5"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Modules Board
              </TabsTrigger>
              <TabsTrigger
                value="requirements"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 data-[state=active]:font-semibold gap-1.5"
              >
                <TableProperties className="h-3.5 w-3.5" /> Requirements
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 data-[state=active]:font-semibold gap-1.5"
              >
                <GitBranch className="h-3.5 w-3.5" /> Dev Pipeline
              </TabsTrigger>
            </TabsList>

            {/* Board View */}
            <TabsContent value="board" className="mt-4">
              {/* Search + portal filter */}
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
                  <Input
                    placeholder="Search modules..."
                    value={moduleSearch}
                    onChange={e => setModuleSearch(e.target.value)}
                    className="pl-10 h-11 text-sm bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 focus-visible:ring-indigo-300"
                  />
                </div>
                <Select value={portalFilter} onValueChange={v => { setPortalFilter(v); setOpenRows(new Set()); }}>
                  <SelectTrigger className="w-40 h-11 text-sm bg-white border border-gray-200 rounded-xl shadow-sm">
                    <SelectValue placeholder="All Portals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Portals</SelectItem>
                    {PORTALS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-40 bg-white/60 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : modules.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
                  <p className="text-gray-400 text-sm">No modules yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddModuleOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add your first module
                  </Button>
                </div>
              ) : (() => {
                const filtered = modules.filter(m => {
                  const matchSearch = !moduleSearch ||
                    m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                    (m.description ?? '').toLowerCase().includes(moduleSearch.toLowerCase());
                  const matchPortal = portalFilter === 'all' || (m.portal ?? 'evan') === portalFilter;
                  return matchSearch && matchPortal;
                });
                return filtered.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
                    <p className="text-gray-400 text-sm">No modules match your filters.</p>
                  </div>
                ) : (
                  <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((mod, index) => {
                      const rowIndex = Math.floor(index / colCount);
                      const features: ModuleFeature[] = requirements
                        .filter(r => r.module_id === mod.id)
                        .map(r => ({ id: r.id, title: r.title, requirement_id: r.requirement_id, status: r.status }));
                      return (
                        <ModuleCard
                          key={mod.id}
                          module={mod}
                          features={features}
                          onClick={openDetail}
                          showFeatures={openRows.has(rowIndex)}
                          onToggleFeatures={() => toggleRow(rowIndex)}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>

            {/* Requirements Table */}
            <TabsContent value="requirements" className="mt-4">
              <RequirementsTable requirements={requirements} modules={modules} onRefresh={fetchData} />
            </TabsContent>

            {/* Dev Pipeline Kanban */}
            <TabsContent value="pipeline" className="mt-4">
              <ModulePipelineBoard modules={modules} onRefresh={fetchData} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Module Dialog */}
      <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Module</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddModule)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Module Name</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Gmail Integration" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="business_owner" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Owner</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Ilan" /></FormControl>
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
                <FormField control={form.control} name="icon" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ICONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['planned','in_progress','in_review','complete','on_hold'].map(s => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
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
                  <FormControl><Textarea {...field} rows={3} placeholder="What does this module do and why does it matter?" /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Adding…' : 'Add Module'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Module Detail Dialog */}
      <ModuleDetailDialog
        module={selectedModule}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSave={() => { fetchData(); }}
      />
    </AdminLayout>
  );
}
