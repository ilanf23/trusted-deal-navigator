import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, User, Trash2, FolderOpen } from 'lucide-react';

// ── Types ──

export interface LeadProject {
  id: string;
  lead_id: string;
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form on open
  useEffect(() => {
    if (!open) { setConfirmDelete(false); return; }
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
    } else {
      setName(''); setStatus('open'); setProjectStage('open');
      setPriority(''); setOwner(''); setDueDate(undefined);
      setDescription(''); setVisibility('everyone'); setTags('');
      setClxFileName(''); setBankRelationships(''); setWaitingOn('');
    }
  }, [open, project]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lead-projects'] });
    onSaved();
  }, [queryClient, onSaved]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lead_projects').insert({
        lead_id: leadId,
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
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Project created'); invalidate(); onClose(); },
    onError: () => toast.error('Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!project) return;
      const { error } = await supabase
        .from('lead_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', project.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!project) return;
      const { error } = await supabase.from('lead_projects').delete().eq('id', project.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Project deleted'); invalidate(); onClose(); },
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
    createMutation.mutate();
  }, [name, createMutation]);

  const handleDelete = useCallback(() => {
    if (confirmDelete) deleteMutation.mutate();
    else setConfirmDelete(true);
  }, [confirmDelete, deleteMutation]);

  const handleClose = useCallback(() => { setConfirmDelete(false); onClose(); }, [onClose]);

  // ── Render ──

  const ownerName = owner ? teamMembers.find(m => m.id === owner)?.name ?? '' : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-2xl p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              {isEditMode ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
                  className="text-lg font-semibold border-0 p-0 h-auto shadow-none focus-visible:ring-0"
                />
              ) : (
                <DialogTitle className="text-lg">Create Project</DialogTitle>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">{leadName}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name (create mode only) */}
          {!isEditMode && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name..." autoFocus />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={(v) => handleSelectChange('status', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Project Stage */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Stage</label>
            <Select value={projectStage} onValueChange={(v) => handleSelectChange('project_stage', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {projectStageOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
            <Select value={priority || '__none__'} onValueChange={(v) => handleSelectChange('priority', v === '__none__' ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select priority..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Owner</label>
            <Select value={owner || '__none__'} onValueChange={handleOwnerChange}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{ownerName || 'Unassigned'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[200]" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={handleDateSelect} initialFocus />
              </PopoverContent>
            </Popover>
            {dueDate && (
              <button onClick={() => handleDateSelect(undefined)} className="text-xs text-muted-foreground hover:text-foreground mt-1">
                Clear date
              </button>
            )}
          </div>

          {/* CLX File Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CLX File Name</label>
            <Input value={clxFileName} onChange={(e) => setClxFileName(e.target.value)} onBlur={() => handleTextFieldBlur('clx_file_name', clxFileName, project?.clx_file_name ?? null)} placeholder="e.g. CharityHospital" />
          </div>

          {/* Waiting On */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Waiting On</label>
            <Input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} onBlur={() => handleTextFieldBlur('waiting_on', waitingOn, project?.waiting_on ?? null)} placeholder="Who/what are you waiting on?" />
          </div>

          {/* Bank Relationships */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Relationships</label>
            <Input value={bankRelationships} onChange={(e) => setBankRelationships(e.target.value)} onBlur={() => handleTextFieldBlur('bank_relationships', bankRelationships, project?.bank_relationships ?? null)} />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={handleDescriptionBlur} placeholder="Add details..." rows={3} className="resize-none" />
          </div>

          {/* Visibility */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Visibility</label>
            <Select value={visibility} onValueChange={(v) => handleSelectChange('visibility', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={handleTagsBlur} placeholder="Comma-separated tags..." />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border flex items-center justify-between">
          {isEditMode ? (
            <>
              <Button variant="ghost" size="sm" className={confirmDelete ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-muted-foreground'} onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
            </>
          ) : (
            <>
              <div />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
                  Create Project
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
