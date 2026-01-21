import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Loader2, Plus, FileSpreadsheet, Trash2, Search, Phone, Mail, Check, X, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Badge } from '@/components/ui/badge';

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

interface Spreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface Sheet {
  id: number;
  title: string;
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
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState(false);
  const [newProgram, setNewProgram] = useState<NewProgram>(emptyProgram);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Google Sheets state
  const { 
    isConnected, 
    connectedEmail, 
    loading: sheetsLoading, 
    connect, 
    disconnect,
    listSpreadsheets,
    getSheets,
    getData 
  } = useGoogleSheets('admin');
  
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<Spreadsheet | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
  const [sheetData, setSheetData] = useState<string[][]>([]);
  const [parsedPrograms, setParsedPrograms] = useState<NewProgram[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [importing, setImporting] = useState(false);

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

  // Google Sheets handlers
  const handleOpenSheetsDialog = async () => {
    setSheetsDialogOpen(true);
    if (isConnected) {
      await handleLoadSpreadsheets();
    }
  };

  const handleLoadSpreadsheets = async () => {
    setLoadingSpreadsheets(true);
    const result = await listSpreadsheets();
    setSpreadsheets(result);
    setLoadingSpreadsheets(false);
  };

  const handleSelectSpreadsheet = async (spreadsheet: Spreadsheet) => {
    setSelectedSpreadsheet(spreadsheet);
    setSelectedSheet(null);
    setSheetData([]);
    setParsedPrograms([]);
    setLoadingSheets(true);
    const result = await getSheets(spreadsheet.id);
    setSheets(result);
    setLoadingSheets(false);
  };

  const handleSelectSheet = async (sheet: Sheet) => {
    setSelectedSheet(sheet);
    setLoadingData(true);
    const result = await getData(selectedSpreadsheet!.id, sheet.title);
    setSheetData(result);
    
    // Parse the data into programs
    if (result.length > 1) {
      const headers = result[0].map((h: string) => h?.toLowerCase()?.trim() || '');
      const programs: NewProgram[] = [];

      for (let i = 1; i < result.length; i++) {
        const row = result[i];
        const program: NewProgram = { ...emptyProgram };

        headers.forEach((header: string, idx: number) => {
          const value = row[idx]?.trim() || '';
          const h = header.toLowerCase();
          
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
          else if (h.includes('specialty')) program.lender_specialty = value;
          else if (h.includes('program') && h.includes('name')) program.program_name = value;
          else if (h.includes('program') && h.includes('type')) program.program_type = value;
          else if (h.includes('description')) program.description = value;
          else if (h.includes('min') && h.includes('loan')) program.min_loan = value;
          else if (h.includes('max') && h.includes('loan')) program.max_loan = value;
          else if (h.includes('interest') || h.includes('rate')) program.interest_range = value;
          else if (h.includes('term')) program.term = value;
        });

        if (program.lender_name) {
          if (!program.program_name) {
            program.program_name = program.loan_types ? `${program.loan_types}` : `Program #${i}`;
          }
          programs.push(program);
        }
      }

      setParsedPrograms(programs);
      toast.success(`Parsed ${programs.length} lenders from sheet`);
    }
    setLoadingData(false);
  };

  const handleImportPrograms = async () => {
    if (parsedPrograms.length === 0) {
      toast.error('No programs to import');
      return;
    }

    setImporting(true);
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

      toast.success(`Successfully imported ${parsedPrograms.length} lenders`);
      setSheetsDialogOpen(false);
      setSelectedSpreadsheet(null);
      setSelectedSheet(null);
      setSheetData([]);
      setParsedPrograms([]);
      fetchPrograms();
    } catch (error) {
      console.error('Error importing programs:', error);
      toast.error('Failed to import programs');
    } finally {
      setImporting(false);
    }
  };

