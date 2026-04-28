import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Trash2, Tag as TagIcon, GripVertical } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CustomField {
  id: string;
  entity_type: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean | null;
  position: number;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  position: number;
  pipeline_id: string;
}

interface Pipeline {
  id: string;
  name: string;
  is_system: boolean;
}

const ENTITY_TYPES = [
  { value: 'people', label: 'People' },
  { value: 'companies', label: 'Companies' },
  { value: 'pipeline_potential', label: 'Pipeline — Potential' },
  { value: 'pipeline_underwriting', label: 'Pipeline — Underwriting' },
  { value: 'pipeline_lender_management', label: 'Pipeline — Lender Management' },
  { value: 'lender_programs', label: 'Lender Programs' },
  { value: 'tasks', label: 'Tasks' },
];

const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'dropdown',
  'multi_select',
  'checkbox',
  'url',
  'email',
  'phone',
  'currency',
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const CustomFieldDialog = ({
  open,
  onOpenChange,
  entityType,
  field,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: string;
  field: CustomField | null;
}) => {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(field?.label ?? '');
  const [fieldKey, setFieldKey] = useState(field?.field_key ?? '');
  const [fieldType, setFieldType] = useState(field?.field_type ?? 'text');
  const [required, setRequired] = useState(field?.required ?? false);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        entity_type: entityType,
        field_key: fieldKey || slugify(label),
        label,
        field_type: fieldType,
        required,
        position: field?.position ?? 999,
      };
      if (field) {
        const { error } = await supabase.from('custom_fields').update(payload).eq('id', field.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_fields').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success(field ? 'Field updated' : 'Field added');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? 'Edit field' : 'New field'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!field) setFieldKey(slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <Label>Field key</Label>
            <Input value={fieldKey} onChange={(e) => setFieldKey(slugify(e.target.value))} disabled={!!field} />
            <p className="text-xs text-muted-foreground mt-1">Used in API and exports. Lowercase, no spaces.</p>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Required</Label>
            <Switch checked={required} onCheckedChange={setRequired} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!label || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CustomFieldsTab = () => {
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async (): Promise<CustomField[]> => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id, entity_type, field_key, label, field_type, required, position')
        .order('entity_type')
        .order('position');
      if (error) throw error;
      return (data ?? []) as CustomField[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field deleted');
    },
  });

  const grouped = (data ?? []).reduce<Record<string, CustomField[]>>((acc, f) => {
    (acc[f.entity_type] ||= []).push(f);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ENTITY_TYPES.map((et) => (
        <div key={et.value} className="rounded-md border border-border">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
            <div>
              <h3 className="text-sm font-semibold">{et.label}</h3>
              <p className="text-xs text-muted-foreground">{(grouped[et.value] ?? []).length} field(s)</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCreating(et.value)}>
              <Plus className="h-4 w-4 mr-1" /> Add field
            </Button>
          </div>
          <div className="divide-y divide-border">
            {(grouped[et.value] ?? []).length === 0 && (
              <p className="px-4 py-3 text-xs text-muted-foreground italic">No custom fields yet.</p>
            )}
            {(grouped[et.value] ?? []).map((f) => (
              <div key={f.id} className="px-4 py-2 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {f.label}{' '}
                    {f.required && (
                      <Badge variant="outline" className="ml-1 text-[10px] py-0">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {f.field_key} · {f.field_type}
                  </div>
                </div>
                <button onClick={() => setEditing(f)} className="p-1 rounded hover:bg-muted" aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${f.label}"?`)) remove.mutate(f.id);
                  }}
                  className="p-1 rounded hover:bg-muted text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <CustomFieldDialog
        open={creating !== null || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(null);
            setEditing(null);
          }
        }}
        entityType={creating ?? editing?.entity_type ?? 'people'}
        field={editing}
      />
    </div>
  );
};

const PipelineStagesTab = () => {
  const queryClient = useQueryClient();

  const { data: pipelines } = useQuery({
    queryKey: ['system-pipelines-customization'],
    queryFn: async (): Promise<Pipeline[]> => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, is_system')
        .eq('is_system', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Pipeline[];
    },
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages-all'],
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, position, pipeline_id')
        .order('position');
      if (error) throw error;
      return (data ?? []) as PipelineStage[];
    },
  });

  const addStage = useMutation({
    mutationFn: async ({ pipelineId, name }: { pipelineId: string; name: string }) => {
      const { error } = await supabase.from('pipeline_stages').insert({
        pipeline_id: pipelineId,
        name,
        position: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages-all'] });
      toast.success('Stage added');
    },
  });

  const removeStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages-all'] });
      toast.success('Stage deleted');
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      const { error } = await supabase.from('pipeline_stages').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-stages-all'] }),
  });

  if (!pipelines || !stages) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pipelines.map((p) => {
        const pStages = stages.filter((s) => s.pipeline_id === p.id);
        return (
          <PipelineStageCard
            key={p.id}
            pipeline={p}
            stages={pStages}
            onAdd={(name) => addStage.mutate({ pipelineId: p.id, name })}
            onRemove={(id) => {
              if (confirm('Delete this stage?')) removeStage.mutate(id);
            }}
            onUpdate={(id, patch) => updateStage.mutate({ id, ...patch })}
          />
        );
      })}
    </div>
  );
};

