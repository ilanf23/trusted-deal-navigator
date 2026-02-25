import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STAGE_LABELS } from '@/constants/appConfig';
import EvanLayout from '@/components/evan/EvanLayout';
import {
  DollarSign, Building2, User, CheckCircle2, Hash, Calendar, Tag,
  LayoutList, LayoutGrid, ArrowUpDown, Filter, Search, Plus,
  Bookmark, ChevronDown, ChevronRight, X, ExternalLink,
  MoreVertical, Info, Maximize2, Copy, MoreHorizontal,
  Zap, Target, GripVertical, Loader2, PanelLeftClose, PanelLeftOpen,
  Menu, Columns3, BarChart3, Settings,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = 'Lost' | 'Open';

interface OpportunityRow {
  id: string;
  opportunity: string;
  company: string | null;
  companyInitial: string;
  companyColor: string;
  contact: string | null;
  value: string | null;
  ownedBy: string;
  status: Status;
  stage: string;
  daysInStage: number | null;
  stageUpdated: string;
  lastContacted: string | null;
  interactions: number | null;
  inactiveDays: number | null;
  tags: string[];
  extraTags: number;
  dbStatus: string; // raw DB status for board grouping
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPANY_COLORS = [
  '#8B2635', '#7B5EA7', '#2E8B7A', '#B5651D', '#2E5DA8', '#C9930A',
  '#1A3A6B', '#6B4FBB', '#2E7B8B', '#D35400', '#27AE60', '#8E44AD',
];

function getCompanyColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COMPANY_COLORS[Math.abs(hash) % COMPANY_COLORS.length];
}

const UW_STATUSES = [
  'initial_review',
  'moving_to_underwriting',
  'underwriting',
  'ready_for_wu_approval',
  'onboarding',
];

// Board stages mapped from DB statuses
const BOARD_STAGE_DEFS = [
  { key: 'initial_review', name: 'Initial Review' },
  { key: 'moving_to_underwriting', name: 'Moving to UW' },
  { key: 'underwriting', name: 'Underwriting' },
  { key: 'onboarding', name: 'Onboarding' },
  { key: 'ready_for_wu_approval', name: 'Ready for WU Approval' },
];

function useUnderwritingLeads() {
  return useQuery({
    queryKey: ['underwriting-pipeline-leads'],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id, name, company_name, status, source, tags,
          last_activity_at, updated_at, created_at,
          assigned_to, uw_number, flagged_for_weekly
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch team members for owner names
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, name');

      const teamMap = new Map((teamMembers || []).map(tm => [tm.id, tm.name]));

      // Fetch primary contacts for all leads
      const leadIds = (leads || []).map(l => l.id);
      const { data: contacts } = await supabase
        .from('lead_contacts')
        .select('lead_id, name')
        .in('lead_id', leadIds)
        .eq('is_primary', true);

      const contactMap = new Map((contacts || []).map(c => [c.lead_id, c.name]));

      const now = new Date();

      return (leads || []).map((lead): OpportunityRow => {
        const companyName = lead.company_name || null;
        const ownerName = lead.assigned_to ? (teamMap.get(lead.assigned_to) || '–') : '–';
        const stageLabel = STAGE_LABELS[lead.status] || lead.status;
        const updatedAt = new Date(lead.updated_at);
        const daysInStage = differenceInDays(now, updatedAt);
        const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : null;
        const inactiveDays = lastActivity ? differenceInDays(now, lastActivity) : null;
        const tags = (lead.tags as string[]) || [];

        return {
          id: lead.id,
          opportunity: lead.name,
          company: companyName,
          companyInitial: companyName ? companyName.charAt(0).toUpperCase() : '',
          companyColor: companyName ? getCompanyColor(companyName) : '',
          contact: contactMap.get(lead.id) || null,
          value: null,
          ownedBy: ownerName,
          status: lead.status === 'lost' ? 'Lost' : 'Open',
          stage: stageLabel,
          daysInStage,
          stageUpdated: format(updatedAt, 'M/d/yyyy'),
          lastContacted: lastActivity ? format(lastActivity, 'M/d/yyyy') : null,
          interactions: null,
          inactiveDays,
          tags: tags.slice(0, 2),
          extraTags: Math.max(0, tags.length - 2),
          dbStatus: lead.status,
        };
      });
    },
  });
}

