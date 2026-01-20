import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, Mail, Phone, Building2, Calendar, FileText, User, Clock, Save, 
  PhoneCall, ChevronDown, ChevronUp, Play, PhoneIncoming, PhoneOutgoing, 
  MessageSquare, History, Plus, Trash2, Globe, Linkedin, Twitter, MapPin,
  Link2, Users, ListTodo, Tag, Edit2, CheckCircle2, Circle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  questionnaire_sent_at: string | null;
  questionnaire_completed_at: string | null;
  // New fields
  known_as: string | null;
  title: string | null;
  contact_type: string | null;
  tags: string[] | null;
  about: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
}

interface LeadPhone {
  id: string;
  lead_id: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface LeadEmail {
  id: string;
  lead_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface LeadAddress {
  id: string;
  lead_id: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

interface LeadOtherContact {
  id: string;
  lead_id: string;
  contact_type: string;
  contact_value: string;
}

interface LeadConnection {
  id: string;
  lead_id: string;
  connected_lead_id: string | null;
  connected_name: string | null;
  connected_company: string | null;
  relationship_type: string | null;
  notes: string | null;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  title: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
}

interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  phone_number: string | null;
  content: string | null;
  duration_seconds: number | null;
  status: string | null;
  transcript: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-800',
  pre_qualification: 'bg-cyan-100 text-cyan-800',
  document_collection: 'bg-yellow-100 text-yellow-800',
  underwriting: 'bg-orange-100 text-orange-800',
  approval: 'bg-green-100 text-green-800',
  funded: 'bg-purple-100 text-purple-800',
};

const contactTypes = [
  { value: 'customer', label: 'Customer' },
  { value: 'potential_customer', label: 'Potential Customer' },
  { value: 'referral_source', label: 'Referral Source' },
  { value: 'lender', label: 'Lender' },
];

const defaultTags = ['Attorney', 'Referral Source', 'Appraiser', 'CPA', 'Insurance Agent', 'Title Company', 'Real Estate Agent'];

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: () => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange, onLeadUpdated }: LeadDetailDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('contact');
  const [editMode, setEditMode] = useState(false);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    known_as: '',
    company_name: '',
    title: '',
    contact_type: 'potential_customer',
    tags: [] as string[],
    about: '',
    notes: '',
    website: '',
    linkedin: '',
    twitter: '',
  });

  // New item states
  const [newPhone, setNewPhone] = useState({ phone_number: '', phone_type: 'mobile' });
  const [newEmail, setNewEmail] = useState({ email: '', email_type: 'work' });
  const [newAddress, setNewAddress] = useState({ 
    address_type: 'business', address_line_1: '', address_line_2: '', 
    city: '', state: '', zip_code: '', country: 'USA' 
  });
  const [newOtherContact, setNewOtherContact] = useState({ contact_type: '', contact_value: '' });
  const [newConnection, setNewConnection] = useState({ 
    connected_name: '', connected_company: '', relationship_type: '', notes: '' 
  });
  const [newActivity, setNewActivity] = useState({ activity_type: 'note', title: '', content: '' });
  const [newTask, setNewTask] = useState({ 
    title: '', description: '', due_date: '', priority: 'medium', assigned_to: '' 
  });
  const [newTag, setNewTag] = useState('');

  // Reset form when lead changes
  useEffect(() => {
    if (lead && open) {
      setFormData({
        name: lead.name || '',
        known_as: lead.known_as || '',
        company_name: lead.company_name || '',
        title: lead.title || '',
        contact_type: lead.contact_type || 'potential_customer',
        tags: lead.tags || [],
        about: lead.about || '',
        notes: lead.notes || '',
        website: lead.website || '',
        linkedin: lead.linkedin || '',
        twitter: lead.twitter || '',
      });
      setActiveTab('contact');
      setEditMode(false);
    }
  }, [lead, open]);

  // Queries
  const { data: phones = [] } = useQuery({
    queryKey: ['lead-phones', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadPhone[];
    },
    enabled: !!lead && open,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ['lead-emails', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadEmail[];
    },
    enabled: !!lead && open,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['lead-addresses', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadAddress[];
    },
    enabled: !!lead && open,
  });

  const { data: otherContacts = [] } = useQuery({
    queryKey: ['lead-other-contacts', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_other_contacts').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadOtherContact[];
    },
    enabled: !!lead && open,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['lead-connections', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_connections').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadConnection[];
    },
    enabled: !!lead && open,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as LeadActivity[];
    },
    enabled: !!lead && open,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['lead-tasks', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_tasks').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as LeadTask[];
    },
    enabled: !!lead && open,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name').eq('is_active', true);
      return (data || []) as TeamMember[];
    },
    enabled: open,
  });

  const { data: communications = [] } = useQuery({
    queryKey: ['lead-communications', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('evan_communications').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as Communication[];
    },
    enabled: !!lead && open,
  });

  // Mutations
  const saveLead = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({
        name: formData.name,
        known_as: formData.known_as || null,
        company_name: formData.company_name || null,
        title: formData.title || null,
        contact_type: formData.contact_type,
        tags: formData.tags,
        about: formData.about || null,
        notes: formData.notes || null,
        website: formData.website || null,
        linkedin: formData.linkedin || null,
        twitter: formData.twitter || null,
      }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Lead updated' });
      setEditMode(false);
      onLeadUpdated?.();
    },
    onError: () => toast({ title: 'Error saving lead', variant: 'destructive' }),
  });

  const addPhone = useMutation({
    mutationFn: async () => {
      if (!lead || !newPhone.phone_number) return;
      const { error } = await supabase.from('lead_phones').insert({ 
        lead_id: lead.id, ...newPhone 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead?.id] });
      setNewPhone({ phone_number: '', phone_type: 'mobile' });
    },
  });

  const deletePhone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_phones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-phones', lead?.id] }),
  });

  const addEmail = useMutation({
    mutationFn: async () => {
      if (!lead || !newEmail.email) return;
      const { error } = await supabase.from('lead_emails').insert({ 
        lead_id: lead.id, ...newEmail 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] });
      setNewEmail({ email: '', email_type: 'work' });
    },
  });

  const deleteEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_emails').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] }),
  });

  const addAddress = useMutation({
    mutationFn: async () => {
      if (!lead || !newAddress.address_line_1) return;
      const { error } = await supabase.from('lead_addresses').insert({ 
        lead_id: lead.id, ...newAddress 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead?.id] });
      setNewAddress({ address_type: 'business', address_line_1: '', address_line_2: '', city: '', state: '', zip_code: '', country: 'USA' });
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_addresses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead?.id] }),
  });

  const addOtherContact = useMutation({
    mutationFn: async () => {
      if (!lead || !newOtherContact.contact_value) return;
      const { error } = await supabase.from('lead_other_contacts').insert({ 
        lead_id: lead.id, ...newOtherContact 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-other-contacts', lead?.id] });
      setNewOtherContact({ contact_type: '', contact_value: '' });
    },
  });

  const deleteOtherContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_other_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-other-contacts', lead?.id] }),
  });

  const addConnection = useMutation({
    mutationFn: async () => {
      if (!lead || !newConnection.connected_name) return;
      const { error } = await supabase.from('lead_connections').insert({ 
        lead_id: lead.id, ...newConnection 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-connections', lead?.id] });
      setNewConnection({ connected_name: '', connected_company: '', relationship_type: '', notes: '' });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-connections', lead?.id] }),
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      if (!lead || !newActivity.content) return;
      const { error } = await supabase.from('lead_activities').insert({ 
        lead_id: lead.id, 
        activity_type: newActivity.activity_type,
        title: newActivity.title || null,
        content: newActivity.content,
        created_by: 'User'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', lead?.id] });
      setNewActivity({ activity_type: 'note', title: '', content: '' });
      toast({ title: 'Activity logged' });
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!lead || !newTask.title) return;
      const { error } = await supabase.from('lead_tasks').insert({ 
        lead_id: lead.id, 
        title: newTask.title,
        description: newTask.description || null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        assigned_to: newTask.assigned_to || null,
        created_by: 'User'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead?.id] });
      setNewTask({ title: '', description: '', due_date: '', priority: 'medium', assigned_to: '' });
      toast({ title: 'Task created' });
    },
  });

  const toggleTaskStatus = useMutation({
    mutationFn: async (task: LeadTask) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase.from('lead_tasks').update({ 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead?.id] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead?.id] }),
  });

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'phone_call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Users className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {formData.name || lead.name}
                  {formData.known_as && <span className="text-muted-foreground font-normal"> ({formData.known_as})</span>}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={statusColors[lead.status] || 'bg-gray-100'}>{lead.status.replace('_', ' ')}</Badge>
                  {formData.contact_type && (
                    <Badge variant="outline">{contactTypes.find(c => c.value === formData.contact_type)?.label}</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => editMode ? saveLead.mutate() : setEditMode(true)}>
              {editMode ? (saveLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>) : <><Edit2 className="w-4 h-4 mr-1" /> Edit</>}
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 border-b">
            <TabsList className="h-12 bg-transparent p-0 gap-4">
              <TabsTrigger value="contact" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1">Contact</TabsTrigger>
              <TabsTrigger value="about" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1">About</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1">History ({activities.length + communications.length})</TabsTrigger>
              <TabsTrigger value="connections" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1">Connections ({connections.length})</TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1">Tasks ({tasks.length})</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(90vh-180px)]">
            {/* Contact Tab */}
            <TabsContent value="contact" className="p-6 m-0 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} disabled={!editMode} />
                </div>
                <div className="space-y-2">
                  <Label>Known As</Label>
                  <Input value={formData.known_as} onChange={e => setFormData(p => ({ ...p, known_as: e.target.value }))} disabled={!editMode} placeholder="Nickname" />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={formData.company_name} onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))} disabled={!editMode} />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} disabled={!editMode} placeholder="Job Title" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Type</Label>
                  <Select value={formData.contact_type} onValueChange={v => setFormData(p => ({ ...p, contact_type: v }))} disabled={!editMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {contactTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <Input value={teamMembers.find(t => t.id === lead.assigned_to)?.name || 'Unassigned'} disabled />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Tag className="w-4 h-4" /> Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {editMode && <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">×</button>}
                    </Badge>
                  ))}
                  {editMode && (
                    <div className="flex gap-1">
                      <Select value={newTag} onValueChange={setNewTag}>
                        <SelectTrigger className="w-[150px] h-7"><SelectValue placeholder="Add tag..." /></SelectTrigger>
                        <SelectContent>
                          {defaultTags.filter(t => !formData.tags.includes(t)).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={addTag} disabled={!newTag}><Plus className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Phone Numbers */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Phone Numbers</Label>
                {phones.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-16 justify-center">{p.phone_type}</Badge>
                    <span className="flex-1">{p.phone_number}</span>
                    {editMode && <Button size="icon" variant="ghost" onClick={() => deletePhone.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                ))}
                {/* Show legacy phone if no phones in new table */}
                {phones.length === 0 && lead.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="w-16 justify-center">primary</Badge>
                    <span>{lead.phone}</span>
                  </div>
                )}
                {editMode && (
                  <div className="flex gap-2">
                    <Select value={newPhone.phone_type} onValueChange={v => setNewPhone(p => ({ ...p, phone_type: v }))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Phone number" value={newPhone.phone_number} onChange={e => setNewPhone(p => ({ ...p, phone_number: e.target.value }))} className="flex-1" />
                    <Button size="icon" onClick={() => addPhone.mutate()}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              {/* Emails */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email Addresses</Label>
                {emails.map(e => (
                  <div key={e.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-16 justify-center">{e.email_type}</Badge>
                    <span className="flex-1">{e.email}</span>
                    {editMode && <Button size="icon" variant="ghost" onClick={() => deleteEmail.mutate(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                ))}
                {emails.length === 0 && lead.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="w-16 justify-center">primary</Badge>
                    <span>{lead.email}</span>
                  </div>
                )}
                {editMode && (
                  <div className="flex gap-2">
                    <Select value={newEmail.email_type} onValueChange={v => setNewEmail(p => ({ ...p, email_type: v }))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Email address" value={newEmail.email} onChange={e => setNewEmail(p => ({ ...p, email: e.target.value }))} className="flex-1" />
                    <Button size="icon" onClick={() => addEmail.mutate()}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              {/* Addresses */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Addresses</Label>
                {addresses.map(a => (
                  <Card key={a.id}>
                    <CardContent className="p-3 flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="mb-2">{a.address_type}</Badge>
                        <p className="text-sm">{a.address_line_1}</p>
                        {a.address_line_2 && <p className="text-sm">{a.address_line_2}</p>}
                        <p className="text-sm">{a.city}, {a.state} {a.zip_code}</p>
                      </div>
                      {editMode && <Button size="icon" variant="ghost" onClick={() => deleteAddress.mutate(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </CardContent>
                  </Card>
                ))}
                {editMode && (
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <Select value={newAddress.address_type} onValueChange={v => setNewAddress(p => ({ ...p, address_type: v }))}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Address Line 1" value={newAddress.address_line_1} onChange={e => setNewAddress(p => ({ ...p, address_line_1: e.target.value }))} className="flex-1" />
                      </div>
                      <Input placeholder="Address Line 2" value={newAddress.address_line_2} onChange={e => setNewAddress(p => ({ ...p, address_line_2: e.target.value }))} />
                      <div className="flex gap-2">
                        <Input placeholder="City" value={newAddress.city} onChange={e => setNewAddress(p => ({ ...p, city: e.target.value }))} className="flex-1" />
                        <Input placeholder="State" value={newAddress.state} onChange={e => setNewAddress(p => ({ ...p, state: e.target.value }))} className="w-20" />
                        <Input placeholder="ZIP" value={newAddress.zip_code} onChange={e => setNewAddress(p => ({ ...p, zip_code: e.target.value }))} className="w-24" />
                      </div>
                      <Button size="sm" onClick={() => addAddress.mutate()}><Plus className="w-4 h-4 mr-1" /> Add Address</Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Social & Web */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> Web & Social</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Website" value={formData.website} onChange={e => setFormData(p => ({ ...p, website: e.target.value }))} disabled={!editMode} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-muted-foreground" />
                    <Input placeholder="LinkedIn" value={formData.linkedin} onChange={e => setFormData(p => ({ ...p, linkedin: e.target.value }))} disabled={!editMode} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Twitter className="w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Twitter" value={formData.twitter} onChange={e => setFormData(p => ({ ...p, twitter: e.target.value }))} disabled={!editMode} />
                  </div>
                </div>
              </div>

              {/* Other Contacts */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Link2 className="w-4 h-4" /> Other Contact Methods</Label>
                {otherContacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-24 justify-center">{c.contact_type}</Badge>
                    <span className="flex-1">{c.contact_value}</span>
                    {editMode && <Button size="icon" variant="ghost" onClick={() => deleteOtherContact.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                ))}
                {editMode && (
                  <div className="flex gap-2">
                    <Input placeholder="Type (e.g., Skype)" value={newOtherContact.contact_type} onChange={e => setNewOtherContact(p => ({ ...p, contact_type: e.target.value }))} className="w-32" />
                    <Input placeholder="Value" value={newOtherContact.contact_value} onChange={e => setNewOtherContact(p => ({ ...p, contact_value: e.target.value }))} className="flex-1" />
                    <Button size="icon" onClick={() => addOtherContact.mutate()}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="p-6 m-0 space-y-6">
              <div className="space-y-2">
                <Label>About / Background</Label>
                <Textarea 
                  value={formData.about} 
                  onChange={e => setFormData(p => ({ ...p, about: e.target.value }))} 
                  disabled={!editMode}
                  placeholder="Background information about this contact..."
                  className="min-h-[150px]"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} 
                  disabled={!editMode}
                  placeholder="Additional notes..."
                  className="min-h-[150px]"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Timeline</Label>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><Calendar className="w-4 h-4 inline mr-2" />Created: {format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}</p>
                  <p><Clock className="w-4 h-4 inline mr-2" />Updated: {format(new Date(lead.updated_at), 'MMM d, yyyy h:mm a')}</p>
                  {lead.questionnaire_sent_at && <p><FileText className="w-4 h-4 inline mr-2" />Questionnaire Sent: {format(new Date(lead.questionnaire_sent_at), 'MMM d, yyyy')}</p>}
                  {lead.questionnaire_completed_at && <p><CheckCircle2 className="w-4 h-4 inline mr-2 text-green-600" />Questionnaire Completed: {format(new Date(lead.questionnaire_completed_at), 'MMM d, yyyy')}</p>}
                </div>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="p-6 m-0 space-y-6">
              {/* Log Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Log Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={newActivity.activity_type} onValueChange={v => setNewActivity(p => ({ ...p, activity_type: v }))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="phone_call">Phone Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Title (optional)" value={newActivity.title} onChange={e => setNewActivity(p => ({ ...p, title: e.target.value }))} className="flex-1" />
                  </div>
                  <Textarea placeholder="Details..." value={newActivity.content} onChange={e => setNewActivity(p => ({ ...p, content: e.target.value }))} />
                  <Button onClick={() => addActivity.mutate()} disabled={!newActivity.content}>
                    <Plus className="w-4 h-4 mr-1" /> Log Activity
                  </Button>
                </CardContent>
              </Card>

              <Separator />

              {/* Activity Timeline */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Activity History</h3>
                
                {/* Combined activities and communications */}
                {[...activities.map(a => ({ ...a, _type: 'activity' as const })), ...communications.map(c => ({ ...c, _type: 'communication' as const, activity_type: c.communication_type }))]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(item => (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {item._type === 'communication' ? (
                              item.direction === 'inbound' ? <PhoneIncoming className="w-4 h-4 text-green-600" /> : <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                            ) : getActivityIcon(item.activity_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">
                                {item._type === 'communication' 
                                  ? `${item.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`
                                  : (item as LeadActivity).title || item.activity_type.replace('_', ' ')}
                              </p>
                              <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                            {item._type === 'communication' && (item as Communication).duration_seconds && (
                              <p className="text-xs text-muted-foreground mt-1">Duration: {formatDuration((item as Communication).duration_seconds)}</p>
                            )}
                            {(item as LeadActivity).content && (
                              <p className="text-sm text-muted-foreground mt-1">{(item as LeadActivity).content}</p>
                            )}
                            {item._type === 'communication' && (item as Communication).transcript && (
                              <Collapsible open={expandedTranscripts[item.id]} onOpenChange={() => setExpandedTranscripts(p => ({ ...p, [item.id]: !p[item.id] }))}>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="mt-2">
                                    {expandedTranscripts[item.id] ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                    View Transcript
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-muted rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {(item as Communication).transcript}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {activities.length === 0 && communications.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No activity history yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections" className="p-6 m-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name" value={newConnection.connected_name} onChange={e => setNewConnection(p => ({ ...p, connected_name: e.target.value }))} />
                    <Input placeholder="Company" value={newConnection.connected_company} onChange={e => setNewConnection(p => ({ ...p, connected_company: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <Select value={newConnection.relationship_type} onValueChange={v => setNewConnection(p => ({ ...p, relationship_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Relationship type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="colleague">Colleague</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="referrer">Referrer</SelectItem>
                        <SelectItem value="attorney">Attorney</SelectItem>
                        <SelectItem value="cpa">CPA</SelectItem>
                        <SelectItem value="business_partner">Business Partner</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Notes" value={newConnection.notes} onChange={e => setNewConnection(p => ({ ...p, notes: e.target.value }))} className="flex-1" />
                  </div>
                  <Button onClick={() => addConnection.mutate()} disabled={!newConnection.connected_name}>
                    <Plus className="w-4 h-4 mr-1" /> Add Connection
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {connections.map(c => (
                  <Card key={c.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{c.connected_name}</p>
                          {c.connected_company && <p className="text-sm text-muted-foreground">{c.connected_company}</p>}
                          {c.relationship_type && <Badge variant="outline" className="mt-1">{c.relationship_type}</Badge>}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteConnection.mutate(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {connections.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No connections yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="p-6 m-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Create Task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Task title" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
                  <Textarea placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} />
                  <div className="flex gap-2">
                    <Input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} className="w-40" />
                    <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={newTask.assigned_to} onValueChange={v => setNewTask(p => ({ ...p, assigned_to: v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => addTask.mutate()} disabled={!newTask.title}>
                    <Plus className="w-4 h-4 mr-1" /> Create Task
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {tasks.map(t => (
                  <Card key={t.id} className={t.status === 'completed' ? 'opacity-60' : ''}>
                    <CardContent className="p-3 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleTaskStatus.mutate(t)} className="mt-0.5">
                          {t.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>
                        <div>
                          <p className={`font-medium ${t.status === 'completed' ? 'line-through' : ''}`}>{t.title}</p>
                          {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            {t.due_date && (
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="w-3 h-3 mr-1" />
                                {format(new Date(t.due_date), 'MMM d')}
                              </Badge>
                            )}
                            <Badge variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                              {t.priority}
                            </Badge>
                            {t.assigned_to && (
                              <Badge variant="outline" className="text-xs">
                                {teamMembers.find(m => m.id === t.assigned_to)?.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteTask.mutate(t.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No tasks yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
