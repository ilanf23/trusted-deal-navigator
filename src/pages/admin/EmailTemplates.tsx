import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Pencil, Trash2, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
}

const EmailTemplates = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Email Templates');
    return () => { setPageTitle(null); };
  }, []);

  // Fetch templates from database
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (template: Omit<EmailTemplate, 'id'>) => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert(template)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template created successfully');
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const { data, error } = await supabase
        .from('email_templates')
        .update({
          name: template.name,
          subject: template.subject,
          body: template.body,
          category: template.category,
        })
        .eq('id', template.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template updated successfully');
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      subject: '',
      body: '',
      category: 'general',
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    
    if (!editingTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (isCreating) {
      createMutation.mutate({
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
        category: editingTemplate.category,
      });
    } else {
      updateMutation.mutate(editingTemplate);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <EmployeeLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-end mb-6">
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Templates Grid */}
        {!isLoading && (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{template.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(template.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && templates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-4">Create your first email template to get started</p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isCreating ? 'Create Template' : 'Edit Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={editingTemplate?.name || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g., Initial Outreach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={editingTemplate?.subject || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, subject: e.target.value } : null)}
                  placeholder="e.g., Commercial Lending Opportunity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Email Body</Label>
                <Textarea
                  id="body"
                  value={editingTemplate?.body || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, body: e.target.value } : null)}
                  placeholder="Write your email template content here..."
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isCreating ? 'Create' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EmployeeLayout>
  );
};

export default EmailTemplates;
