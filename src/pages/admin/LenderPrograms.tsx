import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, DollarSign, Percent, Clock, ChevronDown, ChevronUp, Loader2, Plus, Upload, FileText, X, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Program {
  id: string;
  lender_name: string;
  lender_specialty: string | null;
  program_name: string;
  program_type: string;
  description: string | null;
  min_loan: number | null;
  max_loan: number | null;
  interest_range: string | null;
  term: string | null;
}

interface GroupedLender {
  name: string;
  specialty: string;
  programs: Program[];
}

interface NewProgram {
  lender_name: string;
  lender_specialty: string;
  program_name: string;
  program_type: string;
  description: string;
  min_loan: string;
  max_loan: string;
  interest_range: string;
  term: string;
  // New fields from user's format
  call_status: string;
  last_contact: string;
  next_call: string;
  location: string;
  looking_for: string;
  contact_name: string;
  phone: string;
  email: string;
  lender_type: string;
  loan_types: string;
  states: string;
}

const emptyProgram: NewProgram = {
  lender_name: '',
  lender_specialty: '',
  program_name: '',
  program_type: '',
  description: '',
  min_loan: '',
  max_loan: '',
  interest_range: '',
  term: '',
  call_status: 'N',
  last_contact: '',
  next_call: '',
  location: '',
  looking_for: '',
  contact_name: '',
  phone: '',
  email: '',
  lender_type: '',
  loan_types: '',
  states: '',
};

