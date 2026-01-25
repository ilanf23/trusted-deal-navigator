import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Pencil, Trash2, ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

// Initial templates - in a real app these would come from the database
const initialTemplates: EmailTemplate[] = [
  {
    id: 'template-1',
    name: 'Initial Outreach',
    subject: 'Commercial Lending Opportunity',
    body: 'Hi, I wanted to reach out about financing options that could help grow your business.',
  },
  {
    id: 'template-2',
    name: 'Follow-Up',
    subject: 'Following Up on Our Conversation',
    body: 'Just checking in to see if you had any questions about the loan options we discussed.',
  },
  {
    id: 'template-3',
    name: 'Document Request',
    subject: 'Documents Needed for Your Application',
    body: 'To move forward with your application, please provide the following documents at your earliest convenience.',
  },
  {
    id: 'template-4',
    name: 'Rate Update',
    subject: 'Great News - Rates Have Changed',
    body: 'I wanted to let you know that rates have moved favorably and now might be a good time to revisit your financing.',
  },
  {
    id: 'template-5',
    name: 'Thank You',
    subject: 'Thank You for Your Business',
    body: "Thank you for choosing us for your financing needs - please don't hesitate to reach out if you need anything.",
  },
];

const EvansEmailTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate({
      id: `template-${Date.now()}`,
      name: '',
      subject: '',
      body: '',
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
      setTemplates([...templates, editingTemplate]);
      toast.success('Template created successfully');
    } else {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
      toast.success('Template updated successfully');
    }
    
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/team/evan/gmail')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Email Templates</h1>
              <p className="text-sm text-muted-foreground">Manage your email templates for quick responses</p>
            </div>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        {/* Templates Grid */}
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
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
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

        {templates.length === 0 && (
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
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                {isCreating ? 'Create' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default EvansEmailTemplates;
