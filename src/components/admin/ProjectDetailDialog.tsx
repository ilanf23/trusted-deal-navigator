import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useUndo } from '@/contexts/UndoContext';
import { CalendarIcon, User, Trash2, FolderOpen, X, ChevronDown } from 'lucide-react';

// ── Types ──

export interface LeadProject {
  id: string;
  entity_id: string;
  name: string;
  status: string | null;
  project_stage: string | null;
  priority: string | null;
  owner: string | null;
  due_date: string | null;
  description: string | null;
  visibility: string | null;
  tags: string[] | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
  waiting_on: string | null;
  related_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
] as const;

const projectStageOptions = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval' },
  { value: 'closing_checklist_in_process', label: 'Closing Checklist in Process' },
  { value: 'waiting_on_closing_date', label: 'Waiting on Closing Date' },
  { value: 'closing_scheduled', label: 'Closing Scheduled' },
  { value: 'ts_received_brad_to_discuss', label: "TS's Received/Brad to Discuss" },
] as const;

const priorityOptions = [
  { value: 'urgent_to_close', label: 'Urgent to Close' },
  { value: 'urgent_to_get_approval', label: 'Urgent to Get Approval' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' },
] as const;

// ── Helpers ──

function parseDateOnly(isoString: string | null): Date | undefined {
  if (!isoString) return undefined;
  try { return parseISO(isoString); } catch { return undefined; }
}

// ── Component ──

interface ProjectDetailDialogProps {
  project: LeadProject | null;
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  teamMembers: { id: string; name: string }[];
  currentUserName?: string | null;
  onSaved: () => void;
}

export default function ProjectDetailDialog({
  project, open, onClose, leadId, leadName, teamMembers, currentUserName, onSaved,
}: ProjectDetailDialogProps) {
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();
  const isEditMode = !!project;

  // Form state
  const [name, setName] = useState('');
  const [status, setStatus] = useState('open');
  const [projectStage, setProjectStage] = useState('open');
  const [priority, setPriority] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [tags, setTags] = useState('');
  const [clxFileName, setClxFileName] = useState('');
  const [bankRelationships, setBankRelationships] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [relatedToId, setRelatedToId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLeadPicker, setShowLeadPicker] = useState(false);

  // Fetch all leads for the "Related To" picker
  const { data: allLeads = [] } = useQuery({
    queryKey: ['all-leads-for-project-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('pipeline').select('id, name, company_name').order('name').limit(500);
      return (data ?? []) as { id: string; name: string; company_name: string | null }[];
    },
    enabled: open,
  });

  const selectedLeadName = useMemo(() => {
    if (relatedToId) {
      const found = allLeads.find(l => l.id === relatedToId);
      if (found) return [found.name, found.company_name].filter(Boolean).join(' - ');
    }
    if (leadName) return leadName;
    return '';
  }, [relatedToId, allLeads, leadName]);

  // Populate form on open
  useEffect(() => {
    if (!open) { setConfirmDelete(false); setShowLeadPicker(false); return; }
    if (project) {
      setName(project.name);
      setStatus(project.status || 'open');
      setProjectStage(project.project_stage || 'open');
      setPriority(project.priority || '');
      setOwner(project.owner || '');
      setDueDate(parseDateOnly(project.due_date));
      setDescription(project.description || '');
      setVisibility(project.visibility || 'everyone');
      setTags((project.tags ?? []).join(', '));
      setClxFileName(project.clx_file_name || '');
      setBankRelationships(project.bank_relationships || '');
      setWaitingOn(project.waiting_on || '');
      setRelatedToId(project.entity_id || '');
    } else {
      setName(''); setStatus('open'); setProjectStage('open');
      setPriority(''); setOwner(''); setDueDate(new Date());
      setDescription(''); setVisibility('everyone'); setTags('');
      setClxFileName(''); setBankRelationships(''); setWaitingOn('');
      setRelatedToId(leadId || '');
    }
  }, [open, project, leadId]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lead-projects'] });
    queryClient.invalidateQueries({ queryKey: ['all-projects'] });
    onSaved();
  }, [queryClient, onSaved]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async () => {
      const resolvedLeadId = relatedToId || leadId;
      if (!resolvedLeadId) throw new Error('A Related To lead is required');
      const { data, error } = await supabase.from('entity_projects').insert({
        entity_id: resolvedLeadId,
        entity_type: 'deal',
        name: name.trim(),
        status,
        project_stage: projectStage,
        priority: priority || null,
        owner: owner || null,
        due_date: dueDate?.toISOString() || null,
        description: description.trim() || null,
        visibility,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        clx_file_name: clxFileName.trim() || null,
        bank_relationships: bankRelationships.trim() || null,
        waiting_on: waitingOn.trim() || null,
        created_by: currentUserName || null,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Project created');
      invalidate();
      onClose();
      if (data) {
        registerUndo({
          label: `Created project "${name.trim()}"`,
          execute: async () => {
            const { error: e } = await supabase.from('entity_projects').delete().eq('id', data.id);
            if (e) throw e;
            queryClient.invalidateQueries({ queryKey: ['lead-projects'] });
            queryClient.invalidateQueries({ queryKey: ['all-projects'] });
          },
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!project) return;
      // Capture previous values for the fields being updated
      const previousValues: Record<string, unknown> = {};
      for (const key of Object.keys(updates)) {
        previousValues[key] = project[key as keyof LeadProject];
      }
      const { error } = await supabase
        .from('entity_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', project.id);
      if (error) throw error;
      return { projectId: project.id, previousValues };
    },
    onSuccess: (result) => {
      invalidate();
      if (result) {
        const fieldNames = Object.keys(result.previousValues).filter(k => k !== 'updated_at').join(', ');
        registerUndo({
          label: `Updated project ${fieldNames}`,
          execute: async () => {
            const { error: e } = await supabase
              .from('entity_projects')
              .update({ ...result.previousValues, updated_at: new Date().toISOString() })
              .eq('id', result.projectId);
            if (e) throw e;
            queryClient.invalidateQueries({ queryKey: ['lead-projects'] });
            queryClient.invalidateQueries({ queryKey: ['all-projects'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!project) return;
      // Capture full record for undo re-insert
      const { data: fullRecord } = await supabase
        .from('entity_projects')
        .select('*')
        .eq('id', project.id)
        .single();
      const { error } = await supabase.from('entity_projects').delete().eq('id', project.id);
      if (error) throw error;
      return fullRecord;
    },
    onSuccess: (deletedProject) => {
      toast.success('Project deleted');
      invalidate();
      onClose();
      if (deletedProject) {
        registerUndo({
          label: `Deleted project "${deletedProject.name}"`,
          execute: async () => {
            const { id, ...rest } = deletedProject;
            const { error: e } = await supabase.from('entity_projects').insert({ id, ...rest });
            if (e) throw e;
            queryClient.invalidateQueries({ queryKey: ['lead-projects'] });
            queryClient.invalidateQueries({ queryKey: ['all-projects'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete project'),
  });

  // ── Edit-mode field save ──

  const saveField = useCallback((field: string, value: unknown) => {
    if (!project) return;
    updateMutation.mutate({ [field]: value });
  }, [project, updateMutation]);

  const handleNameBlur = useCallback(() => {
    if (project && name.trim() && name.trim() !== project.name) saveField('name', name.trim());
  }, [project, name, saveField]);

  const handleDescriptionBlur = useCallback(() => {
    if (project && (description || '') !== (project.description || '')) saveField('description', description.trim() || null);
  }, [project, description, saveField]);

  const handleTextFieldBlur = useCallback((field: string, current: string, original: string | null) => {
    if (project && current.trim() !== (original || '')) saveField(field, current.trim() || null);
  }, [project, saveField]);

  const handleSelectChange = useCallback((field: string, val: string) => {
    const setter: Record<string, (v: string) => void> = { status: setStatus, project_stage: setProjectStage, priority: setPriority, visibility: setVisibility };
    setter[field]?.(val);
    if (project) saveField(field, val || null);
  }, [project, saveField]);

  const handleOwnerChange = useCallback((val: string) => {
    const resolved = val === '__none__' ? '' : val;
    setOwner(resolved);
    if (project) saveField('owner', resolved || null);
  }, [project, saveField]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDueDate(date);
    if (project) saveField('due_date', date?.toISOString() || null);
  }, [project, saveField]);

  const handleTagsBlur = useCallback(() => {
    if (!project) return;
    const arr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const orig = (project.tags ?? []).join(', ');
    if (tags.trim() !== orig) saveField('tags', arr);
  }, [project, tags, saveField]);

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;
    if (!relatedToId && !leadId) {
      toast.error('Please select a Related To lead');
      return;
    }
    createMutation.mutate();
  }, [name, relatedToId, leadId, createMutation]);

  const handleDelete = useCallback(() => {
    if (confirmDelete) deleteMutation.mutate();
    else setConfirmDelete(true);
  }, [confirmDelete, deleteMutation]);

  const handleClose = useCallback(() => { setConfirmDelete(false); onClose(); }, [onClose]);

  // ── Render ──

  const ownerName = owner ? teamMembers.find(m => m.id === owner)?.name ?? '' : '';

  // Shared underline input style
  const underlineInput = "w-full bg-transparent border-0 border-b border-gray-300 rounded-none px-0 py-2 text-base text-foreground placeholder:text-gray-400 focus:outline-none focus:border-b-2 focus:border-[#1a237e] focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none";
  const underlineSelect = "w-full bg-transparent border-0 border-b border-gray-300 rounded-none px-0 py-2 h-auto text-base text-foreground shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:text-gray-400";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-white dark:bg-card rounded-lg">
        {/* Header */}
        <div className="shrink-0 px-8 pt-6 pb-4">
          {isEditMode ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              className="text-2xl font-bold text-foreground bg-transparent border-0 outline-none w-full"
            />
          ) : (
            <h2 className="text-2xl font-bold text-foreground">Add a New Project</h2>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
          {/* Name */}
          {!isEditMode && (
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Name <span className="text-red-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add Name" autoFocus className={underlineInput} />
            </div>
          )}

          {/* Template */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Template</label>
            <div className="flex items-center justify-between border-b border-gray-300 py-2">
              <span className="text-base text-gray-400">No Selection</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* CLX - File Name */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">CLX - File Name</label>
            <input value={clxFileName} onChange={(e) => setClxFileName(e.target.value)} onBlur={() => handleTextFieldBlur('clx_file_name', clxFileName, project?.clx_file_name ?? null)} placeholder="Add CLX - File Name" className={underlineInput} />
          </div>

          {/* Related To */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Related To</label>
            {selectedLeadName && !showLeadPicker ? (
              <div className="flex items-center justify-between border-b border-gray-300 py-2 cursor-pointer" onClick={() => setShowLeadPicker(true)}>
                <span className="text-base text-foreground">{selectedLeadName}</span>
                <X className="h-4 w-4 text-gray-400 hover:text-foreground" onClick={(e) => { e.stopPropagation(); setRelatedToId(''); }} />
              </div>
            ) : showLeadPicker || (!selectedLeadName && !relatedToId) ? (
              <div>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <Command className="bg-white dark:bg-card">
                    <CommandInput placeholder="Search leads..." className="h-9 text-sm" />
                    <CommandList className="max-h-[160px]">
                      <CommandEmpty className="py-2 text-center text-xs text-gray-400">No results</CommandEmpty>
                      <CommandGroup>
                        {allLeads.map(l => (
                          <CommandItem
                            key={l.id}
                            onSelect={() => { setRelatedToId(l.id); setShowLeadPicker(false); }}
                            className="text-sm cursor-pointer"
                          >
                            <span>{l.name}</span>
                            {l.company_name && <span className="ml-1.5 text-xs text-gray-400">· {l.company_name}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              </div>
            ) : (
              <div className="border-b border-gray-300 py-2 cursor-pointer" onClick={() => setShowLeadPicker(true)}>
                <span className="text-base text-gray-400">Add Relation</span>
              </div>
            )}
          </div>

          {/* Waiting On: */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Waiting On:</label>
            <input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} onBlur={() => handleTextFieldBlur('waiting_on', waitingOn, project?.waiting_on ?? null)} placeholder="Add Waiting On:" className={underlineInput} />
          </div>

          {/* Owner */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Owner</label>
            {ownerName ? (
              <div className="flex items-center justify-between border-b border-gray-300 py-2">
                <span className="text-base text-foreground font-medium">{ownerName}</span>
                <button onClick={() => handleOwnerChange('__none__')} className="text-gray-400 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Select value={owner || '__none__'} onValueChange={handleOwnerChange}>
                <SelectTrigger className={underlineSelect}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* Hidden select for re-picking when owner is set */}
            {ownerName && (
              <Select value={owner || '__none__'} onValueChange={handleOwnerChange}>
                <SelectTrigger className="h-0 w-0 overflow-hidden border-0 p-0 opacity-0 absolute">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Status</label>
            <Select value={status} onValueChange={(v) => handleSelectChange('status', v)}>
              <SelectTrigger className={underlineSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Visibility</label>
            <Select value={visibility} onValueChange={(v) => handleSelectChange('visibility', v)}>
              <SelectTrigger className={underlineSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="owner_only">Owner Only</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={handleDescriptionBlur} placeholder="Add Description" rows={3} className={`${underlineInput} resize-none`} />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-between border-b border-gray-300 py-2 text-left hover:border-gray-400 transition-colors">
                  <span className={`text-base ${dueDate ? 'text-foreground' : 'text-gray-400'}`}>
                    {dueDate ? format(dueDate, 'M/d/yyyy') : 'Pick a date...'}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[200]" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={handleDateSelect} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={handleTagsBlur} placeholder="Add Tag" className={underlineInput} />
          </div>

          {/* Project Stage */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Project Stage</label>
            <Select value={projectStage} onValueChange={(v) => handleSelectChange('project_stage', v)}>
              <SelectTrigger className={underlineSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectStageOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Bank Relationships */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Bank Relationships</label>
            <input value={bankRelationships} onChange={(e) => setBankRelationships(e.target.value)} onBlur={() => handleTextFieldBlur('bank_relationships', bankRelationships, project?.bank_relationships ?? null)} placeholder="Add Bank Relationships" className={underlineInput} />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">Priority</label>
            <Select value={priority || '__none__'} onValueChange={(v) => handleSelectChange('priority', v === '__none__' ? '' : v)}>
              <SelectTrigger className={underlineSelect}>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-8 py-4 border-t border-gray-200 flex items-center gap-4">
          {isEditMode ? (
            <>
              <Button variant="ghost" size="sm" className={confirmDelete ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-muted-foreground'} onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
            </>
          ) : (
            <>
              <button onClick={handleClose} className="text-sm font-semibold uppercase tracking-wider text-[#3b2778] hover:text-[#2d1d5e] transition-colors px-4 py-2">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
                className="text-sm font-semibold uppercase tracking-wider text-white bg-[#3b2778] hover:bg-[#2d1d5e] disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-8 py-2.5 transition-colors"
              >
                Save
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
