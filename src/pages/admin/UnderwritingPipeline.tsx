import { useState, useRef } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import {
  DollarSign, Building2, User, CheckCircle2, Hash, Calendar, Tag,
  LayoutList, LayoutGrid, ArrowUpDown, Filter, Search, Settings, Plus,
  Bookmark, ChevronDown, ChevronLeft, ChevronRight, X, ExternalLink,
  MoreVertical, ArrowLeft, Info, Maximize2, Copy, MoreHorizontal,
  Zap, Target, GripVertical,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = 'Lost' | 'Open';

interface OpportunityRow {
  id: number;
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
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SAMPLE_ROWS: OpportunityRow[] = [
  { id: 1, opportunity: 'Charity Hospital - Bridge Ln for Redevelopment Project', company: 'Bank Resources, Inc.', companyInitial: 'B', companyColor: '#8B2635', contact: 'Byron Richardson', value: '$220,000.00', ownedBy: 'Wendy', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: 900, stageUpdated: '9/7/2023', lastContacted: '10/7/2025', interactions: 1066, inactiveDays: 139, tags: ['cash flow completed'], extraTags: 1 },
  { id: 2, opportunity: 'Homewood Suites Lansing - Purchase Hotel & PIP', company: null, companyInitial: '', companyColor: '', contact: 'Eric Cardona', value: null, ownedBy: 'Wendy', status: 'Lost', stage: 'Maura Underwriting', daysInStage: 1159, stageUpdated: '12/22/2022', lastContacted: '1/29/2025', interactions: 155, inactiveDays: 390, tags: ['cash flow started'], extraTags: 1 },
  { id: 3, opportunity: 'Frederick McDonald - Business & RE Acquisition', company: 'Horizons Capital Partners', companyInitial: 'H', companyColor: '#7B5EA7', contact: 'Frederick McDonald', value: null, ownedBy: 'Maura', status: 'Lost', stage: 'UW Paused', daysInStage: 895, stageUpdated: '9/12/2023', lastContacted: '11/18/2025', interactions: null, inactiveDays: null, tags: ['cash flow started'], extraTags: 0 },
  { id: 4, opportunity: 'Paresh Patel - Oswego Cricket Stadium', company: null, companyInitial: '', companyColor: '', contact: 'Paresh Patel', value: null, ownedBy: 'Wendy', status: 'Lost', stage: 'Waiting on Client to Move Forward', daysInStage: 762, stageUpdated: '1/23/2024', lastContacted: '5/8/2024', interactions: 510, inactiveDays: 656, tags: ['cash flow completed'], extraTags: 0 },
  { id: 5, opportunity: 'Thomas Askew, Jr. / Indiana Crumbl - purchase 5 franchise locations', company: null, companyInitial: '', companyColor: '', contact: 'Thomas Askew, Jr.', value: null, ownedBy: 'Brad', status: 'Lost', stage: 'Review Kill / Keep', daysInStage: 209, stageUpdated: '7/29/2025', lastContacted: '2/20/2026', interactions: 255, inactiveDays: null, tags: ['cash flow completed'], extraTags: 0 },
  { id: 6, opportunity: 'Paul Leongas - Construction to End Loan Mixed-Use Bldg Chicago', company: 'Axisdevelopmentgroup', companyInitial: 'A', companyColor: '#B5651D', contact: 'Paul Leongas', value: null, ownedBy: 'Maura', status: 'Lost', stage: 'Maura Underwriting', daysInStage: 994, stageUpdated: '6/5/2023', lastContacted: '11/24/2025', interactions: 490, inactiveDays: null, tags: ['cash flow started'], extraTags: 0 },
  { id: 7, opportunity: 'Curuba Ventures - Borgzinner, Inc. Business Acq.', company: 'Curuba Ventures', companyInitial: 'C', companyColor: '#2E8B7A', contact: 'Luis Felipe Jaramillo', value: null, ownedBy: 'Wendy', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: null, stageUpdated: '11/17/2025', lastContacted: '2/17/2026', interactions: 272, inactiveDays: null, tags: ['cash flow completed'], extraTags: 0 },
  { id: 8, opportunity: 'David Grillo / Rick Patri Purchase Midwest Medical Pharmacy', company: 'Stillwater Property Group', companyInitial: 'S', companyColor: '#2E5DA8', contact: 'David Grillo', value: null, ownedBy: 'Wendy', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: 178, stageUpdated: '8/29/2025', lastContacted: '2/23/2026', interactions: 237, inactiveDays: null, tags: ['pre-approval letter issued'], extraTags: 0 },
  { id: 9, opportunity: 'Radhika Alla - PCSA SBA 7A Bus. Acq. / Pari Passu', company: null, companyInitial: '', companyColor: '', contact: 'Radhika Alla', value: null, ownedBy: 'Maura', status: 'Lost', stage: 'Review Kill / Keep', daysInStage: 103, stageUpdated: '11/12/2025', lastContacted: '1/6/2026', interactions: null, inactiveDays: null, tags: ['cash flow completed'], extraTags: 0 },
  { id: 10, opportunity: 'Michael Habib - Nationwide / Best Choice Bus Acq. Project Sky', company: 'Probus Equity', companyInitial: 'P', companyColor: '#6B4FBB', contact: 'Michael Habib', value: null, ownedBy: 'Brad', status: 'Open', stage: 'Ready for WU Approval', daysInStage: null, stageUpdated: '12/26/2025', lastContacted: '12/23/2025', interactions: null, inactiveDays: null, tags: ['cash flow completed'], extraTags: 0 },
  { id: 11, opportunity: 'Brock Vandervliet - CS Cabinetry, Inc. SBA 7A Bus. Acq.', company: null, companyInitial: '', companyColor: '', contact: 'Brock Vandervliet', value: null, ownedBy: 'Brad', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: 102, stageUpdated: '11/13/2025', lastContacted: '11/19/2025', interactions: 161, inactiveDays: null, tags: ['cash flow completed'], extraTags: 0 },
  { id: 12, opportunity: 'Brennan - 2025 Refinance Arena Lanes', company: 'Blue Bird Lanes', companyInitial: 'B', companyColor: '#C9930A', contact: 'John Brennan', value: null, ownedBy: 'Brad', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: 284, stageUpdated: '5/15/2025', lastContacted: '5/12/2025', interactions: 327, inactiveDays: 287, tags: ['cash flow completed'], extraTags: 0 },
  { id: 13, opportunity: 'Charles Stephens - Design Concrete of Nevada SBA 7A Bus. Acq.', company: 'Hanover Gate Capital', companyInitial: 'H', companyColor: '#8B2635', contact: 'Matt Gallery', value: null, ownedBy: 'Maura', status: 'Lost', stage: 'UW Paused', daysInStage: 585, stageUpdated: '7/18/2024', lastContacted: '7/15/2024', interactions: 119, inactiveDays: 588, tags: ['cash flow started'], extraTags: 0 },
  { id: 14, opportunity: 'Kirk Johnson - SBA 7A Business Acquisition', company: 'New Health Investment Group', companyInitial: 'N', companyColor: '#1A3A6B', contact: 'Kirk Johnson', value: null, ownedBy: 'Maura', status: 'Lost', stage: 'UW Paused', daysInStage: 756, stageUpdated: '1/29/2024', lastContacted: '4/5/2024', interactions: 154, inactiveDays: 690, tags: ['cash flow started'], extraTags: 0 },
  { id: 15, opportunity: 'Lake Forest Ice Arena - SBA 7A Build out on $7.3MM project', company: 'Virgil James', companyInitial: 'V', companyColor: '#2E7B8B', contact: 'Thomas Economou', value: null, ownedBy: 'Brad', status: 'Lost', stage: 'Ready for WU Approval', daysInStage: 1924, stageUpdated: '11/17/2020', lastContacted: '9/19/2024', interactions: 362, inactiveDays: 523, tags: ['cash flow completed'], extraTags: 0 },
  { id: 16, opportunity: 'Sebastion Arnold / John Godbout - Eulo & Smith Law Firm SBA 7A Bus. Acq.', company: 'Concorde Equity Partners', companyInitial: 'C', companyColor: '#2E5DA8', contact: 'Sebastien Arnold', value: null, ownedBy: 'Wendy', status: 'Lost', stage: 'Maura Underwriting', daysInStage: 509, stageUpdated: '10/2/2024', lastContacted: '2/12/2025', interactions: null, inactiveDays: 377, tags: ['cash flow started'], extraTags: 0 },
];

const SAVED_FILTERS = [
  'My Open Opportunities',
  'Open Opportunities',
  "Opportunities I'm Following",
  'Won Opportunities',
  'Brad Incoming Opportunities $10,000 & Up',
  'Deals for Initial Review',
  'Deals Moving Towards Underwriting',
  'OnBoarding 2024 - Opp. into UW Pipeline',
  'OnBoarding 2025 - Opp. into UW Pipeline',
  'OnBoarding 2026 - Opp. into UW Pipeline',
  'Pre-Approval Letters Issued',
  "Write Up's Pending Approval",
];

const BOARD_STAGES = [
  { key: 'review', name: 'Review Kill / Keep', count: 166, value: '$180,701.00', rows: SAMPLE_ROWS.filter(r => r.stage === 'Review Kill / Keep') },
  { key: 'initial', name: 'Initial Review', count: 69, value: '$0', rows: [] as OpportunityRow[] },
  { key: 'waiting', name: 'Waiting on Client to Move Forward', count: 45, value: '$81,200.00', rows: SAMPLE_ROWS.filter(r => r.stage === 'Waiting on Client to Move Forward') },
  { key: 'maura', name: 'Maura Underwriting', count: 38, value: '$540,000.00', rows: SAMPLE_ROWS.filter(r => r.stage === 'Maura Underwriting') },
  { key: 'ready', name: 'Ready for WU Approval', count: 210, value: '$1,100,000.00', rows: SAMPLE_ROWS.filter(r => r.stage === 'Ready for WU Approval') },
  { key: 'paused', name: 'UW Paused', count: 89, value: '$220,000.00', rows: SAMPLE_ROWS.filter(r => r.stage === 'UW Paused') },
];

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

const FilterItem = ({ name }: { name: string }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        background: hovered ? '#F5F3FF' : 'transparent',
      }}
    >
      <span style={{
        fontSize: '14px',
        color: '#1A1A2E',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '190px',
      }}>
        {name}
      </span>
      {hovered && (
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
          <MoreVertical size={13} color="#999" />
        </button>
      )}
    </div>
  );
};

