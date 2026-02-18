import { useState, useEffect, useCallback } from 'react';
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
import { Plus, LayoutGrid, Table2, Kanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ModuleCard, { type Module, type ModuleFeature } from '@/components/admin/modules/ModuleCard';
import ModuleDetailDialog from '@/components/admin/modules/ModuleDetailDialog';
import RequirementsTable, { type BusinessRequirement } from '@/components/admin/modules/RequirementsTable';
import ModulePipelineBoard from '@/components/admin/modules/ModulePipelineBoard';

const moduleSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  business_owner: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  icon: z.string().optional(),
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

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: { name: '', description: '', business_owner: '', priority: 'medium', status: 'planned', icon: 'Box' },
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Module Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Business requirements and development pipeline</p>
          </div>
          <Button onClick={() => setAddModuleOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Module
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Modules', value: totalModules },
            { label: 'In Progress', value: inProgress },
            { label: 'Complete', value: `${completePct}%` },
            { label: 'Open Requirements', value: openReqs },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border/60 rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board" className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" /> Modules Board
            </TabsTrigger>
            <TabsTrigger value="requirements" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" /> Requirements
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <Kanban className="h-3.5 w-3.5" /> Dev Pipeline
            </TabsTrigger>
          </TabsList>

          {/* Board View */}
          <TabsContent value="board" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 bg-muted/30 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : modules.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
                <p className="text-muted-foreground text-sm">No modules yet.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddModuleOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add your first module
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.map(mod => {
                  const features: ModuleFeature[] = requirements
                    .filter(r => r.module_id === mod.id)
                    .map(r => ({ id: r.id, title: r.title, requirement_id: r.requirement_id, status: r.status }));
                  return <ModuleCard key={mod.id} module={mod} features={features} onClick={openDetail} />;
                })}
              </div>
            )}
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
