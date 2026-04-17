import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, FileText, Pencil, Trash2, Send, Loader2, Sparkles,
  ArrowRight, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { appendSignature } from '@/lib/email-signature';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'outreach', label: 'Outreach', color: 'bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800' },
  { value: 'follow_up', label: 'Follow-up', color: 'bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800' },
  { value: 'documents', label: 'Documents', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800' },
  { value: 'rate_alert', label: 'Rate Alert', color: 'bg-rose-500/15 text-rose-700 border-rose-200 dark:text-rose-400 dark:border-rose-800' },
  { value: 'thank_you', label: 'Thank You', color: 'bg-violet-500/15 text-violet-700 border-violet-200 dark:text-violet-400 dark:border-violet-800' },
  { value: 'general', label: 'General', color: 'bg-slate-500/15 text-slate-700 border-slate-200 dark:text-slate-400 dark:border-slate-800' },
];

function getCategoryStyle(category: string | null) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
}

interface GmailTemplatesViewProps {
  onUseTemplate: (subject: string, body: string) => void;
}

export function GmailTemplatesView({ onUseTemplate }: GmailTemplatesViewProps) {
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);

  // Fetch templates from database
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Create
  const createMutation = useMutation({
    mutationFn: async (tpl: Partial<EmailTemplate>) => {
      const { error } = await supabase.from('email_templates').insert({
        name: tpl.name!,
        subject: tpl.subject!,
        body: tpl.body!,
        category: tpl.category || 'general',
        user_id: teamMember?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template created');
      setDialogOpen(false);
    },
    onError: () => toast.error('Failed to create template'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async (tpl: Partial<EmailTemplate>) => {
      const { error } = await supabase.from('email_templates').update({
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        category: tpl.category,
      }).eq('id', tpl.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template updated');
      setDialogOpen(false);
    },
    onError: () => toast.error('Failed to update template'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  // Filter
  const filtered = templates.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUse = (tpl: EmailTemplate) => {
    onUseTemplate(tpl.subject, appendSignature(tpl.body));
  };

  const handleCreate = () => {
    setEditingTemplate({ name: '', subject: '', body: '', category: 'general' });
    setIsCreating(true);
    setDialogOpen(true);
  };

  const handleEdit = (tpl: EmailTemplate) => {
    setEditingTemplate({ ...tpl });
    setIsCreating(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingTemplate?.name?.trim() || !editingTemplate?.subject?.trim()) {
      toast.error('Name and subject are required');
      return;
    }
    if (isCreating) {
      createMutation.mutate(editingTemplate);
    } else {
      updateMutation.mutate(editingTemplate);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // --- Render ---

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <Button size="sm" onClick={handleCreate} className="gap-1.5 h-8 text-xs font-medium rounded-full px-4">
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs rounded-full bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-medium transition-all border',
              !activeCategory
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            )}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium transition-all border',
                activeCategory === cat.value
                  ? cat.color
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template cards */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center mb-4">
                <FolderOpen className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                {searchQuery || activeCategory ? 'No matching templates' : 'No templates yet'}
              </p>
              <p className="text-xs text-muted-foreground mb-5 max-w-[240px]">
                {searchQuery || activeCategory
                  ? 'Try adjusting your search or filter'
                  : 'Create your first template to speed up email outreach'}
              </p>
              {!searchQuery && !activeCategory && (
                <Button size="sm" variant="outline" onClick={handleCreate} className="gap-1.5 rounded-full text-xs h-8 px-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Create Template
                </Button>
              )}
            </div>
          ) : (
            filtered.map((tpl) => {
              const cat = getCategoryStyle(tpl.category);
              const isHovered = hoveredId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onMouseEnter={() => setHoveredId(tpl.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    'group relative rounded-xl border border-border/60 p-4 transition-all duration-200 cursor-pointer',
                    'hover:border-foreground/20 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]',
                    'dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)]',
                  )}
                  onClick={() => handleUse(tpl)}
                >
                  {/* Top row: category + actions */}
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant="outline" className={cn('text-[10px] font-medium rounded-full px-2 py-0', cat.color)}>
                      {cat.label}
                    </Badge>
                    <div
                      className={cn(
                        'flex items-center gap-0.5 transition-opacity duration-150',
                        isHovered ? 'opacity-100' : 'opacity-0'
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => handleEdit(tpl)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(tpl.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Template name */}
                  <h3 className="text-[13px] font-semibold tracking-tight mb-1 leading-snug">
                    {tpl.name}
                  </h3>

                  {/* Subject */}
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {tpl.subject}
                  </p>

                  {/* Body preview */}
                  <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {tpl.body}
                  </p>

                  {/* Use button — slides in on hover */}
                  <div className={cn(
                    'flex items-center gap-1 mt-3 text-[11px] font-medium transition-all duration-200',
                    isHovered ? 'text-primary opacity-100 translate-x-0' : 'text-primary/0 opacity-0 -translate-x-1'
                  )}>
                    <Send className="w-3 h-3" />
                    Use template
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {isCreating ? 'Create Template' : 'Edit Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template Name</Label>
                <Input
                  value={editingTemplate?.name || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g., Initial Outreach"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={editingTemplate?.category || 'general'}
                  onValueChange={(v) => setEditingTemplate(prev => prev ? { ...prev, category: v } : null)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject Line</Label>
              <Input
                value={editingTemplate?.subject || ''}
                onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, subject: e.target.value } : null)}
                placeholder="e.g., Commercial Lending Opportunity"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Body</Label>
              <Textarea
                value={editingTemplate?.body || ''}
                onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, body: e.target.value } : null)}
                placeholder="Write your email template content..."
                rows={8}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isCreating ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