// ─── List View ────────────────────────────────────────────────────────────────

interface ListViewProps {
  rows: OpportunityRow[];
  hoveredRow: number | null;
  setHoveredRow: (id: number | null) => void;
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
        <div style={{ padding: '12px 16px', fontSize: '13px', fontStyle: 'italic', color: '#999', textAlign: 'center' }}>
          And 12 items after
        </div>
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

const BoardView = () => (
  <div style={{ flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
    <div style={{ display: 'flex', gap: '16px', minWidth: 'max-content' }}>
      {BOARD_STAGES.map(stage => (
        <div key={stage.key} style={{ width: '280px', flexShrink: 0 }}>
          {/* Column Header */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E' }}>{stage.name}</span>
              <span style={{ fontSize: '13px', color: '#999' }}>{stage.count}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DollarSign size={13} color="#7B5EA7" />
              <span style={{ fontSize: '13px', color: '#7B5EA7', fontWeight: 500 }}>{stage.value}</span>
            </div>
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stage.rows.slice(0, 3).map(row => (
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
          </div>
        </div>
      ))}
    </div>
  </div>
);

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

// ─── Filter Panel ─────────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  {
    title: 'Activity',
    filters: [
      { label: 'Activity Type', type: 'dropdown' },
      { label: 'Interactions', type: 'range' },
      { label: 'Last Contacted', type: 'daterange' },
      { label: 'Inactive Days', type: 'range' },
    ],
  },
  {
    title: 'Pipeline',
    filters: [
      { label: 'Pipeline', type: 'dropdown', badge: '1' },
      { label: 'Stage', type: 'dropdown' },
      { label: 'Days in Stage', type: 'range' },
      { label: 'Status', type: 'dropdown' },
      { label: 'Priority', type: 'dropdown' },
    ],
  },
  {
    title: 'People',
    filters: [
      { label: 'Owned By', type: 'dropdown' },
      { label: 'Followed', type: 'dropdown' },
      { label: 'Date Added', type: 'daterange' },
      { label: 'Source', type: 'dropdown' },
      { label: 'Close Date', type: 'daterange' },
      { label: 'Loss Reason', type: 'dropdown' },
    ],
  },
  {
    title: 'Record',
    filters: [
      { label: 'Company', type: 'dropdown' },
      { label: 'Value', type: 'range' },
      { label: 'Tags', type: 'dropdown' },
    ],
  },
  {
    title: 'Text',
    filters: [
      { label: 'Name', type: 'dropdown' },
      { label: 'Description', type: 'dropdown' },
    ],
  },
  {
    title: 'Custom Fields',
    filters: [
      { label: '#UW', type: 'dropdown' },
      { label: 'Client Working with Other Lenders', type: 'dropdown' },
      { label: 'Project Stage', type: 'dropdown' },
      { label: "Weekly's", type: 'dropdown' },
    ],
  },
];

const FilterPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: open ? 0 : '-420px',
    width: '380px',
    height: '100vh',
    background: 'white',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.10)',
    zIndex: 60,
    transition: 'right 0.25s ease',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  }}>
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 16px', borderBottom: '1px solid #F0EEF0', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
        <ArrowLeft size={18} color="#666" />
      </button>
      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>Filter Opportunity</span>
    </div>

