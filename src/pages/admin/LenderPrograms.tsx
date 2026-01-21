import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Loader2, Plus, Upload, FileText, X, Trash2, Search, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
  call_status: string | null;
  last_contact: string | null;
  next_call: string | null;
  location: string | null;
  looking_for: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  lender_type: string | null;
  loan_types: string | null;
  states: string | null;
  loan_size_text: string | null;
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
  loan_size_text: string;
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
  loan_size_text: '',
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
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newProgram, setNewProgram] = useState<NewProgram>(emptyProgram);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedPrograms, setParsedPrograms] = useState<NewProgram[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

      setAllPrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = allPrograms.filter(program => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      program.lender_name.toLowerCase().includes(query) ||
      program.program_name.toLowerCase().includes(query) ||
      program.loan_types?.toLowerCase().includes(query) ||
      program.states?.toLowerCase().includes(query) ||
      program.lender_type?.toLowerCase().includes(query)
    );
  });

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

  // Detect the best delimiter for CSV parsing
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    const delimiters = [',', '\t', ';', '|'];
    let bestDelimiter = ',';
    let maxCount = 0;
    
    for (const d of delimiters) {
      const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }
    return bestDelimiter;
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const delimiter = detectDelimiter(text);
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      console.log('Detected delimiter:', delimiter, 'Headers found:', headers);
      const programs: NewProgram[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/['"]/g, ''));
        const program: NewProgram = { ...emptyProgram };

        headers.forEach((header, idx) => {
          const value = values[idx] || '';
          const h = header.toLowerCase();
          
          // Map your CSV headers to our fields - with flexible matching
          if (h === 'institution' || (h.includes('lender') && h.includes('name'))) program.lender_name = value;
          else if (h === 'call y/n' || h === 'call' || h.includes('call y')) program.call_status = value || 'N';
          else if (h === 'last contact' || (h.includes('last') && h.includes('contact'))) program.last_contact = value;
          else if (h === 'location') program.location = value;
          else if (h === 'looking for' || h.includes('looking')) program.looking_for = value;
          else if (h === 'name' || h === 'contact name' || h === 'contact') program.contact_name = value;
          else if (h === 'phone' || h.includes('phone')) program.phone = value;
          else if (h === 'email' || h.includes('email')) program.email = value;
          else if (h === 'type of lender' || h === 'lender type' || h.includes('type of lender') || h.includes('lender type')) program.lender_type = value;
          else if (h === 'types of loans' || h === 'loan types' || h.includes('types of loan') || h.includes('loan type')) program.loan_types = value;
          else if (h === 'loan size' || h.includes('loan size') || h.includes('loansize') || h === 'size') {
            program.loan_size_text = value;
            program.min_loan = value;
            program.max_loan = value;
          }
          else if (h === 'states' || h.includes('state')) program.states = value;
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

        // Each row is a unique program - generate unique program name using row number
        if (program.lender_name) {
          if (!program.program_name) {
            // Create unique program name: use loan_types if available, otherwise "Program #rownum"
            program.program_name = program.loan_types 
              ? `${program.loan_types}` 
              : `Program #${i}`;
          }
          // Always add each row as a separate program entry
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
        last_contact: p.last_contact ? (() => {
          const d = new Date(p.last_contact);
          return isNaN(d.getTime()) ? null : d.toISOString();
        })() : null,
        next_call: p.next_call ? (() => {
          const d = new Date(p.next_call);
          return isNaN(d.getTime()) ? null : d.toISOString();
        })() : null,
        location: p.location || null,
        looking_for: p.looking_for || null,
        contact_name: p.contact_name || null,
        phone: p.phone || null,
        email: p.email || null,
        lender_type: p.lender_type || null,
        loan_types: p.loan_types || null,
        states: p.states || null,
        loan_size_text: p.loan_size_text || null,
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Lender Programs</h1>
            <p className="text-sm text-slate-500 mt-1">
              {allPrograms.length > 0 ? (
                <>Manage <span className="font-medium text-slate-700">{allPrograms.length} lender programs</span></>
              ) : (
                'Add lenders to start building your lending network'
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-slate-600">
                  <Upload className="w-4 h-4" strokeWidth={1.5} />
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
                  <div className="border-2 border-dashed border-slate-200 rounded-md p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.pdf,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {!uploadedFile ? (
                      <div className="space-y-3">
                        <FileText className="w-10 h-10 text-slate-400 mx-auto" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm text-slate-500 mb-2">Drag and drop or</p>
                          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            Choose File
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">Supports CSV files</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-8 h-8 text-slate-600 flex-shrink-0" strokeWidth={1.5} />
                        <div className="text-left min-w-0">
                          <p className="font-medium text-slate-900 truncate">{uploadedFile.name}</p>
                          <p className="text-sm text-slate-500">
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
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <div className="max-h-48 overflow-auto">
                        <table className="w-full text-sm table-fixed">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="text-left p-2 w-1/4 text-slate-600 font-medium">Institution</th>
                              <th className="text-left p-2 w-1/4 text-slate-600 font-medium">Contact</th>
                              <th className="text-left p-2 w-1/4 text-slate-600 font-medium">Type</th>
                              <th className="text-left p-2 w-1/4 text-slate-600 font-medium">States</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedPrograms.slice(0, 15).map((p, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="p-2 truncate text-slate-700" title={p.lender_name}>{p.lender_name}</td>
                                <td className="p-2 truncate text-slate-600" title={p.contact_name || p.email || '-'}>{p.contact_name || p.email || '-'}</td>
                                <td className="p-2 truncate text-slate-600" title={p.lender_type || p.program_type || '-'}>{p.lender_type || p.program_type || '-'}</td>
                                <td className="p-2 truncate text-slate-600" title={p.states || '-'}>{p.states || '-'}</td>
                              </tr>
                            ))}
                            {parsedPrograms.length > 15 && (
                              <tr className="border-t bg-slate-50">
                                <td colSpan={4} className="p-2 text-center text-slate-500 text-xs">
                                  ... and {parsedPrograms.length - 15} more lenders
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-md p-3">
                    <h4 className="font-medium text-xs text-slate-700 mb-1">Supported CSV columns:</h4>
                    <p className="text-xs text-slate-500">
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
                <Button size="sm" className="gap-2 bg-slate-900 hover:bg-slate-800">
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.5} />
          <Input
            placeholder="Search lenders, loan types, states..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>

        {allPrograms.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="py-16 text-center">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Lenders Yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Start building your lending network by adding lenders one at a time or uploading a CSV file with all your lender programs.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="gap-2">
                  <Upload className="w-4 h-4" strokeWidth={1.5} />
                  Bulk Upload CSV
                </Button>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2 bg-slate-900 hover:bg-slate-800">
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Add First Lender
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <ScrollArea className="w-full">
              <div className="min-w-[1400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-[200px] font-semibold text-slate-700">Institution</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Lender Type</TableHead>
                      <TableHead className="w-[150px] font-semibold text-slate-700">Loan Size</TableHead>
                      <TableHead className="w-[180px] font-semibold text-slate-700">Loan Types</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">States</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Location</TableHead>
                      <TableHead className="w-[140px] font-semibold text-slate-700">Contact</TableHead>
                      <TableHead className="w-[130px] font-semibold text-slate-700">Phone</TableHead>
                      <TableHead className="w-[180px] font-semibold text-slate-700">Email</TableHead>
                      <TableHead className="w-[200px] font-semibold text-slate-700">Looking For</TableHead>
                      <TableHead className="w-[60px] font-semibold text-slate-700">Call</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrograms.map((program) => (
                      <TableRow key={program.id} className="hover:bg-slate-50 group">
                        <TableCell className="font-medium text-slate-900">{program.lender_name}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{program.lender_type || '-'}</TableCell>
                        <TableCell className="text-slate-700 font-medium text-sm">{program.loan_size_text || '-'}</TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-[180px] truncate" title={program.loan_types || ''}>
                          {program.loan_types || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-[120px] truncate" title={program.states || ''}>
                          {program.states || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">{program.location || '-'}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{program.contact_name || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {program.phone ? (
                            <a href={`tel:${program.phone}`} className="text-slate-600 hover:text-slate-900 flex items-center gap-1">
                              <Phone className="w-3 h-3" strokeWidth={1.5} />
                              {program.phone}
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {program.email ? (
                            <a href={`mailto:${program.email}`} className="text-slate-600 hover:text-slate-900 flex items-center gap-1">
                              <Mail className="w-3 h-3" strokeWidth={1.5} />
                              <span className="truncate">{program.email}</span>
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-[200px] truncate" title={program.looking_for || ''}>
                          {program.looking_for || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                            program.call_status === 'Y' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {program.call_status || 'N'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteProgram(program.id)}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {filteredPrograms.length === 0 && allPrograms.length > 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-slate-500">No lenders match your search</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