  const resetSheetsSelection = () => {
    setSelectedSpreadsheet(null);
    setSelectedSheet(null);
    setSheetData([]);
    setParsedPrograms([]);
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
            <Button variant="outline" size="sm" className="gap-2 text-slate-600" onClick={handleOpenSheetsDialog}>
              <FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />
              {isConnected ? 'Import from Sheets' : 'Connect Google Sheets'}
            </Button>

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

        {/* Google Sheets Dialog */}
        <Dialog open={sheetsDialogOpen} onOpenChange={setSheetsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                Import from Google Sheets
              </DialogTitle>
              <DialogDescription>
                {isConnected 
                  ? `Connected as ${connectedEmail}. Select a spreadsheet to import lender data.`
                  : 'Connect your Google account to browse and import data from your spreadsheets.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4 space-y-4">
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <FileSpreadsheet className="w-16 h-16 text-slate-300" strokeWidth={1.5} />
                  <div className="text-center">
                    <h3 className="font-medium text-slate-900 mb-1">Connect Google Sheets</h3>
                    <p className="text-sm text-slate-500 max-w-sm">
                      Sign in with your Google account to browse and import lender data from your spreadsheets.
                    </p>
                  </div>
                  <Button onClick={connect} disabled={sheetsLoading} className="gap-2">
                    {sheetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    Connect Google Sheets
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connection status bar */}
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="w-4 h-4" />
                      Connected as <span className="font-medium">{connectedEmail}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={disconnect} className="text-green-700 hover:text-red-600 hover:bg-red-50 h-7 px-2">
                      <LogOut className="w-3.5 h-3.5 mr-1" />
                      Disconnect
                    </Button>
                  </div>

                  {/* Step 1: Select Spreadsheet */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900 text-sm">1. Select a Spreadsheet</h4>
                      {selectedSpreadsheet && (
                        <Button variant="ghost" size="sm" onClick={resetSheetsSelection} className="h-7 px-2 text-slate-500">
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                    
                    {!selectedSpreadsheet ? (
                      <div className="border border-slate-200 rounded-md">
                        {loadingSpreadsheets ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                          </div>
                        ) : spreadsheets.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-slate-500 text-sm mb-2">No spreadsheets found</p>
                            <Button variant="outline" size="sm" onClick={handleLoadSpreadsheets} className="gap-1">
                              <RefreshCw className="w-3.5 h-3.5" />
                              Refresh
                            </Button>
                          </div>
                        ) : (
                          <ScrollArea className="h-48">
                            <div className="divide-y divide-slate-100">
                              {spreadsheets.map((ss) => (
                                <button
                                  key={ss.id}
                                  onClick={() => handleSelectSpreadsheet(ss)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3"
                                >
                                  <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate text-sm">{ss.name}</p>
                                    <p className="text-xs text-slate-500">
                                      Modified {new Date(ss.modifiedTime).toLocaleDateString()}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-slate-900 text-sm">{selectedSpreadsheet.name}</span>
                        <Badge variant="secondary" className="ml-auto">Selected</Badge>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Select Sheet */}
                  {selectedSpreadsheet && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-slate-900 text-sm">2. Select a Sheet</h4>
                      
                      {!selectedSheet ? (
                        <div className="border border-slate-200 rounded-md">
                          {loadingSheets ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 p-3">
                              {sheets.map((sheet) => (
                                <Button
                                  key={sheet.id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSelectSheet(sheet)}
                                  className="gap-1"
                                >
                                  {sheet.title}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                          <span className="font-medium text-slate-900 text-sm">{selectedSheet.title}</span>
                          <Badge variant="secondary" className="ml-auto">Selected</Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Preview Data */}
                  {selectedSheet && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-slate-900 text-sm">3. Preview & Import</h4>
                      
                      {loadingData ? (
                        <div className="flex items-center justify-center py-8 border border-slate-200 rounded-md">
                          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                      ) : parsedPrograms.length > 0 ? (
                        <div className="border border-slate-200 rounded-md overflow-hidden">
                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                            <p className="text-sm text-slate-700">
                              <span className="font-medium">{parsedPrograms.length}</span> lenders ready to import
                            </p>
                          </div>
                          <ScrollArea className="h-40">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="text-left p-2 text-slate-600 font-medium">Institution</th>
                                  <th className="text-left p-2 text-slate-600 font-medium">Contact</th>
                                  <th className="text-left p-2 text-slate-600 font-medium">Type</th>
                                  <th className="text-left p-2 text-slate-600 font-medium">States</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedPrograms.slice(0, 10).map((p, i) => (
                                  <tr key={i} className="border-t border-slate-100">
                                    <td className="p-2 text-slate-700 truncate max-w-[150px]">{p.lender_name}</td>
                                    <td className="p-2 text-slate-600 truncate max-w-[120px]">{p.contact_name || p.email || '-'}</td>
                                    <td className="p-2 text-slate-600 truncate max-w-[100px]">{p.lender_type || '-'}</td>
                                    <td className="p-2 text-slate-600 truncate max-w-[100px]">{p.states || '-'}</td>
                                  </tr>
                                ))}
                                {parsedPrograms.length > 10 && (
                                  <tr className="border-t bg-slate-50">
                                    <td colSpan={4} className="p-2 text-center text-slate-500 text-xs">
                                      ... and {parsedPrograms.length - 10} more
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </ScrollArea>
                        </div>
                      ) : sheetData.length > 0 ? (
                        <div className="text-center py-6 border border-slate-200 rounded-md">
                          <p className="text-slate-500 text-sm">No lender data could be parsed from this sheet</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setSheetsDialogOpen(false)}>Cancel</Button>
              {isConnected && parsedPrograms.length > 0 && (
                <Button onClick={handleImportPrograms} disabled={importing} className="gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Import {parsedPrograms.length} Lenders
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                Start building your lending network by adding lenders one at a time or importing from Google Sheets.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleOpenSheetsDialog} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />
                  Import from Google Sheets
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
                      <TableHead className="w-[60px] font-semibold text-slate-700">Call</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Lender Type</TableHead>
                      <TableHead className="w-[150px] font-semibold text-slate-700">Loan Size</TableHead>
                      <TableHead className="w-[180px] font-semibold text-slate-700">Loan Types</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">States</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Location</TableHead>
                      <TableHead className="w-[140px] font-semibold text-slate-700">Contact</TableHead>
                      <TableHead className="w-[130px] font-semibold text-slate-700">Phone</TableHead>
                      <TableHead className="w-[180px] font-semibold text-slate-700">Email</TableHead>
                      <TableHead className="w-[200px] font-semibold text-slate-700">Looking For</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrograms.map((program) => (
                      <TableRow key={program.id} className="hover:bg-slate-50 group">
                        <TableCell className="font-medium text-slate-900">{program.lender_name}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                            program.call_status === 'Y' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {program.call_status || 'N'}
                          </span>
                        </TableCell>
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
