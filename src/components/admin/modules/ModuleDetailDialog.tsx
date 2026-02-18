import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Module } from './ModuleCard';
import type { BusinessRequirement } from './RequirementsTable';

const moduleSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  business_owner: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  icon: z.string().optional(),
});
type ModuleFormValues = z.infer<typeof moduleSchema>;

interface ModuleTask {
  id: string;
  module_id: string;
  title: string;
  status: string;
  created_at: string;
}

interface ModuleDetailDialogProps {
  module: Module | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const ICONS = ['Box','LayoutDashboard','Mail','Phone','FileText','Users','Kanban','BarChart3',
  'Settings','Shield','Bell','Search','Star','Zap','Globe','Database','ClipboardList','Bug','Calendar','MessageSquare','TrendingUp'];

export default function ModuleDetailDialog({ module, open, onOpenChange, onSave }: ModuleDetailDialogProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ModuleTask[]>([]);
  const [requirements, setRequirements] = useState<BusinessRequirement[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      name: '', description: '', business_owner: '',
      priority: 'medium', status: 'planned', icon: 'Box',
    },
  });

  useEffect(() => {
    if (module) {
      form.reset({
        name: module.name,
        description: module.description ?? '',
        business_owner: module.business_owner ?? '',
        priority: module.priority,
        status: module.status,
        icon: module.icon ?? 'Box',
      });
      fetchTasks(module.id);
      fetchRequirements(module.id);
    }
  }, [module]);

  const fetchTasks = async (moduleId: string) => {
    const { data } = await supabase.from('module_tasks').select('*').eq('module_id', moduleId).order('created_at');
    setTasks(data ?? []);
  };

  const fetchRequirements = async (moduleId: string) => {
    const { data } = await supabase.from('business_requirements').select('*').eq('module_id', moduleId).order('requirement_id');
    setRequirements((data ?? []) as BusinessRequirement[]);
  };

  const handleSave = async (values: ModuleFormValues) => {
    if (!module) return;
    setSaving(true);
    const { error } = await supabase.from('modules').update(values).eq('id', module.id);
    setSaving(false);
    if (error) { toast({ title: 'Error saving module', variant: 'destructive' }); return; }
    toast({ title: 'Module saved' });
    onSave();
  };

  const toggleTask = async (task: ModuleTask) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await supabase.from('module_tasks').update({ status: newStatus }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !module) return;
    const { data } = await supabase.from('module_tasks').insert({ module_id: module.id, title: newTaskTitle }).select().single();
    if (data) setTasks(prev => [...prev, data]);
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('module_tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round(doneCount / tasks.length * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{module?.name ?? 'Module Details'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1">
              Tasks {tasks.length > 0 && <span className="ml-1 text-xs opacity-60">({doneCount}/{tasks.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="requirements" className="flex-1">
              Requirements {requirements.length > 0 && <span className="ml-1 text-xs opacity-60">({requirements.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Module Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
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
                            <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
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
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} rows={3} placeholder="What does this module do and why?" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-4">
            {tasks.length > 0 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{doneCount} of {tasks.length} tasks done ({progress}%)</p>
              </div>
            )}
            <div className="space-y-1.5">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 group">
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => toggleTask(task)}
                  />
                  <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Add a task…"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={addTask}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="requirements" className="mt-4 space-y-3">
            {requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No requirements linked to this module yet.</p>
            ) : requirements.map(req => (
              <div key={req.id} className="border border-border/60 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{req.requirement_id}</span>
                  <Badge variant="outline" className="text-[10px]">{req.status}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{req.title}</p>
                {req.description && <p className="text-xs text-muted-foreground">{req.description}</p>}
                {req.acceptance_criteria && (
                  <>
                    <Separator />
                    <p className="text-xs text-muted-foreground"><span className="font-medium">AC:</span> {req.acceptance_criteria}</p>
                  </>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
