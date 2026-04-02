import { useEffect, useState, useMemo, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Save, Trash2, Upload, Filter, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { LenderProgramAssistant } from '@/components/admin/LenderProgramAssistant';
import { SearchableSelect } from '@/components/ui/searchable-select';
import * as XLSX from 'xlsx';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

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
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Lender Programs');
    return () => { setPageTitle(null); };
  }, []);

  const [rows, setRows] = useState<LenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  // Panel mode: 'list' | 'filter' | 'advisor' (matches EvansCalls pattern)
  const [panelMode, setPanelMode] = useState<'list' | 'filter' | 'advisor'>('list');
  const [filters, setFilters] = useState({
    institution: '',
    lookingFor: '',
    contact: '',
    loanSize: '',
    states: '',
    lenderType: '',
    loanTypes: '',
    callStatus: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Valid US state abbreviations
  const VALID_STATE_ABBREVS = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]);

  // Standardized loan size categories
  const LOAN_SIZE_CATEGORIES = [
    { label: 'Under $100K', min: 0, max: 100000 },
    { label: '$100K - $250K', min: 100000, max: 250000 },
    { label: '$250K - $500K', min: 250000, max: 500000 },
    { label: '$500K - $1M', min: 500000, max: 1000000 },
    { label: '$1M - $2.5M', min: 1000000, max: 2500000 },
    { label: '$2.5M - $5M', min: 2500000, max: 5000000 },
    { label: '$5M - $10M', min: 5000000, max: 10000000 },
    { label: '$10M - $25M', min: 10000000, max: 25000000 },
    { label: '$25M - $50M', min: 25000000, max: 50000000 },
    { label: '$50M+', min: 50000000, max: Infinity },
  ];

  // Parse loan size text to extract numeric values
  const parseLoanSizeText = (text: string | null): { min: number; max: number } | null => {
    if (!text) return null;
    const cleaned = text.replace(/[$,]/g, '').toLowerCase().trim();
    
    const parseNumber = (str: string): number => {
      const match = str.match(/([\d.]+)\s*(k|m|mm|b|million|mil)?/i);
      if (!match) return 0;
      let num = parseFloat(match[1]);
      const suffix = (match[2] || '').toLowerCase();
      if (suffix === 'k') num *= 1000;
      else if (suffix === 'm' || suffix === 'mm' || suffix === 'million' || suffix === 'mil') num *= 1000000;
      else if (suffix === 'b') num *= 1000000000;
      else if (num <= 100 && !suffix) {
        if (cleaned.includes('mm') || cleaned.includes('million') || cleaned.includes('mil')) {
          num *= 1000000;
        }
      }
      return num;
    };

    const rangeMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*[-–to]+\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (rangeMatch) {
      const min = parseNumber(rangeMatch[1]);
      const max = parseNumber(rangeMatch[2]);
      if (min <= 100 && max <= 100 && min > 0) {
        return { min: min * 1000000, max: max * 1000000 };
      }
      return { min, max };
    }

    const upToMatch = cleaned.match(/up\s*to\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (upToMatch) {
      return { min: 0, max: parseNumber(upToMatch[1]) };
    }

    const minMatch = cleaned.match(/(?:min(?:imum)?)\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i) ||
                     cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*(?:min(?:imum)?|\+)/i);
    if (minMatch) {
      return { min: parseNumber(minMatch[1]), max: Infinity };
    }

    const plusMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*\+/i);
    if (plusMatch) {
      return { min: parseNumber(plusMatch[1]), max: Infinity };
    }

    const singleMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
    if (singleMatch) {
      const val = parseNumber(singleMatch[1]);
      return { min: val * 0.5, max: val * 2 };
    }

    return null;
  };

  const rowMatchesLoanCategory = (row: LenderRow, categoryLabel: string): boolean => {
    const category = LOAN_SIZE_CATEGORIES.find(c => c.label === categoryLabel);
    if (!category) return false;

    const rowRange = parseLoanSizeText(row.loan_size_text);
    if (!rowRange) return false;

    if (category.max === Infinity) {
      return rowRange.max >= category.min;
    }

    const lenderCanDoSmallEnough = rowRange.min <= category.max;
    const lenderCanDoLargeEnough = rowRange.max >= category.min;
    
    return lenderCanDoSmallEnough && lenderCanDoLargeEnough;
  };

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
        row.contact_name?.toLowerCase().includes(query) ||
        row.looking_for?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    // Dropdown filters (matching EvansCalls pattern)
    if (filters.institution && row.lender_name !== filters.institution) return false;
    if (filters.lookingFor && !row.looking_for?.toLowerCase().includes(filters.lookingFor.toLowerCase())) return false;
    if (filters.contact && row.contact_name !== filters.contact) return false;
    if (filters.loanSize && !rowMatchesLoanCategory(row, filters.loanSize)) return false;
    if (filters.states && !row.states?.toLowerCase().includes(filters.states.toLowerCase())) return false;
    if (filters.lenderType && row.lender_type !== filters.lenderType) return false;
    if (filters.loanTypes && !row.loan_types?.toLowerCase().includes(filters.loanTypes.toLowerCase())) return false;
    if (filters.callStatus && row.call_status?.toLowerCase() !== filters.callStatus.toLowerCase()) return false;
    
    return true;
  });

  // Extract unique values for filter dropdowns (matching EvansCalls pattern)
  const filterOptions = useMemo(() => {
    const getUniqueValues = (key: keyof LenderRow) => {
      const values = rows
        .map(r => r[key])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim());
      return [...new Set(values)].sort();
    };

    const getUniqueStates = () => {
      const states = rows
        .flatMap(r => (r.states || '').split(/[,\s]+/).map(s => s.trim().toUpperCase()))
        .filter(s => VALID_STATE_ABBREVS.has(s));
      return [...new Set(states)].sort();
    };

    const getUniqueLoanTypes = () => {
      const types = rows
        .flatMap(r => (r.loan_types || '').split(',').map(t => t.trim()))
        .filter(t => t !== '');
      return [...new Set(types)].sort();
    };

    return {
      institutions: getUniqueValues('lender_name'),
      contacts: getUniqueValues('contact_name'),
      loanSizes: LOAN_SIZE_CATEGORIES.map(c => c.label),
      states: getUniqueStates(),
      lenderTypes: getUniqueValues('lender_type'),
      loanTypes: getUniqueLoanTypes(),
    };
  }, [rows, VALID_STATE_ABBREVS, LOAN_SIZE_CATEGORIES]);

  const clearFilters = () => {
    setFilters({
      institution: '',
      lookingFor: '',
      contact: '',
      loanSize: '',
      states: '',
      lenderType: '',
      loanTypes: '',
      callStatus: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');

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
      <div data-full-bleed className="space-y-4 p-6">
        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant={panelMode === 'filter' ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPanelMode(panelMode === 'filter' ? 'list' : 'filter')}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                  {Object.values(filters).filter(v => v.trim()).length}
                </span>
              )}
            </Button>
            <Button
              variant={panelMode === 'advisor' ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPanelMode(panelMode === 'advisor' ? 'list' : 'advisor')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Advisor
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
            {dirtyCount > 0 && (
              <Button onClick={handleSaveAll} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save {dirtyCount}
              </Button>
            )}
          </div>

        {/* Main content grid - spreadsheet + optional panel */}
        <div className={`grid gap-4 ${panelMode !== 'list' ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Spreadsheet Section */}
          <div className={panelMode !== 'list' ? 'xl:col-span-3' : ''}>
            {/* Search */}
            <div className="relative max-w-md mb-4">
              <Input
                placeholder="Search lenders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 bg-background border-border"
              />
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-card rounded-md border border-border overflow-hidden">
              <ScrollArea className="h-[calc(100vh-320px)]">
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

            <p className="text-xs text-muted-foreground mt-2">
              Click any cell to edit. Changes are highlighted in yellow.
            </p>
          </div>

          {/* Filter Panel */}
          {panelMode === 'filter' && (
            <div className="xl:col-span-1">
              <Card className="h-full flex flex-col border-border">
                <CardHeader 
                  className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors bg-muted/30"
                  onClick={() => setPanelMode('list')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-700 dark:bg-slate-600">
                        <Filter className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-base">Filter Lenders</CardTitle>
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="text-xs">
                          {Object.values(filters).filter(v => v.trim()).length} active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearFilters();
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                      <X className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 min-h-0 overflow-auto">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Institution</Label>
                      <SearchableSelect
                        options={filterOptions.institutions}
                        value={filters.institution}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, institution: value }))}
                        placeholder="All institutions"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Looking For</Label>
                      <Input
                        placeholder="Type to search..."
                        value={filters.lookingFor}
                        onChange={(e) => setFilters(prev => ({ ...prev, lookingFor: e.target.value }))}
                        className="h-8 text-sm pl-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Contact Name</Label>
                      <SearchableSelect
                        options={filterOptions.contacts}
                        value={filters.contact}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, contact: value }))}
                        placeholder="All contacts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Loan Size</Label>
                      <SearchableSelect
                        options={filterOptions.loanSizes}
                        value={filters.loanSize}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, loanSize: value }))}
                        placeholder="All loan sizes"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">States</Label>
                      <SearchableSelect
                        options={filterOptions.states}
                        value={filters.states}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, states: value }))}
                        placeholder="All states"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Lender Type</Label>
                      <SearchableSelect
                        options={filterOptions.lenderTypes}
                        value={filters.lenderType}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, lenderType: value }))}
                        placeholder="All lender types"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Loan Types</Label>
                      <SearchableSelect
                        options={filterOptions.loanTypes}
                        value={filters.loanTypes}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, loanTypes: value }))}
                        placeholder="All loan types"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Call Status</Label>
                      <SearchableSelect
                        options={['Y', 'N']}
                        value={filters.callStatus}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, callStatus: value }))}
                        placeholder="All"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Advisor Panel */}
          {panelMode === 'advisor' && (
            <div className="xl:col-span-1">
              <Card className="h-full flex flex-col border-primary/20">
                <CardHeader 
                  className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setPanelMode('list')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/80">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-base">Program Advisor</CardTitle>
                    </div>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 min-h-0">
                  <LenderProgramAssistant />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
