import { useEffect, useState, useCallback, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Loader2, Save, Trash2, Search, Plus, Upload, Filter, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LenderProgramAssistant } from '@/components/admin/LenderProgramAssistant';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

interface LenderRow {
  id: string;
  rowNum: number;
  lender_name: string;
  call_status: string;
  lender_type: string;
  loan_size_text: string;
  loan_types: string;
  states: string;
  location: string;
  contact_name: string;
  phone: string;
  email: string;
  looking_for: string;
  last_contact: string;
  next_call: string;
  isNew?: boolean;
  isDirty?: boolean;
  [key: string]: string | number | boolean | undefined;
}

const COLUMNS = [
  { key: 'rowNum', label: '#', width: 55, editable: false },
  { key: 'lender_name', label: 'Institution', width: 200, editable: true },
  { key: 'call_status', label: 'Call Y/N', width: 80, editable: true },
  { key: 'last_contact', label: 'Last Contact', width: 110, editable: true },
  { key: 'location', label: 'Location', width: 140, editable: true },
  { key: 'looking_for', label: 'Looking For', width: 500, editable: true },
  { key: 'contact_name', label: 'NAME', width: 150, editable: true },
  { key: 'phone', label: 'PHONE', width: 140, editable: true },
  { key: 'email', label: 'EMAIL', width: 200, editable: true },
  { key: 'lender_type', label: 'TYPE OF LENDER', width: 150, editable: true },
  { key: 'loan_types', label: 'TYPES OF LOANS', width: 180, editable: true },
  { key: 'loan_size_text', label: 'Loan Size', width: 140, editable: true },
  { key: 'states', label: 'States', width: 120, editable: true },
];

const createEmptyRow = (rowNum: number): LenderRow => ({
  id: `new-${rowNum}-${Date.now()}`,
  rowNum,
  lender_name: '',
  call_status: '',
  lender_type: '',
  loan_size_text: '',
  loan_types: '',
  states: '',
  location: '',
  contact_name: '',
  phone: '',
  email: '',
  looking_for: '',
  last_contact: '',
  next_call: '',
  isNew: true,
  isDirty: false,
});