const COLUMN_DEFS = [
  { key: 'opportunity', label: 'Opportunity', icon: DollarSign, sortable: true, width: 280 },
  { key: 'company', label: 'Company', icon: Building2, sortable: true, width: 160 },
  { key: 'contact', label: 'Contact', icon: User, sortable: true, width: 140 },
  { key: 'value', label: 'Value', icon: DollarSign, sortable: true, width: 100 },
  { key: 'ownedBy', label: 'Owned By', icon: User, sortable: true, width: 90 },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2, sortable: false, width: 60 },
  { key: 'status', label: 'Status', icon: ChevronDown, sortable: true, width: 80 },
  { key: 'stage', label: 'Stage', icon: ChevronDown, sortable: true, width: 170 },
  { key: 'daysInStage', label: 'Days in Stage', icon: Hash, sortable: true, width: 110 },
  { key: 'stageUpdated', label: 'Stage Updated', icon: ChevronDown, sortable: true, width: 115 },
  { key: 'lastContacted', label: 'Last Contacted', icon: Calendar, sortable: true, width: 120 },
  { key: 'interactions', label: 'Interactions', icon: Hash, sortable: true, width: 100 },
  { key: 'inactiveDays', label: 'Inactive Days', icon: Hash, sortable: true, width: 105 },
  { key: 'tags', label: 'Tags', icon: Tag, sortable: false, width: 160 },
];

// ─── Small Reusable Components ────────────────────────────────────────────────

const StatusPill = ({ status }: { status: Status }) => (
  <span style={{
    background: status === 'Lost' ? '#FDECEA' : '#FEFBE8',
    color: status === 'Lost' ? '#C0392B' : '#8B7025',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    padding: '3px 10px',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  }}>
    {status}
  </span>
);