const formatCurrency = (amount: number | null) => {
  if (!amount) return 'N/A';
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(0)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
};

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'SBA':
      return 'bg-admin-blue text-white border-0';
    case 'Conventional':
      return 'bg-admin-teal text-white border-0';
    case 'Bridge':
      return 'bg-admin-orange text-white border-0';
    case 'Construction':
      return 'bg-gradient-to-r from-admin-orange to-admin-orange-dark text-white border-0';
    case 'CMBS':
      return 'bg-admin-blue-dark text-white border-0';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const parseCurrencyValue = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/[$,\s]/g, '').toLowerCase();
  const multipliers: Record<string, number> = { k: 1000, m: 1000000, b: 1000000000 };
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/);
  if (match) {
    const num = parseFloat(match[1]);
    const mult = match[2] ? multipliers[match[2]] : 1;
    return num * mult;
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

const LenderPrograms = () => {
  const [expandedLenders, setExpandedLenders] = useState<Record<string, boolean>>({});
  const [lenders, setLenders] = useState<GroupedLender[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newProgram, setNewProgram] = useState<NewProgram>(emptyProgram);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedPrograms, setParsedPrograms] = useState<NewProgram[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('lender_name', { ascending: true })
        .order('program_name', { ascending: true });

      if (error) throw error;

      const grouped = (data || []).reduce((acc: Record<string, GroupedLender>, program) => {
        if (!acc[program.lender_name]) {
          acc[program.lender_name] = {
            name: program.lender_name,
            specialty: program.lender_specialty || '',
            programs: [],
          };
        }
        acc[program.lender_name].programs.push(program);
        return acc;
      }, {});

      setLenders(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLender = (lenderName: string) => {
    setExpandedLenders((prev) => ({
      ...prev,
      [lenderName]: !prev[lenderName],
    }));
  };

  const handleAddProgram = async () => {
    if (!newProgram.lender_name || !newProgram.program_name) {
      toast.error('Lender name and program name are required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('lender_programs').insert({
        lender_name: newProgram.lender_name,
        lender_specialty: newProgram.lender_specialty || null,
        program_name: newProgram.program_name,
        program_type: newProgram.program_type,
        description: newProgram.description || null,
        min_loan: parseCurrencyValue(newProgram.min_loan),
        max_loan: parseCurrencyValue(newProgram.max_loan),
        interest_range: newProgram.interest_range || null,
        term: newProgram.term || null,
      });

      if (error) throw error;

      toast.success('Program added successfully');
      setNewProgram(emptyProgram);
      setAddDialogOpen(false);
      fetchPrograms();
    } catch (error) {
      console.error('Error adding program:', error);
      toast.error('Failed to add program');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/csv', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV or PDF file');
      return;
    }

    setUploadedFile(file);
    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
      parseCSV(file);
    } else {
      toast.info('PDF parsing will extract lender data. Make sure the PDF contains structured lender information.');
      setParsedPrograms([]);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const programs: NewProgram[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        const program: NewProgram = { ...emptyProgram };

        headers.forEach((header, idx) => {
          const value = values[idx] || '';
          const h = header.toLowerCase();
          
          // Map your CSV headers to our fields
          if (h === 'institution' || (h.includes('lender') && h.includes('name'))) program.lender_name = value;
          else if (h === 'call y/n' || h === 'call') program.call_status = value || 'N';
          else if (h === 'last contact') program.last_contact = value;
          else if (h === 'next call') program.next_call = value;
          else if (h === 'location') program.location = value;
          else if (h === 'looking for') program.looking_for = value;
          else if (h === 'name' || h === 'contact name') program.contact_name = value;
          else if (h === 'phone') program.phone = value;
          else if (h === 'email') program.email = value;
          else if (h === 'type of lender' || h === 'lender type') program.lender_type = value;
          else if (h === 'types of loans' || h === 'loan types') program.loan_types = value;
          else if (h === 'loan size') {
            // Parse loan size into min/max if it contains a range
            program.min_loan = value;
            program.max_loan = value;
          }
          else if (h === 'states') program.states = value;
          // Legacy field mappings
          else if (h.includes('specialty')) program.lender_specialty = value;
          else if (h.includes('program') && h.includes('name')) program.program_name = value;
          else if (h.includes('program') && h.includes('type')) program.program_type = value;
          else if (h.includes('description')) program.description = value;
          else if (h.includes('min') && h.includes('loan')) program.min_loan = value;
          else if (h.includes('max') && h.includes('loan')) program.max_loan = value;
          else if (h.includes('interest') || h.includes('rate')) program.interest_range = value;
          else if (h.includes('term')) program.term = value;
        });

        // For your format, use Institution as lender_name and generate program_name from loan types
        if (program.lender_name) {
          if (!program.program_name) {
            program.program_name = program.loan_types || 'General Lending';
          }
          programs.push(program);
        }
      }

      setParsedPrograms(programs);
      toast.success(`Parsed ${programs.length} programs from CSV`);
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedPrograms.length === 0) {
      toast.error('No programs to upload');
      return;
    }

    setUploading(true);
    try {
      const insertData = parsedPrograms.map(p => ({
        lender_name: p.lender_name,
        lender_specialty: p.lender_specialty || null,
        program_name: p.program_name,
        program_type: p.program_type || p.lender_type || 'Other',
        description: p.description || null,
        min_loan: parseCurrencyValue(p.min_loan),
        max_loan: parseCurrencyValue(p.max_loan),
        interest_range: p.interest_range || null,
        term: p.term || null,
        // New fields
        call_status: p.call_status || 'N',
        last_contact: p.last_contact ? new Date(p.last_contact).toISOString() : null,
        next_call: p.next_call ? new Date(p.next_call).toISOString() : null,
        location: p.location || null,
        looking_for: p.looking_for || null,
        contact_name: p.contact_name || null,
        phone: p.phone || null,
        email: p.email || null,
        lender_type: p.lender_type || null,
        loan_types: p.loan_types || null,
        states: p.states || null,
      }));

      const { error } = await supabase.from('lender_programs').insert(insertData);

      if (error) throw error;

      toast.success(`Successfully uploaded ${parsedPrograms.length} programs`);
      setUploadDialogOpen(false);
      setUploadedFile(null);
      setParsedPrograms([]);
      fetchPrograms();
    } catch (error) {
      console.error('Error uploading programs:', error);
      toast.error('Failed to upload programs');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    try {
      const { error } = await supabase.from('lender_programs').delete().eq('id', programId);
      if (error) throw error;
      toast.success('Program deleted');
      fetchPrograms();
    } catch (error) {
      console.error('Error deleting program:', error);
      toast.error('Failed to delete program');
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setParsedPrograms([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-admin-blue-dark">Lender Programs</h1>
            <p className="text-muted-foreground mt-1">
              {lenders.length > 0 ? (
                <>Browse lending programs from our network of <span className="font-semibold text-admin-orange">{lenders.length} lenders</span></>
              ) : (
                'Add lenders to start building your lending network'
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Bulk Upload Lender Programs</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with your lender data.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 flex-1 overflow-auto">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.pdf,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {!uploadedFile ? (
                      <div className="space-y-3">
                        <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Drag and drop or</p>
                          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            Choose File
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Supports CSV files</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-8 h-8 text-admin-blue flex-shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="font-medium truncate">{uploadedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {parsedPrograms.length} lenders parsed
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearUpload} className="flex-shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {parsedPrograms.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-48 overflow-auto">
                        <table className="w-full text-sm table-fixed">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="text-left p-2 w-1/4">Institution</th>
                              <th className="text-left p-2 w-1/4">Contact</th>
                              <th className="text-left p-2 w-1/4">Type</th>
                              <th className="text-left p-2 w-1/4">States</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedPrograms.slice(0, 15).map((p, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2 truncate" title={p.lender_name}>{p.lender_name}</td>
                                <td className="p-2 truncate" title={p.contact_name || p.email || '-'}>{p.contact_name || p.email || '-'}</td>
                                <td className="p-2 truncate" title={p.lender_type || p.program_type || '-'}>{p.lender_type || p.program_type || '-'}</td>
                                <td className="p-2 truncate" title={p.states || '-'}>{p.states || '-'}</td>
                              </tr>
                            ))}
                            {parsedPrograms.length > 15 && (
                              <tr className="border-t bg-muted/30">
                                <td colSpan={4} className="p-2 text-center text-muted-foreground text-xs">
                                  ... and {parsedPrograms.length - 15} more lenders
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="font-medium text-xs mb-1">Supported CSV columns:</h4>
                    <p className="text-xs text-muted-foreground">
                      Institution, Call Y/N, Last Contact, Next Call, Location, Looking For, NAME, PHONE, EMAIL, TYPE OF LENDER, TYPES OF LOANS, Loan Size, States
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleBulkUpload} disabled={uploading || parsedPrograms.length === 0}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload {parsedPrograms.length} Lenders
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-admin-blue hover:bg-admin-blue-dark">
                  <Plus className="w-4 h-4" />
                  Add Lender
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Lender Program</DialogTitle>
                  <DialogDescription>Add a new lender program to your network.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lender_name">Lender Name *</Label>
                      <Input
                        id="lender_name"
                        value={newProgram.lender_name}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, lender_name: e.target.value }))}
                        placeholder="First National Bank"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lender_specialty">Specialty</Label>
                      <Input
                        id="lender_specialty"
                        value={newProgram.lender_specialty}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, lender_specialty: e.target.value }))}
                        placeholder="Commercial Real Estate"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="program_name">Program Name *</Label>
                      <Input
                        id="program_name"
                        value={newProgram.program_name}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, program_name: e.target.value }))}
                        placeholder="CRE Term Loan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="program_type">Program Type</Label>
                      <Select
                        value={newProgram.program_type}
                        onValueChange={(value) => setNewProgram(prev => ({ ...prev, program_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Conventional">Conventional</SelectItem>
                          <SelectItem value="SBA">SBA</SelectItem>
                          <SelectItem value="Bridge">Bridge</SelectItem>
                          <SelectItem value="Construction">Construction</SelectItem>
                          <SelectItem value="CMBS">CMBS</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProgram.description}
                      onChange={(e) => setNewProgram(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the lending program..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_loan">Min Loan</Label>
                      <Input
                        id="min_loan"
                        value={newProgram.min_loan}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, min_loan: e.target.value }))}
                        placeholder="500K or 500000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_loan">Max Loan</Label>
                      <Input
                        id="max_loan"
                        value={newProgram.max_loan}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, max_loan: e.target.value }))}
                        placeholder="10M or 10000000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="interest_range">Interest Rate</Label>
                      <Input
                        id="interest_range"
                        value={newProgram.interest_range}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, interest_range: e.target.value }))}
                        placeholder="6.5% - 8%"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term">Term</Label>
                      <Input
                        id="term"
                        value={newProgram.term}
                        onChange={(e) => setNewProgram(prev => ({ ...prev, term: e.target.value }))}
                        placeholder="5-25 years"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddProgram} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Program
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {lenders.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Lenders Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start building your lending network by adding lenders one at a time or uploading a CSV file with all your lender programs.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Bulk Upload CSV
                </Button>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2 bg-admin-blue hover:bg-admin-blue-dark">
                  <Plus className="w-4 h-4" />
                  Add First Lender
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {lenders.map((lender) => (
              <Collapsible
                key={lender.name}
                open={expandedLenders[lender.name]}
                onOpenChange={() => toggleLender(lender.name)}
              >
                <Card className="overflow-hidden border-admin-blue/10 border-2 hover:border-admin-blue/30 transition-all">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-admin-blue-light/30 transition-colors py-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-admin-blue to-admin-blue-dark flex items-center justify-center shadow-md">
                            <Building2 className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <CardTitle className="text-lg text-admin-blue-dark">{lender.name}</CardTitle>
                            <CardDescription>{lender.specialty}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-admin-orange text-white border-0">{lender.programs.length} Programs</Badge>
                          {expandedLenders[lender.name] ? (
                            <ChevronUp className="w-5 h-5 text-admin-blue" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-5">
                      <div className="space-y-4">
                        {lender.programs.map((program) => (
                          <div
                            key={program.id}
                            className="p-5 rounded-xl border border-admin-blue/10 bg-gradient-to-r from-admin-blue-light/30 to-transparent hover:from-admin-blue-light/50 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-admin-blue-dark text-base">{program.program_name}</h4>
                                  <Badge className={`text-xs ${getTypeBadgeClass(program.program_type)}`}>
                                    {program.program_type}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">{program.description}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProgram(program.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-admin-blue/10">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-admin-teal-light">
                                  <DollarSign className="w-4 h-4 text-admin-teal" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Loan Range</p>
                                  <p className="text-sm font-medium text-admin-teal">
                                    {formatCurrency(program.min_loan)} - {formatCurrency(program.max_loan)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-admin-blue-light">
                                  <Percent className="w-4 h-4 text-admin-blue" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Interest Rate</p>
                                  <p className="text-sm font-medium text-admin-blue">{program.interest_range || 'N/A'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-admin-orange-light">
                                  <Clock className="w-4 h-4 text-admin-orange" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Term</p>
                                  <p className="text-sm font-medium text-admin-orange">{program.term || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
