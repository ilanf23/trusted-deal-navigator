import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Loader2, Save, Trash2, Search, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
  { key: 'rowNum', label: '#', width: 50, editable: false },
  { key: 'lender_name', label: 'Institution', width: 180, editable: true },
  { key: 'call_status', label: 'Call Y/N', width: 70, editable: true },
  { key: 'last_contact', label: 'Last Contact', width: 100, editable: true },
  { key: 'next_call', label: 'Next Call', width: 100, editable: true },
  { key: 'location', label: 'Location', width: 120, editable: true },
  { key: 'looking_for', label: 'Looking For', width: 150, editable: true },
  { key: 'contact_name', label: 'NAME', width: 130, editable: true },
  { key: 'phone', label: 'PHONE', width: 120, editable: true },
  { key: 'email', label: 'EMAIL', width: 180, editable: true },
  { key: 'lender_type', label: 'TYPE OF LENDER', width: 130, editable: true },
  { key: 'loan_types', label: 'TYPES OF LOANS', width: 150, editable: true },
  { key: 'loan_size_text', label: 'Loan Size', width: 120, editable: true },
  { key: 'states', label: 'States', width: 100, editable: true },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');

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
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      row.lender_name.toLowerCase().includes(query) ||
      row.loan_types?.toLowerCase().includes(query) ||
      row.states?.toLowerCase().includes(query) ||
      row.lender_type?.toLowerCase().includes(query) ||
      row.contact_name?.toLowerCase().includes(query)
    );
  });

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

  const dirtyCount = rows.filter(r => r.isDirty && r.lender_name.trim()).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
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
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Lender Programs</h1>
            <p className="text-sm text-slate-500 mt-1">
              {rows.filter(r => r.lender_name.trim()).length} of 900 rows filled
            </p>
          </div>
          <div className="flex gap-2">
            {dirtyCount > 0 && (
              <Button onClick={handleSaveAll} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.5} />
          <Input
            placeholder="Search lenders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>

        {/* Spreadsheet Table */}
        <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-240px)]">
            <div style={{ minWidth: COLUMNS.reduce((sum, c) => sum + c.width, 50) }}>
              {/* Header */}
              <div className="flex bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    className="px-2 py-2 text-xs font-semibold text-slate-700 border-r border-slate-200 last:border-r-0 flex-shrink-0"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
                <div className="w-10 px-2 py-2 flex-shrink-0" />
              </div>

              {/* Rows */}
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className={`flex border-b border-slate-100 hover:bg-slate-50 group ${
                    row.isDirty ? 'bg-amber-50' : ''
                  }`}
                >
                  {COLUMNS.map((col) => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                      const value = row[col.key] as string | number;

                    return (
                      <div
                        key={col.key}
                        className={`px-1 py-0.5 border-r border-slate-100 last:border-r-0 flex-shrink-0 flex items-center ${
                          col.editable ? 'cursor-text' : ''
                        } ${col.key === 'rowNum' ? 'bg-slate-50 text-slate-500 text-xs font-medium justify-center' : ''}`}
                        style={{ width: col.width }}
                        onClick={() => handleCellClick(row.id, col.key)}
                      >
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            className="h-6 text-xs px-1 border-blue-400 focus-visible:ring-1 focus-visible:ring-blue-400"
                          />
                        ) : (
                          <span className={`text-xs truncate w-full ${
                            col.key === 'call_status' && value === 'Y' ? 'text-green-600 font-medium' : 'text-slate-700'
                          }`}>
                            {value || (col.key === 'rowNum' ? '' : '')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div className="w-10 flex items-center justify-center flex-shrink-0">
                    {(row.lender_name.trim() || !row.isNew) && (
                      <button
                        onClick={() => handleDeleteRow(row)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

        <p className="text-xs text-slate-500">
          Click any cell to edit. Changes are highlighted in yellow. Click "Save Changes" to persist.
        </p>
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