const LenderPrograms = () => {
  const [rows, setRows] = useState<LenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({
    lenderType: '',
    states: '',
    callStatus: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map database rows to our format
      const dbRows: LenderRow[] = (data || []).map((item, idx) => ({
        id: item.id,
        rowNum: idx + 1,
        lender_name: item.lender_name || '',
        call_status: item.call_status || '',
        lender_type: item.lender_type || '',
        loan_size_text: item.loan_size_text || '',
        loan_types: item.loan_types || '',
        states: item.states || '',
        location: item.location || '',
        contact_name: item.contact_name || '',
        phone: item.phone || '',
        email: item.email || '',
        looking_for: item.looking_for || '',
        last_contact: item.last_contact ? new Date(item.last_contact).toLocaleDateString() : '',
        next_call: item.next_call ? new Date(item.next_call).toLocaleDateString() : '',
        isNew: false,
        isDirty: false,
      }));

      // Fill up to 900 rows
      const totalRows = 900;
      const emptyRows: LenderRow[] = [];
      for (let i = dbRows.length; i < totalRows; i++) {
        emptyRows.push(createEmptyRow(i + 1));
      }

      setRows([...dbRows, ...emptyRows]);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast.error('Failed to load lender programs');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = rows.filter(row => {
    // Text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        row.lender_name.toLowerCase().includes(query) ||
        row.loan_types?.toLowerCase().includes(query) ||
        row.states?.toLowerCase().includes(query) ||
        row.lender_type?.toLowerCase().includes(query) ||
        row.contact_name?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    // Dropdown filters
    if (filters.lenderType && row.lender_type?.toLowerCase() !== filters.lenderType.toLowerCase()) {
      return false;
    }
    if (filters.states && !row.states?.toLowerCase().includes(filters.states.toLowerCase())) {
      return false;
    }
    if (filters.callStatus && row.call_status?.toLowerCase() !== filters.callStatus.toLowerCase()) {
      return false;
    }
    
    return true;
  });

  // Get unique values for filter dropdowns
  const uniqueLenderTypes = [...new Set(rows.filter(r => r.lender_type).map(r => r.lender_type))].sort();
  const uniqueStates = [...new Set(rows.filter(r => r.states).flatMap(r => r.states.split(/[,\s]+/).filter(Boolean)))].sort();

  const clearFilters = () => {
    setFilters({ lenderType: '', states: '', callStatus: '' });
  };

  const hasActiveFilters = filters.lenderType || filters.states || filters.callStatus;

  const handleCellClick = (rowId: string, colKey: string) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;

    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    setEditingCell({ rowId, colKey });
    setEditValue(row[colKey] as string || '');
  };

  const handleCellBlur = () => {
    if (!editingCell) return;

    const { rowId, colKey } = editingCell;
    
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      
      const currentValue = row[colKey] as string || '';
      if (currentValue === editValue) return row;
      
      return {
        ...row,
        [colKey]: editValue,
        isDirty: true,
      };
    }));

    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleSaveAll = async () => {
    const dirtyRows = rows.filter(r => r.isDirty && r.lender_name.trim());
    
    if (dirtyRows.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Separate new rows from existing rows
      const newRows = dirtyRows.filter(r => r.isNew);
      const existingRows = dirtyRows.filter(r => !r.isNew);

      // Insert new rows
      if (newRows.length > 0) {
        const insertData = newRows.map(r => ({
          lender_name: r.lender_name,
          call_status: r.call_status || 'N',
          lender_type: r.lender_type || null,
          loan_size_text: r.loan_size_text || null,
          loan_types: r.loan_types || null,
          states: r.states || null,
          location: r.location || null,
          contact_name: r.contact_name || null,
          phone: r.phone || null,
          email: r.email || null,
          looking_for: r.looking_for || null,
          last_contact: r.last_contact ? (() => {
            const d = new Date(r.last_contact);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          next_call: r.next_call ? (() => {
            const d = new Date(r.next_call);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          program_name: r.loan_types || 'General',
          program_type: r.lender_type || 'Other',
        }));

        const { error } = await supabase.from('lender_programs').insert(insertData);
        if (error) throw error;
      }

      // Update existing rows
      for (const row of existingRows) {
        const { error } = await supabase
          .from('lender_programs')
          .update({
            lender_name: row.lender_name,
            call_status: row.call_status || 'N',
            lender_type: row.lender_type || null,
            loan_size_text: row.loan_size_text || null,
            loan_types: row.loan_types || null,
            states: row.states || null,
            location: row.location || null,
            contact_name: row.contact_name || null,
            phone: row.phone || null,
            email: row.email || null,
            looking_for: row.looking_for || null,
            last_contact: row.last_contact ? (() => {
              const d = new Date(row.last_contact);
              return isNaN(d.getTime()) ? null : d.toISOString();
            })() : null,
            next_call: row.next_call ? (() => {
              const d = new Date(row.next_call);
              return isNaN(d.getTime()) ? null : d.toISOString();
            })() : null,
          })
          .eq('id', row.id);
        
        if (error) throw error;
      }

      toast.success(`Saved ${dirtyRows.length} row${dirtyRows.length > 1 ? 's' : ''}`);
      fetchPrograms(); // Refresh to get new IDs
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (row: LenderRow) => {
    if (row.isNew) {
      // Just clear the row data for new rows
      setRows(prev => prev.map(r => 
        r.id === row.id ? createEmptyRow(row.rowNum) : r
      ));
      return;
    }

    try {
      const { error } = await supabase.from('lender_programs').delete().eq('id', row.id);
      if (error) throw error;
      toast.success('Row deleted');
      fetchPrograms();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete row');
    }
  };

  // File Upload handler (CSV and Excel)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || 
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel';

    if (!isCSV && !isExcel) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    if (isExcel) {
      parseAndUploadExcel(file);
    } else {
      parseAndUploadCSV(file);
    }
  };

  // Parse Excel files
  const parseAndUploadExcel = async (file: File) => {
    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON array (as array of arrays)
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          toast.error('Excel file must have a header row and at least one data row');
          setUploading(false);
          return;
        }

        const headers = (jsonData[0] || []).map(h => (h || '').toString().trim().toLowerCase());
        console.log('Excel Headers:', headers);
        
        const programs = parseRowsToPrograms(headers, jsonData.slice(1));

        if (programs.length === 0) {
          toast.error('No valid lender data found in Excel file');
          setUploading(false);
          return;
        }

        // Insert into database
        const { error } = await supabase.from('lender_programs').insert(programs);
        
        if (error) throw error;

        toast.success(`Imported ${programs.length} lenders from Excel`);
        fetchPrograms();
      } catch (error) {
        console.error('Error parsing/uploading Excel:', error);
        toast.error('Failed to import Excel file');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Shared row parsing logic
  const parseRowsToPrograms = (headers: string[], rows: string[][]) => {
    const programs: Array<{
      lender_name: string;
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
      loan_size_text: string | null;
      states: string | null;
      program_name: string;
      program_type: string;
    }> = [];

    for (const row of rows) {
      let lender_name = '';
      let call_status = '';
      let last_contact = '';
      let next_call = '';
      let location = '';
      let looking_for = '';
      let contact_name = '';
      let phone = '';
      let email = '';
      let lender_type = '';
      let loan_types = '';
      let loan_size_text = '';
      let states = '';

      headers.forEach((header, idx) => {
        const value = (row[idx] || '').toString().trim();
        const h = header.toLowerCase();
        
        if (h === 'institution' || (h.includes('lender') && h.includes('name'))) lender_name = value;
        else if (h === 'call y/n' || h === 'call' || h.includes('call')) call_status = value || 'N';
        else if (h === 'last contact' || (h.includes('last') && h.includes('contact'))) last_contact = value;
        else if (h === 'next call' || (h.includes('next') && h.includes('call'))) next_call = value;
        else if (h === 'location') location = value;
        else if (h === 'looking for' || h.includes('looking')) looking_for = value;
        else if (h === 'name' || h === 'contact name' || h === 'contact') contact_name = value;
        else if (h === 'phone' || h.includes('phone')) phone = value;
        else if (h === 'email' || h.includes('email')) email = value;
        else if (h === 'type of lender' || h === 'lender type' || h.includes('type of lender') || h.includes('lender type')) lender_type = value;
        else if (h === 'types of loans' || h === 'loan types' || h.includes('types of loan') || h.includes('loan type')) loan_types = value;
        else if (h === 'loan size' || h.includes('loan size') || h.includes('loansize') || h === 'size') loan_size_text = value;
        else if (h === 'states' || h.includes('state')) states = value;
      });

      if (lender_name) {
        programs.push({
          lender_name,
          call_status: call_status || 'N',
          last_contact: last_contact ? (() => {
            const d = new Date(last_contact);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          next_call: next_call ? (() => {
            const d = new Date(next_call);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          location: location || null,
          looking_for: looking_for || null,
          contact_name: contact_name || null,
          phone: phone || null,
          email: email || null,
          lender_type: lender_type || null,
          loan_types: loan_types || null,
          loan_size_text: loan_size_text || null,
          states: states || null,
          program_name: loan_types || 'General',
          program_type: lender_type || 'Other',
        });
      }
    }

    return programs;
  };

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

  const parseAndUploadCSV = async (file: File) => {
    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const delimiter = detectDelimiter(text);
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV file must have a header row and at least one data row');
          setUploading(false);
          return;
        }

        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        console.log('CSV Headers:', headers);
        
        const programs: Array<{
          lender_name: string;
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
          loan_size_text: string | null;
          states: string | null;
          program_name: string;
          program_type: string;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/['"]/g, ''));
          
          let lender_name = '';
          let call_status = '';
          let last_contact = '';
          let next_call = '';
          let location = '';
          let looking_for = '';
          let contact_name = '';
          let phone = '';
          let email = '';
          let lender_type = '';
          let loan_types = '';
          let loan_size_text = '';
          let states = '';

          headers.forEach((header, idx) => {
            const value = values[idx] || '';
            const h = header.toLowerCase();
            
            if (h === 'institution' || (h.includes('lender') && h.includes('name'))) lender_name = value;
            else if (h === 'call y/n' || h === 'call' || h.includes('call')) call_status = value || 'N';
            else if (h === 'last contact' || (h.includes('last') && h.includes('contact'))) last_contact = value;
            else if (h === 'next call' || (h.includes('next') && h.includes('call'))) next_call = value;
            else if (h === 'location') location = value;
            else if (h === 'looking for' || h.includes('looking')) looking_for = value;
            else if (h === 'name' || h === 'contact name' || h === 'contact') contact_name = value;
            else if (h === 'phone' || h.includes('phone')) phone = value;
            else if (h === 'email' || h.includes('email')) email = value;
            else if (h === 'type of lender' || h === 'lender type' || h.includes('type of lender') || h.includes('lender type')) lender_type = value;
            else if (h === 'types of loans' || h === 'loan types' || h.includes('types of loan') || h.includes('loan type')) loan_types = value;
            else if (h === 'loan size' || h.includes('loan size') || h.includes('loansize') || h === 'size') loan_size_text = value;
            else if (h === 'states' || h.includes('state')) states = value;
          });

          if (lender_name) {
            programs.push({
              lender_name,
              call_status: call_status || 'N',
              last_contact: last_contact ? (() => {
                const d = new Date(last_contact);
                return isNaN(d.getTime()) ? null : d.toISOString();
              })() : null,
              next_call: next_call ? (() => {
                const d = new Date(next_call);
                return isNaN(d.getTime()) ? null : d.toISOString();
              })() : null,
              location: location || null,
              looking_for: looking_for || null,
              contact_name: contact_name || null,
              phone: phone || null,
              email: email || null,
              lender_type: lender_type || null,
              loan_types: loan_types || null,
              loan_size_text: loan_size_text || null,
              states: states || null,
              program_name: loan_types || 'General',
              program_type: lender_type || 'Other',
            });
          }
        }

        if (programs.length === 0) {
          toast.error('No valid lender data found in CSV');
          setUploading(false);
          return;
        }

        // Insert into database
        const { error } = await supabase.from('lender_programs').insert(programs);
        
        if (error) throw error;

        toast.success(`Imported ${programs.length} lenders from CSV`);
        fetchPrograms();
      } catch (error) {
        console.error('Error parsing/uploading CSV:', error);
        toast.error('Failed to import CSV');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };

  const dirtyCount = rows.filter(r => r.isDirty && r.lender_name.trim()).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Lender Programs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {rows.filter(r => r.lender_name.trim()).length} of 900 rows filled
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant={filterPanelOpen ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            >
              <Filter className="w-4 h-4" strokeWidth={1.75} />
              Filter
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
            </Button>
            <Button
              variant={aiAssistantOpen ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setAiAssistantOpen(true)}
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              AI Advisor
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" strokeWidth={1.75} />}
              Upload CSV/Excel
            </Button>
            {dirtyCount > 0 && (
              <Button onClick={handleSaveAll} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {filterPanelOpen && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Lender Type</label>
                  <Select value={filters.lenderType} onValueChange={(v) => setFilters(f => ({ ...f, lenderType: v }))}>
                    <SelectTrigger className="h-9 bg-background border-border">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      {uniqueLenderTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">State</label>
                  <Select value={filters.states} onValueChange={(v) => setFilters(f => ({ ...f, states: v }))}>
                    <SelectTrigger className="h-9 bg-background border-border">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All states</SelectItem>
                      {uniqueStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Call Status</label>
                  <Select value={filters.callStatus} onValueChange={(v) => setFilters(f => ({ ...f, callStatus: v }))}>
                    <SelectTrigger className="h-9 bg-background border-border">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="Y">Called (Y)</SelectItem>
                      <SelectItem value="N">Not Called (N)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Input
            placeholder="Search lenders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-3 bg-background border-border"
          />
        </div>

        {/* Spreadsheet Table */}
        <div className="bg-card rounded-md border border-border overflow-hidden">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div style={{ minWidth: COLUMNS.reduce((sum, c) => sum + c.width, 50) }}>
              {/* Header */}
              <div className="flex bg-muted border-b-2 border-border sticky top-0 z-10">
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    className="px-3 py-3 text-sm font-semibold text-foreground border-r border-border last:border-r-0 flex-shrink-0"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
                <div className="w-12 px-3 py-3 flex-shrink-0" />
              </div>

              {/* Rows */}
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className={`flex border-b border-border hover:bg-muted/50 group min-h-[48px] ${
                    row.isDirty ? 'bg-amber-500/10' : ''
                  }`}
                >
                  {COLUMNS.map((col) => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                      const value = row[col.key] as string | number;
                      const isLookingFor = col.key === 'looking_for';

                    return (
                      <div
                        key={col.key}
                        className={`px-2 py-2 border-r border-border/50 last:border-r-0 flex-shrink-0 flex ${
                          isLookingFor ? 'items-start' : 'items-center'
                        } ${
                          col.editable ? 'cursor-text' : ''
                        } ${col.key === 'rowNum' ? 'bg-muted/50 text-muted-foreground text-sm font-medium justify-center' : ''}`}
                        style={{ width: col.width }}
                        onClick={() => handleCellClick(row.id, col.key)}
                      >
                        {isEditing ? (
                          isLookingFor ? (
                            <textarea
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingCell(null);
                                  setEditValue('');
                                }
                              }}
                              className="w-full h-20 text-sm px-2 py-1 border border-primary rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                          ) : (
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleKeyDown}
                              className="h-8 text-sm px-2 border-primary focus-visible:ring-1 focus-visible:ring-primary bg-background"
                            />
                          )
                        ) : (
                          <span className={`text-sm w-full ${
                            col.key === 'call_status' && value === 'Y' ? 'text-green-500 font-medium' : 'text-foreground'
                          } ${isLookingFor ? 'whitespace-pre-wrap break-words line-clamp-3' : 'truncate'}`}>
                            {value || (col.key === 'rowNum' ? '' : '')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div className="w-12 flex items-center justify-center flex-shrink-0">
                    {(row.lender_name.trim() || !row.isNew) && (
                      <button
                        onClick={() => handleDeleteRow(row)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>

        <p className="text-xs text-muted-foreground">
          Click any cell to edit. Changes are highlighted in yellow. Click "Save Changes" to persist.
        </p>
      </div>

      {/* AI Advisor Sheet */}
      <Sheet open={aiAssistantOpen} onOpenChange={setAiAssistantOpen}>
        <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Lender Program Advisor
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <LenderProgramAssistant />
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
};

export default LenderPrograms;