    {/* Filter Groups */}
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {FILTER_GROUPS.map((group, gi) => (
        <div key={group.title}>
          {group.filters.map((f, fi) => (
            <div
              key={f.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '44px',
                padding: '0 20px',
                borderBottom: fi < group.filters.length - 1 ? '1px solid #F5F5F5' : undefined,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', color: '#1A1A2E' }}>{f.label}</span>
                {'badge' in f && f.badge && (
                  <span style={{
                    background: '#EDE9F8',
                    color: '#3D2B6B',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 7px',
                  }}>
                    {f.badge}
                  </span>
                )}
              </div>
              {f.type === 'dropdown' ? (
                <ChevronDown size={14} color="#999" />
              ) : (
                <span style={{ fontSize: '13px', color: '#3D67F5', cursor: 'pointer' }}>
                  {f.type === 'range' ? 'Select Range' : 'Select Date Range'}
                </span>
              )}
            </div>
          ))}
          {gi < FILTER_GROUPS.length - 1 && (
            <div style={{ height: '1px', background: '#E8E6F0', margin: '0 0' }} />
          )}
        </div>
      ))}
    </div>
  </div>
);

// ─── Pipeline Settings Panel ──────────────────────────────────────────────────

const COLUMNS_TOGGLE = [
  { label: 'Opportunity', on: true, required: true },
  { label: 'Company', on: true },
  { label: 'Contact', on: true },
  { label: 'Value', on: true },
  { label: 'Owned By', on: true },
  { label: 'Tasks', on: true },
  { label: 'Status', on: true },
  { label: 'Stage', on: true },
  { label: 'Days in Stage', on: true },
  { label: 'Stage Updated', on: true },
  { label: 'Last Contacted', on: true },
  { label: 'Interactions', on: true },
  { label: 'Inactive Days', on: true },
  { label: 'Tags', on: true },
];

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  columnsOpen: boolean;
  onColumnsOpen: () => void;
  onColumnsClose: () => void;
}

