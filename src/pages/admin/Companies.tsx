import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import EvanLayout from '@/components/evan/EvanLayout';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import {
  Search, Plus, Building2, Tag, CalendarDays, Clock, Moon,
  ArrowUpDown, Filter, Settings2, ChevronDown, Check, X,
  Phone, Globe, Mail, User, CheckSquare, MessageSquare,
  PanelLeft, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  company_name: string;
  phone: string | null;
  contact_name: string | null;
  tasks_count: number;
  website: string | null;
  contact_type: string | null;
  email_domain: string | null;
  last_contacted: string | null;
  interactions_count: number;
  inactive_days: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

const CONTACT_TYPES = ['Client', 'Prospect', 'Referral Partner', 'Lender', 'Vendor', 'Other'];

const contactTypeConfig: Record<string, { label: string; dot: string; pill: string }> = {
  Client: { label: 'Client', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  Prospect: { label: 'Prospect', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  'Referral Partner': { label: 'Referral Partner', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  Lender: { label: 'Lender', dot: 'bg-indigo-500', pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  Vendor: { label: 'Vendor', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  Other: { label: 'Other', dot: 'bg-slate-400', pill: 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300' },
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Companies' },
  { id: 'Client', label: 'Clients' },
  { id: 'Prospect', label: 'Prospects' },
  { id: 'Referral Partner', label: 'Referral Partners' },
  { id: 'Lender', label: 'Lenders' },
  { id: 'Vendor', label: 'Vendors' },
  { id: 'recently_contacted', label: 'Recently Contacted' },
  { id: 'inactive', label: 'Inactive (30+ days)' },
];

type SortField = 'company_name' | 'contact_name' | 'contact_type' | 'last_contacted' | 'interactions_count' | 'inactive_days';
type SortDir = 'asc' | 'desc';

type ColumnKey = 'phone' | 'contact' | 'tasks' | 'website' | 'contactType' | 'emailDomain' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  phone: 'Phone',
  contact: 'Contact',
  tasks: 'Tasks',
  website: 'Website',
  contactType: 'Contact Type',
  emailDomain: 'Email Domain',
  lastContacted: 'Last Contacted',
  interactions: 'Interactions',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

const Companies = () => {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ company_name: '', phone: '', contact_name: '', website: '', email_domain: '', contact_type: 'Prospect' });

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    phone: true, contact: true, tasks: true, website: true, contactType: true,
    emailDomain: true, lastContacted: true, interactions: true, inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    company: 200, phone: 130, contact: 140, tasks: 55, website: 150,
    contactType: 130, emailDomain: 140, lastContacted: 110, interactions: 65, inactiveDays: 70, tags: 100,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('companies-column-widths');
      if (saved) return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('companies-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Data query ──
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('company_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Company[];
    },
  });

  // ── Filter counts ──
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    for (const type of CONTACT_TYPES) {
      counts[type] = companies.filter(c => c.contact_type === type).length;
    }
    counts['recently_contacted'] = companies.filter(c => {
      if (!c.last_contacted) return false;
      return differenceInDays(new Date(), parseISO(c.last_contacted)) <= 7;
    }).length;
    counts['inactive'] = companies.filter(c => c.inactive_days >= 30).length;
    return counts;
  }, [companies]);

  // ── Filter + sort ──
  const filteredAndSorted = useMemo(() => {
    let filtered = companies;
    if (activeFilter === 'recently_contacted') {
      filtered = filtered.filter(c => c.last_contacted && differenceInDays(new Date(), parseISO(c.last_contacted)) <= 7);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(c => c.inactive_days >= 30);
    } else if (activeFilter !== 'all') {
      filtered = filtered.filter(c => c.contact_type === activeFilter);
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.company_name.toLowerCase().includes(s) ||
        c.contact_name?.toLowerCase().includes(s) ||
        c.email_domain?.toLowerCase().includes(s) ||
        c.website?.toLowerCase().includes(s)
      );
    }
    return [...filtered].sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [companies, activeFilter, searchTerm, sortField, sortDir]);

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          company_name: data.company_name,
          phone: data.phone || null,
          contact_name: data.contact_name || null,
          website: data.website || null,
          email_domain: data.email_domain || null,
          contact_type: data.contact_type,
        })
        .select()
        .single();
      if (error) throw error;
      return company as Company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
      setAddOpen(false);
      setNewCompany({ company_name: '', phone: '', contact_name: '', website: '', email_domain: '', contact_type: 'Prospect' });
      toast.success(`"${company.company_name}" added`);
    },
    onError: () => toast.error('Failed to create company'),
  });

  const handleCreate = () => {
    if (!newCompany.company_name.trim()) { toast.error('Company name is required'); return; }
    createMutation.mutate(newCompany);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <EvanLayout>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-background">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-[210px] min-w-[210px] border-r border-border bg-muted/30 flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filters</h3>
            </div>
            <ScrollArea className="flex-1 px-2 py-1">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setActiveFilter(opt.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors mb-0.5',
                    activeFilter === opt.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  <span className="text-[10px] ml-1 tabular-nums">{filterCounts[opt.id] ?? 0}</span>
                </button>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(s => !s)}>
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-1.5 mr-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Companies</span>
              <span className="text-xs text-muted-foreground ml-1">({filteredAndSorted.length})</span>
            </div>

            <div className="flex-1" />

            {searchOpen ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 w-52 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSearchOpen(false); setSearchTerm(''); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSearchOpen(true)}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Columns</p>
                {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-muted"
                  >
                    <span>{COLUMN_LABELS[key]}</span>
                    {columnVisibility[key] && <Check className="h-3 w-3 text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Button size="sm" className="h-7 text-xs gap-1 rounded-full" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add Company
            </Button>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Building2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No companies found</p>
                <p className="text-xs">Try adjusting your filters or add a new company</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="min-w-max text-xs">
                <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.company }} onClick={() => handleSort('company_name')}>
                      <ResizableColumnHeader columnId="company" currentWidth={`${columnWidths.company}px`} onResize={handleColumnResize}>Company</ResizableColumnHeader>
                    </th>
                    {columnVisibility.phone && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2" style={{ width: columnWidths.phone }}>
                        <ResizableColumnHeader columnId="phone" currentWidth={`${columnWidths.phone}px`} onResize={handleColumnResize}>Phone</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.contact && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.contact }} onClick={() => handleSort('contact_name')}>
                        <ResizableColumnHeader columnId="contact" currentWidth={`${columnWidths.contact}px`} onResize={handleColumnResize}>Contact</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.tasks && (
                      <th className="text-center font-semibold text-muted-foreground px-3 py-2" style={{ width: columnWidths.tasks }}>
                        <ResizableColumnHeader columnId="tasks" currentWidth={`${columnWidths.tasks}px`} onResize={handleColumnResize}>Tasks</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.website && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2" style={{ width: columnWidths.website }}>
                        <ResizableColumnHeader columnId="website" currentWidth={`${columnWidths.website}px`} onResize={handleColumnResize}>Website</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.contactType && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.contactType }} onClick={() => handleSort('contact_type')}>
                        <ResizableColumnHeader columnId="contactType" currentWidth={`${columnWidths.contactType}px`} onResize={handleColumnResize}>Type</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.emailDomain && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2" style={{ width: columnWidths.emailDomain }}>
                        <ResizableColumnHeader columnId="emailDomain" currentWidth={`${columnWidths.emailDomain}px`} onResize={handleColumnResize}>Email Domain</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.lastContacted && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.lastContacted }} onClick={() => handleSort('last_contacted')}>
                        <ResizableColumnHeader columnId="lastContacted" currentWidth={`${columnWidths.lastContacted}px`} onResize={handleColumnResize}>Last Contacted</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.interactions && (
                      <th className="text-center font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.interactions }} onClick={() => handleSort('interactions_count')}>
                        <ResizableColumnHeader columnId="interactions" currentWidth={`${columnWidths.interactions}px`} onResize={handleColumnResize}>Interactions</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.inactiveDays && (
                      <th className="text-center font-semibold text-muted-foreground px-3 py-2 cursor-pointer select-none" style={{ width: columnWidths.inactiveDays }} onClick={() => handleSort('inactive_days')}>
                        <ResizableColumnHeader columnId="inactiveDays" currentWidth={`${columnWidths.inactiveDays}px`} onResize={handleColumnResize}>Inactive</ResizableColumnHeader>
                      </th>
                    )}
                    {columnVisibility.tags && (
                      <th className="text-left font-semibold text-muted-foreground px-3 py-2" style={{ width: columnWidths.tags }}>
                        <ResizableColumnHeader columnId="tags" currentWidth={`${columnWidths.tags}px`} onResize={handleColumnResize}>Tags</ResizableColumnHeader>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((company) => {
                    const typeConf = contactTypeConfig[company.contact_type ?? 'Other'] ?? contactTypeConfig.Other;
                    const avatarColor = getAvatarColor(company.company_name);
                    const initial = company.company_name[0]?.toUpperCase() ?? '?';

                    return (
                      <tr
                        key={company.id}
                        className={cn(
                          'border-b border-border/40 hover:bg-muted/40 cursor-pointer transition-colors',
                          selectedCompany?.id === company.id && 'bg-primary/5'
                        )}
                        onClick={() => setSelectedCompany(company)}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={cn('h-7 w-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold shrink-0', avatarColor)}>
                              {initial}
                            </div>
                            <span className="font-medium text-foreground truncate">{company.company_name}</span>
                          </div>
                        </td>
                        {columnVisibility.phone && (
                          <td className="px-3 py-2 text-muted-foreground truncate">{company.phone ?? '—'}</td>
                        )}
                        {columnVisibility.contact && (
                          <td className="px-3 py-2 text-muted-foreground truncate">{company.contact_name ?? '—'}</td>
                        )}
                        {columnVisibility.tasks && (
                          <td className="px-3 py-2 text-center">
                            <span className={cn('tabular-nums', company.tasks_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                              {company.tasks_count}
                            </span>
                          </td>
                        )}
                        {columnVisibility.website && (
                          <td className="px-3 py-2 text-muted-foreground truncate">
                            {company.website ? (
                              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                                {company.website.replace(/^https?:\/\//, '')}
                              </a>
                            ) : '—'}
                          </td>
                        )}
                        {columnVisibility.contactType && (
                          <td className="px-3 py-2">
                            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium', typeConf.pill)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', typeConf.dot)} />
                              {typeConf.label}
                            </span>
                          </td>
                        )}
                        {columnVisibility.emailDomain && (
                          <td className="px-3 py-2 text-muted-foreground truncate">{company.email_domain ?? '—'}</td>
                        )}
                        {columnVisibility.lastContacted && (
                          <td className="px-3 py-2 text-muted-foreground">{formatShortDate(company.last_contacted)}</td>
                        )}
                        {columnVisibility.interactions && (
                          <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{company.interactions_count}</td>
                        )}
                        {columnVisibility.inactiveDays && (
                          <td className="px-3 py-2 text-center">
                            <span className={cn('tabular-nums', company.inactive_days >= 30 ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                              {company.inactive_days}d
                            </span>
                          </td>
                        )}
                        {columnVisibility.tags && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1 flex-wrap">
                              {(company.tags ?? []).slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4">{tag}</Badge>
                              ))}
                              {(company.tags ?? []).length > 2 && (
                                <span className="text-[9px] text-muted-foreground">+{(company.tags ?? []).length - 2}</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Add Company Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Company Name *</Label>
              <Input value={newCompany.company_name} onChange={e => setNewCompany(p => ({ ...p, company_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contact Name</Label>
                <Input value={newCompany.contact_name} onChange={e => setNewCompany(p => ({ ...p, contact_name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={newCompany.phone} onChange={e => setNewCompany(p => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Website</Label>
                <Input value={newCompany.website} onChange={e => setNewCompany(p => ({ ...p, website: e.target.value }))} className="h-8 text-sm" placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Email Domain</Label>
                <Input value={newCompany.email_domain} onChange={e => setNewCompany(p => ({ ...p, email_domain: e.target.value }))} className="h-8 text-sm" placeholder="company.com" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Contact Type</Label>
              <Select value={newCompany.contact_type} onValueChange={v => setNewCompany(p => ({ ...p, contact_type: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </EvanLayout>
  );
};

export default Companies;