const TagPill = ({ text }: { text: string }) => (
  <span style={{
    background: '#F0EEF8',
    color: '#4A3A7A',
    borderRadius: '12px',
    fontSize: '11px',
    padding: '2px 10px',
    marginRight: '4px',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    maxWidth: '130px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  }}>
    {text}
  </span>
);

const CompanyAvatar = ({ initial, color }: { initial: string; color: string }) => (
  <span style={{
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: color,
    color: 'white',
    fontSize: '11px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: '6px',
  }}>
    {initial}
  </span>
);

const ToggleSwitch = ({ on, disabled }: { on: boolean; disabled?: boolean }) => (
  <div style={{
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    background: disabled ? '#AAAAAA' : (on ? '#3D2B6B' : '#CCCCCC'),
    position: 'relative',
    cursor: disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  }}>
    <div style={{
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: 'white',
      position: 'absolute',
      top: '2px',
      left: on ? '20px' : '2px',
      transition: 'left 0.15s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </div>
);

// ─── FilterItem ───────────────────────────────────────────────────────────────

const FilterItem = ({ name, active, onClick, isUserCreated, onDelete }: {
  name: string;
  active?: boolean;
  onClick?: () => void;
  isUserCreated?: boolean;
  onDelete?: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        background: active ? '#EDE9F8' : hovered ? '#F5F3FF' : 'transparent',
      }}
    >
      <span style={{
        fontSize: '14px',
        color: active ? '#3D2B6B' : '#1A1A2E',
        fontWeight: active ? 600 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '190px',
      }}>
        {name}
      </span>
      {hovered && isUserCreated && onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
            >
              <MoreVertical size={13} color="#999" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : hovered ? (
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
          <MoreVertical size={13} color="#999" />
        </button>
      ) : null}
    </div>
  );
};

// ─── List View ────────────────────────────────────────────────────────────────

interface ListViewProps {
  rows: OpportunityRow[];
  hoveredRow: string | null;
  setHoveredRow: (id: string | null) => void;
  onRowClick: (row: OpportunityRow) => void;
}

const ListView = ({ rows, hoveredRow, setHoveredRow, onRowClick }: ListViewProps) => {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', borderRadius: '8px', border: '1px solid #EEE' }}>
      {/* Column Headers */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#F6F5FB',
        height: '40px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid #EEEEF5',
        minWidth: '1600px',
      }}>
        {/* Checkbox */}
        <div style={{ width: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input type="checkbox" style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#3D2B6B' }} />
        </div>
        {COLUMN_DEFS.map(col => (
          <ColHeader
            key={col.key}
            col={col}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ))}
      </div>

      {/* Data Rows */}
      <div style={{ minWidth: '1600px' }}>
        {rows.map(row => (
          <DataRow
            key={row.id}
            row={row}
            hovered={hoveredRow === row.id}
            onMouseEnter={() => setHoveredRow(row.id)}
            onMouseLeave={() => setHoveredRow(null)}
            onClick={() => onRowClick(row)}
          />
        ))}
        {rows.length === 0 && (
          <div style={{ padding: '24px 16px', fontSize: '13px', color: '#999', textAlign: 'center' }}>
            No leads found
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Column Header ────────────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  sortable: boolean;
  width: number;
}

const ColHeader = ({
  col,
  sortCol,
  sortDir,
  onSort,
}: {
  col: ColDef;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const Icon = col.icon;
  const isActive = sortCol === col.key;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => col.sortable && onSort(col.key)}
      style={{
        width: `${col.width}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0 8px',
        height: '40px',
        cursor: col.sortable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <Icon size={13} color="#7B5EA7" />
      <span style={{
        fontSize: '13px',
        fontWeight: 600,
        color: '#7B5EA7',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {col.label}
      </span>
      {col.sortable && (isActive || hovered) && (
        <ArrowUpDown
          size={11}
          color={isActive ? '#3D2B6B' : '#BBB'}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        />
      )}
      {hovered && col.sortable && (
        <GripVertical size={12} color="#CCC" style={{ flexShrink: 0 }} />
      )}
    </div>
  );
};

// ─── Data Row ─────────────────────────────────────────────────────────────────

interface DataRowProps {
  row: OpportunityRow;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

const DataRow = ({ row, hovered, onMouseEnter, onMouseLeave, onClick }: DataRowProps) => (
  <div
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    style={{
      display: 'flex',
      alignItems: 'center',
      height: '48px',
      borderBottom: '1px solid #F0EEF0',
      background: hovered ? '#F5F3FF' : '#FFFFFF',
      transition: 'background 0.1s',
      minWidth: '1600px',
    }}
  >
    {/* Checkbox */}
    <div style={{ width: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <input
        type="checkbox"
        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#3D2B6B', opacity: hovered ? 1 : 0 }}
      />
    </div>

    {/* Opportunity */}
    <div style={{ width: '280px', flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
      <span style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#E8E6F0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <DollarSign size={10} color="#999" />
      </span>
      <button
        onClick={onClick}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: '14px',
          color: '#3D2B6B',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          flex: 1,
        }}
        title={row.opportunity}
      >
        {row.opportunity}
      </button>
      {hovered && (
        <ExternalLink size={13} color="#999" style={{ flexShrink: 0, cursor: 'pointer' }} />
      )}
    </div>

    {/* Company */}
    <div style={{ width: '160px', flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {row.company ? (
        <>
          <CompanyAvatar initial={row.companyInitial} color={row.companyColor} />
          <span style={{ fontSize: '13px', color: '#3D2B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', flex: 1 }}>
            {row.company}
          </span>
          {hovered && <ExternalLink size={11} color="#BBB" style={{ flexShrink: 0, marginLeft: '4px', cursor: 'pointer' }} />}
        </>
      ) : null}
    </div>

    {/* Contact */}
    <div style={{ width: '140px', flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {row.contact ? (
        <>
          <span style={{ fontSize: '13px', color: '#3D2B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', flex: 1 }}>
            {row.contact}
          </span>
          {hovered && <ExternalLink size={11} color="#BBB" style={{ flexShrink: 0, marginLeft: '4px', cursor: 'pointer' }} />}
        </>
      ) : null}
    </div>

    {/* Value */}
    <div style={{ width: '100px', flexShrink: 0, padding: '0 8px' }}>
      {row.value ? (
        <span style={{ fontSize: '13px', color: '#1A1A2E' }}>{row.value}</span>
      ) : (
        <DollarSign size={13} color="#DDD" />
      )}
    </div>

    {/* Owned By */}
    <div style={{ width: '90px', flexShrink: 0, padding: '0 8px' }}>
      <span style={{ fontSize: '13px', color: '#444' }}>{row.ownedBy}</span>
    </div>

    {/* Tasks */}
    <div style={{ width: '60px', flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid #E8E6F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <CheckCircle2 size={14} color="#BBB" />
      </span>
    </div>

    {/* Status */}
    <div style={{ width: '80px', flexShrink: 0, padding: '0 8px' }}>
      <StatusPill status={row.status} />
    </div>

    {/* Stage */}
    <div style={{ width: '170px', flexShrink: 0, padding: '0 8px', overflow: 'hidden' }}>
      <span style={{ fontSize: '13px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {row.stage}
      </span>
    </div>

    {/* Days in Stage */}
    <div style={{ width: '110px', flexShrink: 0, padding: '0 8px' }}>
      {row.daysInStage != null && (
        <span style={{ fontSize: '13px', color: '#333' }}>{row.daysInStage}</span>
      )}
    </div>

    {/* Stage Updated */}
    <div style={{ width: '115px', flexShrink: 0, padding: '0 8px' }}>
      <span style={{ fontSize: '13px', color: '#333' }}>{row.stageUpdated}</span>
    </div>

    {/* Last Contacted */}
    <div style={{ width: '120px', flexShrink: 0, padding: '0 8px' }}>
      {row.lastContacted && (
        <span style={{ fontSize: '13px', color: '#333' }}>{row.lastContacted}</span>
      )}
    </div>

    {/* Interactions */}
    <div style={{ width: '100px', flexShrink: 0, padding: '0 8px' }}>
      {row.interactions != null && (
        <span style={{ fontSize: '13px', color: '#333' }}>{row.interactions}</span>
      )}
    </div>

    {/* Inactive Days */}
    <div style={{ width: '105px', flexShrink: 0, padding: '0 8px' }}>
      {row.inactiveDays != null && (
        <span style={{ fontSize: '13px', color: '#333' }}>{row.inactiveDays}</span>
      )}
    </div>

    {/* Tags */}
    <div style={{ width: '160px', flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {row.tags.map(tag => <TagPill key={tag} text={tag} />)}
      {row.extraTags > 0 && (
        <span style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap' }}>+{row.extraTags}</span>
      )}
    </div>
  </div>
);

// ─── Board View ───────────────────────────────────────────────────────────────

const BoardView = ({ rows }: { rows: OpportunityRow[] }) => {
  const stages = BOARD_STAGE_DEFS.map(def => ({
    ...def,
    rows: rows.filter(r => r.dbStatus === def.key),
  }));

  return (
    <div style={{ flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '16px', minWidth: 'max-content' }}>
        {stages.map(stage => (
          <div key={stage.key} style={{ width: '280px', flexShrink: 0 }}>
            {/* Column Header */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E' }}>{stage.name}</span>
                <span style={{ fontSize: '13px', color: '#999' }}>{stage.rows.length}</span>
              </div>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stage.rows.slice(0, 5).map(row => (
                <BoardCard key={row.id} row={row} />
              ))}
              {stage.rows.length === 0 && (
                <div style={{
                  border: '2px dashed #E8E6F0',
                  borderRadius: '10px',
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#CCC',
                }}>
                  No records
                </div>
              )}
              {stage.rows.length > 5 && (
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#999', padding: '4px' }}>
                  +{stage.rows.length - 5} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BoardCard = ({ row }: { row: OpportunityRow }) => (
  <div style={{
    background: 'white',
    borderRadius: '10px',
    border: '1px solid #EEEEEE',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    padding: '14px',
    cursor: 'pointer',
  }}>
    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {row.opportunity}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', color: '#666' }}>
      <Building2 size={13} color="#BBB" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.company ?? '–'}
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '13px', color: '#666' }}>
      <DollarSign size={13} color="#BBB" />
      <span>{row.value ?? '–'}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#999' }}>
        <Calendar size={12} color="#BBB" />
        <span>{row.lastContacted?.split('/').slice(0, 2).join('/') ?? '–'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CheckCircle2 size={14} color="#CCC" />
        <span style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: row.companyColor || '#DDD',
          color: 'white',
          fontSize: '10px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {row.ownedBy.charAt(0)}
        </span>
        <StatusPill status={row.status} />
      </div>
    </div>
  </div>
);

// ─── Detail Panel ─────────────────────────────────────────────────────────────

type DetailTab = 'details' | 'activity' | 'related';

interface DetailPanelProps {
  row: OpportunityRow;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  onClose: () => void;
}

const DetailPanel = ({ row, tab, setTab, onClose }: DetailPanelProps) => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: '540px',
    height: '100vh',
    background: 'white',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    zIndex: 70,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  }}>
    {/* Top action bar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
        <X size={18} color="#999" />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button style={{ background: '#3D2B6B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Follow
        </button>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <Maximize2 size={16} color="#999" />
        </button>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <Copy size={16} color="#999" />
        </button>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <MoreHorizontal size={16} color="#999" />
        </button>
      </div>
    </div>

    {/* Entity header */}
    <div style={{ padding: '12px 20px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#E8E6F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <DollarSign size={20} color="#999" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
            {row.opportunity}
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>
            {row.company ?? 'No Company'} / {row.value ?? 'No Value'}
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#EDE9F8',
            color: '#3D2B6B',
            borderRadius: '12px',
            fontSize: '12px',
            padding: '3px 10px',
            fontWeight: 500,
          }}>
            <DollarSign size={11} color="#7B5EA7" />
            Opportunity
          </span>
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{ display: 'flex', borderBottom: '1px solid #E8E6F0', flexShrink: 0 }}>
      {(['details', 'activity', 'related'] as DetailTab[]).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            flex: 1,
            height: '40px',
            background: 'transparent',
            border: 'none',
            borderBottom: tab === t ? '3px solid #3D2B6B' : '3px solid transparent',
            fontSize: '13px',
            fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#1A1A2E' : '#999',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {t}
        </button>
      ))}
    </div>

    {/* Tab content */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      {tab === 'details' && <DetailsTabContent row={row} />}
      {tab === 'activity' && (
        <div style={{ fontSize: '14px', color: '#999', textAlign: 'center', marginTop: '40px' }}>No activity yet</div>
      )}
      {tab === 'related' && (
        <div style={{ fontSize: '14px', color: '#999', textAlign: 'center', marginTop: '40px' }}>No related records</div>
      )}
    </div>

    {/* Sticky footer */}
    <div style={{ padding: '12px 20px', borderTop: '1px solid #F0EEF0', textAlign: 'center', flexShrink: 0 }}>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#AAAAAA' }}>
        + Add new field
      </button>
    </div>
  </div>
);

// ─── Details Tab Content ──────────────────────────────────────────────────────

const DetailField = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ fontSize: '12px', fontWeight: 500, color: '#888', marginBottom: '4px' }}>
      {label}{required && <span style={{ color: '#E53E3E', marginLeft: '2px' }}>*</span>}
    </div>
    <div style={{ fontSize: '14px', color: '#1A1A2E' }}>{children}</div>
  </div>
);

const DropdownField = ({ value }: { value: string }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #E0E0E0',
    paddingBottom: '6px',
    cursor: 'pointer',
  }}>
    <span style={{ fontSize: '14px', color: '#1A1A2E' }}>{value}</span>
    <ChevronDown size={14} color="#999" />
  </div>
);

const DetailsTabContent = ({ row }: { row: OpportunityRow }) => (
  <div>
    <DetailField label="Name" required>
      <span>{row.opportunity}</span>
    </DetailField>

    <DetailField label="Pipeline">
      <DropdownField value="Underwriting" />
    </DetailField>

    <DetailField label="Stage">
      <DropdownField value={row.stage} />
    </DetailField>

    <DetailField label="CLX - File Name">
      <span style={{ color: '#1A1A2E' }}>
        {row.company?.replace(/[^a-zA-Z]/g, '') ?? row.contact?.split(' ')[0] ?? ''}
      </span>
    </DetailField>

    <DetailField label="Waiting On:">
      <span style={{ color: '#BBBBBB', fontSize: '14px' }}>Add Waiting On:</span>
    </DetailField>

    <DetailField label="Tags">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {row.tags.map(tag => (
          <TagPill key={tag} text={tag} />
        ))}
        <span style={{ fontSize: '13px', color: '#BBBBBB', cursor: 'pointer' }}>+ Add Tag</span>
      </div>
    </DetailField>

    <DetailField label="Value">
      <span>{row.value ?? <span style={{ color: '#BBBBBB' }}>Add Value</span>}</span>
    </DetailField>

    <DetailField label="Date Added">
      <span>{row.stageUpdated}</span>
    </DetailField>

    <DetailField label="Loss Reason">
      <DropdownField value="Dead - Client decided not to move forward" />
    </DetailField>

    <DetailField label="Company">
      {row.company ? (
        <span style={{ color: '#3D2B6B', cursor: 'pointer' }}>{row.company}</span>
      ) : (
        <span style={{ color: '#BBBBBB' }}>Add Company</span>
      )}
    </DetailField>

    <DetailField label="Owner">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#3D2B6B', cursor: 'pointer' }}>{row.ownedBy}</span>
        <X size={13} color="#CCC" style={{ cursor: 'pointer' }} />
      </div>
    </DetailField>

    <DetailField label="Source">
      <DropdownField value="No Source" />
    </DetailField>

    <DetailField label="Priority">
      <DropdownField value="None" />
    </DetailField>

    <DetailField label="Win Percentage">
      <span>50%</span>
    </DetailField>

    <DetailField label="Visibility">
      <DropdownField value="Everyone" />
    </DetailField>

    <DetailField label="About">
      <span style={{ color: '#BBBBBB' }}>Add About</span>
    </DetailField>

    <DetailField label="History">
      <span style={{ color: '#BBBBBB' }}>Add History</span>
    </DetailField>

    <DetailField label="Bank Relationships">
      <span style={{ color: '#BBBBBB' }}>Add Bank Relationships</span>
    </DetailField>

    <DetailField label="#UW">
      <span style={{ color: '#BBBBBB' }}>Add #UW</span>
    </DetailField>

    <DetailField label="Project Stage">
      <DropdownField value="- Select Project Stage -" />
    </DetailField>

    <DetailField label="Client Working with Other Lenders">
      <input type="checkbox" style={{ width: '16px', height: '16px', border: '1px solid #CCC', cursor: 'pointer', accentColor: '#3D2B6B' }} />
    </DetailField>

    <DetailField label="Weekly's">
      <DropdownField value="- Select Weekly's -" />
    </DetailField>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SAVED_FILTERS = [
  'My Open Opportunities',
  'Open Opportunities',
  "Opportunities I'm Following",
  'Won Opportunities',
  'Deals for Initial Review',
  'Deals Moving Towards Underwriting',
  'Pre-Approval Letters Issued',
  "Write Up's Pending Approval",
];

const UnderwritingPipeline = () => {
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [publicOpen, setPublicOpen] = useState(true);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<OpportunityRow | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');
  const [showNewFilterForm, setShowNewFilterForm] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [userFilters, setUserFilters] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('All Opportunities');
  const newFilterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewFilterForm && newFilterInputRef.current) {
      newFilterInputRef.current.focus();
    }
  }, [showNewFilterForm]);

  const handleSaveFilter = () => {
    const trimmed = newFilterName.trim();
    if (!trimmed) return;
    if ([...SAVED_FILTERS, ...userFilters].includes(trimmed)) {
      toast.error('A filter with that name already exists');
      return;
    }
    setUserFilters(prev => [...prev, trimmed]);
    setActiveFilter(trimmed);
    setNewFilterName('');
    setShowNewFilterForm(false);
    toast.success(`Filter "${trimmed}" created`);
  };

  const handleDeleteFilter = (name: string) => {
    setUserFilters(prev => prev.filter(f => f !== name));
    if (activeFilter === name) setActiveFilter('All Opportunities');
    toast.success(`Filter "${name}" deleted`);
  };

  const { data: allRows = [], isLoading } = useUnderwritingLeads();

  const closeAllPanels = () => {
    setSortPanelOpen(false);
    setAddDropdownOpen(false);
  };

  return (
    <EvanLayout>
      <div
        style={{
          display: 'flex',
          minHeight: 'calc(100vh - 130px)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          position: 'relative',
        }}
        onClick={() => {
          if (sortPanelOpen) setSortPanelOpen(false);
          if (addDropdownOpen) setAddDropdownOpen(false);
        }}
      >
        {/* ── LEFT PANEL: Saved Filters ─────────────────────────────────────── */}
        {!filtersCollapsed && (
          <div style={{
            width: '260px',
            flexShrink: 0,
            borderRight: '1px solid #E8E6F0',
            paddingRight: '12px',
            paddingLeft: '4px',
            marginRight: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 130px)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '44px', paddingBottom: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>Saved Filters</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  title="New Filter"
                  onClick={() => { setShowNewFilterForm(true); setNewFilterName(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, color: '#7B5EA7',
                    padding: '4px 8px', borderRadius: '6px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F0FA'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Plus size={14} />
                  <span>New</span>
                </button>
                <button
                  title="Collapse Filters"
                  onClick={() => setFiltersCollapsed(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: '6px', color: '#888',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F0FA'; e.currentTarget.style.color = '#7B5EA7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
            </div>

            {/* New Filter Inline Form */}
            {showNewFilterForm && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                border: '1px solid #E0DFF0', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px',
              }}>
                <input
                  ref={newFilterInputRef}
                  value={newFilterName}
                  onChange={e => setNewFilterName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveFilter();
                    if (e.key === 'Escape') { setShowNewFilterForm(false); setNewFilterName(''); }
                  }}
                  placeholder="Filter name..."
                  style={{
                    border: 'none', outline: 'none', fontSize: '13px', color: '#1A1A2E',
                    background: 'transparent', flex: 1, minWidth: 0,
                  }}
                />
                <button
                  onClick={handleSaveFilter}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, color: '#7B5EA7',
                    padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F0FA'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowNewFilterForm(false); setNewFilterName(''); }}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px', color: '#999', display: 'flex', alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid #E0DFF0', borderRadius: '8px', padding: '6px 12px', marginBottom: '12px',
            }}>
              <Search size={13} color="#999" />
              <input
                placeholder="Search Filters"
                style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#666', background: 'transparent', width: '100%' }}
              />
            </div>

            {/* All Opportunities Row */}
            <div
              onClick={() => setActiveFilter('All Opportunities')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: activeFilter === 'All Opportunities' ? '#EDE9F8' : 'transparent',
                borderRadius: '8px', padding: '6px 12px',
                height: '36px', marginBottom: '8px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#3D2B6B' }}>All Opportunities</span>
                {activeFilter === 'All Opportunities' && <Bookmark size={12} color="#7B5EA7" fill="#7B5EA7" />}
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>{allRows.length.toLocaleString()}</span>
            </div>

            {/* Public Section */}
            <div>
              <button
                onClick={() => setPublicOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '4px 12px 6px', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Public</span>
                <ChevronDown
                  size={13}
                  color="#999"
                  style={{ transform: publicOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                />
              </button>
              {publicOpen && SAVED_FILTERS.map(f => (
                <FilterItem
                  key={f}
                  name={f}
                  active={activeFilter === f}
                  onClick={() => setActiveFilter(f)}
                />
              ))}
            </div>

            {/* User-Created Filters */}
            {userFilters.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ padding: '4px 12px 6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Filters</span>
                </div>
                {userFilters.map(f => (
                  <FilterItem
                    key={f}
                    name={f}
                    active={activeFilter === f}
                    onClick={() => setActiveFilter(f)}
                    isUserCreated
                    onDelete={() => handleDeleteFilter(f)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed toggle */}
        {filtersCollapsed && (
          <button
            title="Expand Filters"
            onClick={() => setFiltersCollapsed(false)}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid #E0DFF0', background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              marginRight: '16px', alignSelf: 'flex-start', marginTop: '8px', flexShrink: 0,
              color: '#888',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F0FA'; e.currentTarget.style.color = '#7B5EA7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#888'; }}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        {/* ── RIGHT PANEL: Main Content ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', height: '48px', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1A1A2E', margin: 0, whiteSpace: 'nowrap' }}>
              {activeFilter}
            </h1>
            <Bookmark size={15} color="#AAAAAA" style={{ cursor: 'pointer', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '13px' }}>
              <Hash size={12} color="#AAAAAA" />
              <span>{allRows.length.toLocaleString()} opportunities</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '13px' }}>
              <DollarSign size={12} color="#AAAAAA" />
              <span>$1,983,517.00</span>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {/* Left icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Sidebar toggle group */}
              <div style={{ display: 'flex', border: '1px solid #E0DFF0', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setFiltersCollapsed(o => !o)}
                  title="Toggle Sidebar"
                  style={{
                    width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none', background: !filtersCollapsed ? '#EDE9F8' : 'white',
                  }}
                >
                  <Menu size={16} color={!filtersCollapsed ? '#3D2B6B' : '#666'} />
                </button>
                <button
                  title="Columns"
                  style={{
                    width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none', borderLeft: '1px solid #E0DFF0', background: 'white',
                  }}
                >
                  <Columns3 size={16} color="#666" />
                </button>
              </div>

              {/* Individual icon buttons */}
              {[
                { icon: BarChart3, title: 'Chart' },
                { icon: Filter, title: 'Filter' },
                { icon: Search, title: 'Search' },
                { icon: Settings, title: 'Settings' },
              ].map(({ icon: Icon, title }) => (
                <button
                  key={title}
                  title={title}
                  style={{
                    width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '1px solid #E0DFF0', borderRadius: '8px', background: 'white',
                  }}
                >
                  <Icon size={16} color="#666" />
                </button>
              ))}
            </div>

            {/* Add Opportunity Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setAddDropdownOpen(o => !o); setSortPanelOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#3D2B6B', color: 'white', border: 'none', borderRadius: '24px',
                  padding: '10px 22px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                Add Opportunity
                <ChevronDown size={14} />
              </button>
              {addDropdownOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '46px', right: 0,
                    background: 'white', borderRadius: '10px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '8px 0', zIndex: 50, minWidth: '210px',
                  }}
                >
                  {[
                    { icon: User, label: 'New Person' },
                    { icon: Building2, label: 'New Company' },
                    { icon: ChevronRight, label: 'New Pipeline record' },
                    { icon: CheckCircle2, label: 'New Task' },
                    { icon: Target, label: 'New Lead' },
                    { icon: Zap, label: 'New Task Automation' },
                  ].map(({ icon: Icon, label }) => (
                    <AddMenuItem key={label} Icon={Icon} label={label} onClose={() => setAddDropdownOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sort Panel (floating) */}
          {sortPanelOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '110px',
                right: '20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '16px',
                width: '340px',
                zIndex: 50,
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E', marginBottom: '12px' }}>Sort by</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{
                  flex: '1 1 58%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  border: '1px solid #E0DFF0', borderRadius: '8px', background: 'white', cursor: 'pointer',
                }}>
                  <DollarSign size={13} color="#7B5EA7" />
                  <span style={{ fontSize: '13px', color: '#1A1A2E', flex: 1, textAlign: 'left' }}>Value</span>
                  <ChevronDown size={12} color="#999" />
                </button>
                <button style={{
                  flex: '1 1 42%', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px',
                  border: '1px solid #E0DFF0', borderRadius: '8px', background: 'white', cursor: 'pointer',
                }}>
                  <ArrowUpDown size={13} color="#7B5EA7" />
                  <span style={{ fontSize: '13px', color: '#1A1A2E', flex: 1, textAlign: 'left' }}>Descending</span>
                  <ChevronDown size={12} color="#999" />
                </button>
              </div>
            </div>
          )}

          {/* List / Board View */}
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
              <Loader2 size={24} color="#7B5EA7" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ marginLeft: '8px', fontSize: '14px', color: '#999' }}>Loading leads...</span>
            </div>
          ) : viewMode === 'list' ? (
            <ListView
              rows={allRows}
              hoveredRow={hoveredRow}
              setHoveredRow={setHoveredRow}
              onRowClick={(row) => { setSelectedRow(row); setDetailTab('details'); closeAllPanels(); }}
            />
          ) : (
            <BoardView rows={allRows} />
          )}
        </div>
      </div>

      {/* ── Overlay Panels ────────────────────────────────────────────────────── */}

      {/* Backdrop when detail panel is open */}
      {selectedRow && (
        <div
          onClick={() => setSelectedRow(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'transparent' }}
        />
      )}


      {selectedRow && (
        <DetailPanel
          row={selectedRow}
          tab={detailTab}
          setTab={setDetailTab}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </EvanLayout>
  );
};

// ─── Add Menu Item ────────────────────────────────────────────────────────────

const AddMenuItem = ({
  Icon,
  label,
  onClose,
}: {
  Icon: React.ComponentType<any>;
  label: string;
  onClose: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
        width: '100%', background: hovered ? '#F5F3FF' : 'transparent',
        border: 'none', cursor: 'pointer', fontSize: '14px', color: '#1A1A2E', textAlign: 'left',
      }}
    >
      <Icon size={17} color="#7B5EA7" />
      {label}
    </button>
  );
};

export default UnderwritingPipeline;