const PipelineStageCard = ({
  pipeline,
  stages,
  onAdd,
  onRemove,
  onUpdate,
}: {
  pipeline: Pipeline;
  stages: PipelineStage[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: { name?: string; color?: string }) => void;
}) => {
  const [newName, setNewName] = useState('');
  return (
    <div className="rounded-md border border-border">
      <div className="px-4 py-2.5 border-b border-border bg-muted/40">
        <h3 className="text-sm font-semibold">{pipeline.name}</h3>
        <p className="text-xs text-muted-foreground">{stages.length} stage(s)</p>
      </div>
      <div className="divide-y divide-border">
        {stages.map((s) => (
          <div key={s.id} className="px-4 py-2 flex items-center gap-3">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <div
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color || '#3b2778' }}
            />
            <Input
              defaultValue={s.name}
              onBlur={(e) => {
                if (e.target.value !== s.name) onUpdate(s.id, { name: e.target.value });
              }}
              className="flex-1 max-w-md h-8"
            />
            <input
              type="color"
              value={s.color || '#3b2778'}
              onChange={(e) => onUpdate(s.id, { color: e.target.value })}
              className="h-8 w-10 rounded border border-border cursor-pointer"
            />
            <button
              onClick={() => onRemove(s.id)}
              className="p-1 rounded hover:bg-muted text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-border flex gap-2">
        <Input
          placeholder="New stage name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-8"
        />
        <Button
          size="sm"
          onClick={() => {
            if (newName.trim()) {
              onAdd(newName.trim());
              setNewName('');
            }
          }}
          disabled={!newName.trim()}
        >
          <Plus className="h-4 w-4 mr-1" /> Add stage
        </Button>
      </div>
    </div>
  );
};

const TagsTab = () => {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <TagIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
      <h3 className="text-sm font-semibold">Tag manager</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
        Cross-entity tag management is coming next. For now, tags are managed inline on each record.
      </p>
    </div>
  );
};

const ActivityTypesTab = () => {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <h3 className="text-sm font-semibold">Activity types</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
        Custom activity types — schema is in place via the <code>activity_types</code> table; UI ships next.
      </p>
    </div>
  );
};

const RecordLayoutsTab = () => {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <h3 className="text-sm font-semibold">Record layouts</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
        <strong>Deferred to v2.</strong> The expanded views currently render a hardcoded field list — refactoring them to
        read from <code>record_layouts</code> is significant scope. Schema is in place; UI lands in a follow-up.
      </p>
    </div>
  );
};

const CustomizationSection = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Custom fields, pipeline stages, and other workspace data structures.
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="stages">Pipeline Stages</TabsTrigger>
          <TabsTrigger value="layouts">Record Layouts</TabsTrigger>
          <TabsTrigger value="activity">Activity Types</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-6">
          <CustomFieldsTab />
        </TabsContent>
        <TabsContent value="stages" className="mt-6">
          <PipelineStagesTab />
        </TabsContent>
        <TabsContent value="layouts" className="mt-6">
          <RecordLayoutsTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-6">
          <ActivityTypesTab />
        </TabsContent>
        <TabsContent value="tags" className="mt-6">
          <TagsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomizationSection;