const SettingsPanel = ({ open, onClose, columnsOpen, onColumnsOpen, onColumnsClose }: SettingsPanelProps) => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: open ? 0 : '-440px',
    width: '400px',
    height: '100vh',
    background: 'white',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.10)',
    zIndex: 60,
    transition: 'right 0.25s ease',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  }}>
    {/* Columns sub-panel (slides on top) */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: columnsOpen ? 0 : '-400px',
      width: '100%',
      height: '100%',
      background: 'white',
      zIndex: 10,
      transition: 'left 0.22s ease',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid #F0EEF0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onColumnsClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <ChevronLeft size={18} color="#666" />
          </button>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E' }}>Columns</span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <X size={18} color="#999" />
        </button>
      </div>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #E8E6F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #E0DFF0', borderRadius: '8px', padding: '8px 12px', background: '#F8F8FB' }}>
          <Search size={14} color="#999" />
          <input placeholder="Filter by field name" style={{ border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', width: '100%', color: '#666' }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {COLUMNS_TOGGLE.map((col, i) => (
          <div key={col.label} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '44px',
            padding: '0 20px 0 4px',
            borderBottom: i < COLUMNS_TOGGLE.length - 1 ? '1px solid #F0EEF0' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GripVertical size={14} color="#DDD" />
              <span style={{ fontSize: '14px', color: '#1A1A2E' }}>{col.label}</span>
              {'required' in col && col.required && (
                <span style={{ fontSize: '11px', color: '#999' }}>Required</span>
              )}
            </div>
            <ToggleSwitch on={col.on} disabled={'required' in col && col.required} />
          </div>
        ))}
      </div>
    </div>

    {/* Main settings content */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid #F0EEF0', flexShrink: 0 }}>
      <span style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E' }}>Pipeline Settings</span>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
        <X size={18} color="#999" />
      </button>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      {/* General */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E', marginBottom: '12px' }}>General</div>
        <div style={{ border: '1px solid #E0DFF0', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#1A1A2E' }}>Name</span>
            <input
              defaultValue="Underwriting"
              style={{ border: '1px solid #E0DFF0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: '#1A1A2E', background: 'white', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E', marginBottom: '12px' }}>Workflow</div>
        <div style={{ border: '1px solid #E0DFF0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F0EEF0' }}>
            <span style={{ fontSize: '14px', color: '#1A1A2E' }}>Record type</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <span style={{ fontSize: '13px', color: '#333' }}>Opportunity</span>
              <ChevronDown size={13} color="#999" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F0EEF0', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E' }}>Stages</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Manage pipeline stages and win probability</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#888', fontSize: '13px' }}>
              10 stages <ChevronRight size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E' }}>Sales tracking</span>
                <Info size={13} color="#CCC" />
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Use sales statuses and reports for pipeline.</div>
            </div>
            <ToggleSwitch on={true} />
          </div>
        </div>
      </div>

      {/* Customization */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E', marginBottom: '12px' }}>Customization</div>
        <div style={{ border: '1px solid #E0DFF0', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            { title: 'Board view card fields', sub: 'Choose fields to show on pipeline cards. Applies to all board views in your pipeline.', right: '2 enabled' },
            { title: 'Pipeline card flags', sub: 'Automatically flag pipeline cards that meet certain conditions.', right: '2 active' },
            { title: 'List view columns', sub: 'Choose columns to show in the list. Applies only to list views.', right: '14 enabled', action: onColumnsOpen },
            { title: 'Create a pipeline field', sub: 'Create custom pipeline fields.', right: '' },
          ].map((item, i, arr) => (
            <div
              key={item.title}
              onClick={item.action}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid #F0EEF0' : undefined,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, marginRight: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{item.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#888', fontSize: '13px', flexShrink: 0 }}>
                {item.right} <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
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

const UnderwritingPipeline = () => {
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [publicOpen, setPublicOpen] = useState(true);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<OpportunityRow | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');

  const closeAllPanels = () => {
    setSortPanelOpen(false);
    setFilterPanelOpen(false);
    setSettingsPanelOpen(false);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: '1px solid #E0DFF0', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Plus size={13} color="#7B5EA7" />
                </button>
                <button
                  onClick={() => setFiltersCollapsed(true)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: '1px solid #E0DFF0', background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={13} color="#666" />
                </button>
              </div>
            </div>

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

            {/* Active Filter Row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#EDE9F8', borderRadius: '8px', padding: '6px 12px',
              height: '36px', marginBottom: '8px', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#3D2B6B' }}>All Opportunities</span>
                <Bookmark size={12} color="#7B5EA7" fill="#7B5EA7" />
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>1,076</span>
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
              {publicOpen && SAVED_FILTERS.map(f => <FilterItem key={f} name={f} />)}
            </div>
          </div>
        )}

        {/* Collapsed toggle */}
        {filtersCollapsed && (
          <button
            onClick={() => setFiltersCollapsed(false)}
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              border: '1px solid #E0DFF0', background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              marginRight: '16px', alignSelf: 'flex-start', marginTop: '8px', flexShrink: 0,
            }}
          >
            <ChevronRight size={13} color="#666" />
          </button>
        )}

        {/* ── RIGHT PANEL: Main Content ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', height: '48px', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1A1A2E', margin: 0, whiteSpace: 'nowrap' }}>
              All Opportunities
            </h1>
            <Bookmark size={15} color="#AAAAAA" style={{ cursor: 'pointer', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '13px' }}>
              <Hash size={12} color="#AAAAAA" />
              <span>1,076 opportunities</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '13px' }}>
              <DollarSign size={12} color="#AAAAAA" />
              <span>$1,983,517.00</span>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {/* View Toggle */}
            <div style={{ display: 'flex', border: '1px solid #E0DFF0', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('list')}
                title="List View"
                style={{
                  width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none',
                  background: viewMode === 'list' ? '#EDE9F8' : 'white',
                }}
              >
                <LayoutList size={16} color={viewMode === 'list' ? '#3D2B6B' : '#999'} />
              </button>
              <button
                onClick={() => setViewMode('board')}
                title="Board View"
                style={{
                  width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none', borderLeft: '1px solid #E0DFF0',
                  background: viewMode === 'board' ? '#EDE9F8' : 'white',
                }}
              >
                <LayoutGrid size={16} color={viewMode === 'board' ? '#3D2B6B' : '#999'} />
              </button>
            </div>

            {[
              { icon: ArrowUpDown, title: 'Sort', active: sortPanelOpen, onClick: (e: React.MouseEvent) => { e.stopPropagation(); setSortPanelOpen(s => !s); setFilterPanelOpen(false); setSettingsPanelOpen(false); setAddDropdownOpen(false); } },
              { icon: Filter, title: 'Filter', active: filterPanelOpen, onClick: (e: React.MouseEvent) => { e.stopPropagation(); setFilterPanelOpen(s => !s); setSortPanelOpen(false); setSettingsPanelOpen(false); setAddDropdownOpen(false); } },
              { icon: Search, title: 'Search', active: false, onClick: () => {} },
              { icon: Settings, title: 'Pipeline Settings', active: settingsPanelOpen, onClick: (e: React.MouseEvent) => { e.stopPropagation(); setSettingsPanelOpen(s => !s); setSortPanelOpen(false); setFilterPanelOpen(false); setAddDropdownOpen(false); } },
            ].map(({ icon: Icon, title, active, onClick }) => (
              <button
                key={title}
                title={title}
                onClick={onClick}
                style={{
                  width: '36px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: '1px solid #E0DFF0', borderRadius: '8px',
                  background: active ? '#EDE9F8' : 'white',
                }}
              >
                <Icon size={16} color={active ? '#3D2B6B' : '#999'} />
              </button>
            ))}

            {/* Add Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setAddDropdownOpen(o => !o); setSortPanelOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#3D2B6B', color: 'white', border: 'none', borderRadius: '10px',
                  padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >
                <Plus size={14} />
                <ChevronDown size={12} />
              </button>
              {addDropdownOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '42px', right: 0,
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
          {viewMode === 'list' ? (
            <ListView
              rows={SAMPLE_ROWS}
              hoveredRow={hoveredRow}
              setHoveredRow={setHoveredRow}
              onRowClick={(row) => { setSelectedRow(row); setDetailTab('details'); closeAllPanels(); }}
            />
          ) : (
            <BoardView />
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

      <FilterPanel open={filterPanelOpen} onClose={() => setFilterPanelOpen(false)} />

      <SettingsPanel
        open={settingsPanelOpen}
        onClose={() => { setSettingsPanelOpen(false); setColumnsPanelOpen(false); }}
        columnsOpen={columnsPanelOpen}
        onColumnsOpen={() => setColumnsPanelOpen(true)}
        onColumnsClose={() => setColumnsPanelOpen(false)}
      />

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
