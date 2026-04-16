import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { EditableTextBox } from '@/components/admin/shared/EditableTextBox';
import { Maximize2, PanelRightOpen, DollarSign, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────
// Single source of truth for pipeline table row design.
//
// Used by:
//   - src/pages/admin/Potential.tsx
//   - src/pages/admin/Underwriting.tsx
//   - src/pages/admin/LenderManagement.tsx
//
// Editing the design here propagates to all pipeline tables.
// Do NOT change visuals in the page files — change them here.
// ─────────────────────────────────────────────────────────────────

export type PipelineColumnVisibility = {
  company: boolean;
  contact: boolean;
  value: boolean;
  ownedBy: boolean;
  tasks: boolean;
  status: boolean;
  stage: boolean;
  daysInStage: boolean;
  stageUpdated: boolean;
  lastContacted: boolean;
  interactions: boolean;
  inactiveDays: boolean;
  tags: boolean;
};

export type PipelineColumnWidths = Record<string, number | undefined>;

type EditHandler = {
  value: string;
  onSave: (next: string) => void | Promise<void>;
};

export interface PipelineTableRowProps {
  leadId: string;

  // ── First cell ───────────────────────────────────────
  /** Which key to look up in `columnWidths` for the sticky first column. */
  firstColumnKey: 'deal' | 'opportunity';
  /** Pre-composed display name for the first cell (e.g., "Granite Law Group - SBA 7(a) #3"). */
  opportunityDisplayName: string;
  /** Name used for the CrmAvatar in the first cell. */
  avatarName: string;
  /** If provided, the first cell becomes inline-editable. */
  opportunityEdit?: EditHandler;

  // ── Standard cells ───────────────────────────────────
  companyName?: string | null;
  companyEdit?: EditHandler;
  /** Render a Building2 icon inside the company pill (LenderManagement). */
  showCompanyIcon?: boolean;

  contactName?: string | null;
  contactEdit?: EditHandler;

  /** Pre-formatted deal value for display (e.g., "$150,000"). */
  dealValueDisplay?: string | null;
  dealValueEdit?: EditHandler;

  ownerName?: string | null;
  ownerAvatarUrl?: string | null;
  /** If provided, replaces the default owner pill content (e.g., an InlineEditableCell dropdown). */
  ownerSlot?: React.ReactNode;

  taskCount?: number | null;
  statusLabel?: string | null;

  stageLabel?: string | null;
  /** If provided, replaces the default stage pill content (e.g., an InlineEditableCell dropdown). */
  stageSlot?: React.ReactNode;

  daysInStage?: number | null;
  /** Pre-formatted date string for the Stage Updated column. */
  stageUpdatedDate?: string | null;
  /** Pre-formatted date string for the Last Contacted column. */
  lastContactedDate?: string | null;
  interactionCount?: number | null;
  inactiveDays?: number | null;
  tags?: string[] | null;

  // ── UI state ─────────────────────────────────────────
  columnVisibility: PipelineColumnVisibility;
  columnWidths: PipelineColumnWidths;
  isDetailSelected: boolean;
  isBulkSelected: boolean;
  /** Tailwind padding class for vertical row padding, e.g., 'py-1.5' or 'py-0.5'. */
  rowPad?: string;

  // ── Callbacks ────────────────────────────────────────
  onRowClick: () => void;
  onToggleSelection: () => void;
  onExpand: () => void;
}

// ── Shared visual primitives ───────────────────────────
const CELL_BORDER: React.CSSProperties = { border: '1px solid #c8bdd6' };
const PILL_BASE = 'inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full';
const PILL_TEXT_PRESENT = 'text-[16px] text-[#202124] dark:text-foreground truncate';
const PILL_TEXT_EMPTY = 'text-[16px] text-muted-foreground/40';

function StaticPill({
  value,
  numeric = false,
  fallback = '—',
}: {
  value?: string | number | null;
  numeric?: boolean;
  fallback?: string;
}) {
  const hasValue = value != null && value !== '';
  return (
    <span
      className={cn(
        PILL_BASE,
        hasValue ? PILL_TEXT_PRESENT : PILL_TEXT_EMPTY,
        numeric && 'tabular-nums',
      )}
    >
      {hasValue ? String(value) : fallback}
    </span>
  );
}

/** Pill-wrapped editable cell. Shows StaticPill when no edit handler is provided. */
function EditablePill({
  display,
  edit,
  numeric = false,
  prefix,
  ariaLabel,
}: {
  display: string | null | undefined;
  edit?: EditHandler;
  numeric?: boolean;
  prefix?: React.ReactNode;
  ariaLabel?: string;
}) {
  if (!edit) {
    return <StaticPill value={display} numeric={numeric} />;
  }
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <EditableTextBox
        value={edit.value}
        onSave={edit.onSave}
        size="sm"
        placeholder="—"
        prefix={prefix}
        className={cn(
          'text-[16px] text-[#202124] dark:text-foreground px-3',
          numeric && 'tabular-nums',
        )}
        inputClassName={cn('text-[16px]', numeric && 'tabular-nums')}
        aria-label={ariaLabel}
      />
    </div>
  );
}

export function PipelineTableRow(props: PipelineTableRowProps) {
  const {
    leadId,
    firstColumnKey,
    opportunityDisplayName,
    avatarName,
    opportunityEdit,
    companyName,
    companyEdit,
    showCompanyIcon,
    contactName,
    contactEdit,
    dealValueDisplay,
    dealValueEdit,
    ownerName,
    ownerAvatarUrl,
    ownerSlot,
    taskCount,
    statusLabel,
    stageLabel,
    stageSlot,
    daysInStage,
    stageUpdatedDate,
    lastContactedDate,
    interactionCount,
    inactiveDays,
    tags,
    columnVisibility,
    columnWidths,
    isDetailSelected,
    isBulkSelected,
    rowPad = 'py-1.5',
    onRowClick,
    onToggleSelection,
    onExpand,
  } = props;

  const stickyBg = isDetailSelected
    ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
    : isBulkSelected
      ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
      : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

  const rowClassName = cn(
    'cursor-pointer transition-colors duration-100 group',
    isDetailSelected
      ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
      : isBulkSelected
        ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
        : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30',
  );

  const statusDisplay = statusLabel
    ? statusLabel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <tr key={leadId} onClick={onRowClick} className={rowClassName}>
      {/* ── Deal / Opportunity + Checkbox (sticky) ── */}
      <td
        className={cn(
          'pl-2 pr-1.5 overflow-hidden sticky left-0 z-[5] transition-colors',
          rowPad,
          stickyBg,
          isDetailSelected && 'border-l-[3px] border-l-[#3b2778]',
        )}
        style={{
          width: columnWidths[firstColumnKey],
          border: '1px solid #c8bdd6',
          boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isBulkSelected}
              onCheckedChange={onToggleSelection}
              className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
            />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
            <CrmAvatar name={avatarName} />
            {opportunityEdit ? (
              <div
                className="flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <EditableTextBox
                  value={opportunityEdit.value}
                  onSave={opportunityEdit.onSave}
                  size="sm"
                  placeholder={opportunityDisplayName}
                  className="text-[16px] text-[#202124] dark:text-foreground w-full"
                  inputClassName="text-[16px]"
                  aria-label="Opportunity name"
                />
              </div>
            ) : (
              <span className="text-[16px] text-[#202124] dark:text-foreground truncate">
                {opportunityDisplayName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
            aria-label="Open expanded view"
          >
            <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
          </button>
        </div>
      </td>

      {/* ── Company ── */}
      {columnVisibility.company && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.company, ...CELL_BORDER }}
        >
          {showCompanyIcon && companyName && !companyEdit ? (
            <span className="inline-flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
              <div className="h-6 w-6 rounded-full bg-white dark:bg-background flex items-center justify-center shrink-0">
                <Building2 className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-[16px] text-[#202124] dark:text-foreground truncate">
                {companyName}
              </span>
            </span>
          ) : (
            <EditablePill display={companyName} edit={companyEdit} ariaLabel="Company" />
          )}
        </td>
      )}

      {/* ── Contact ── */}
      {columnVisibility.contact && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.contact, ...CELL_BORDER }}
        >
          <EditablePill display={contactName} edit={contactEdit} ariaLabel="Contact" />
        </td>
      )}

      {/* ── Value ── */}
      {columnVisibility.value && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.value, ...CELL_BORDER }}
        >
          <EditablePill
            display={dealValueDisplay}
            edit={dealValueEdit}
            numeric
            prefix={
              dealValueEdit ? (
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : undefined
            }
            ariaLabel="Deal value"
          />
        </td>
      )}

      {/* ── Owner ── */}
      {columnVisibility.ownedBy && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.ownedBy, ...CELL_BORDER }}
        >
          {ownerSlot ? (
            <div
              className="inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {ownerSlot}
            </div>
          ) : ownerName ? (
            <span className="inline-flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
              <CrmAvatar name={ownerName} imageUrl={ownerAvatarUrl ?? null} size="sm" />
              <span className="text-[16px] text-[#202124] dark:text-foreground truncate">
                {ownerName}
              </span>
            </span>
          ) : (
            <StaticPill value={null} />
          )}
        </td>
      )}

      {/* ── Tasks ── */}
      {columnVisibility.tasks && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.tasks, ...CELL_BORDER }}
        >
          <StaticPill value={taskCount ?? 0} numeric />
        </td>
      )}

      {/* ── Status ── */}
      {columnVisibility.status && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.status ?? 100, ...CELL_BORDER }}
        >
          <StaticPill value={statusDisplay} />
        </td>
      )}

      {/* ── Stage ── */}
      {columnVisibility.stage && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.stage, ...CELL_BORDER }}
        >
          {stageSlot ? (
            <div
              className="inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {stageSlot}
            </div>
          ) : (
            <StaticPill value={stageLabel} />
          )}
        </td>
      )}

      {/* ── Days in stage ── */}
      {columnVisibility.daysInStage && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.daysInStage, ...CELL_BORDER }}
        >
          <StaticPill
            value={daysInStage != null ? `${daysInStage}d` : null}
            numeric
          />
        </td>
      )}

      {/* ── Stage updated ── */}
      {columnVisibility.stageUpdated && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.stageUpdated, ...CELL_BORDER }}
        >
          <StaticPill value={stageUpdatedDate} numeric />
        </td>
      )}

      {/* ── Last contacted ── */}
      {columnVisibility.lastContacted && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.lastContacted, ...CELL_BORDER }}
        >
          <StaticPill value={lastContactedDate} numeric />
        </td>
      )}

      {/* ── Interactions ── */}
      {columnVisibility.interactions && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.interactions, ...CELL_BORDER }}
        >
          <StaticPill value={interactionCount ?? 0} numeric />
        </td>
      )}

      {/* ── Inactive days ── */}
      {columnVisibility.inactiveDays && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.inactiveDays, ...CELL_BORDER }}
        >
          <StaticPill
            value={inactiveDays != null ? `${inactiveDays}d` : null}
            numeric
          />
        </td>
      )}

      {/* ── Tags ── */}
      {columnVisibility.tags && (
        <td
          className={cn('px-3 overflow-hidden', rowPad)}
          style={{ width: columnWidths.tags, ...CELL_BORDER }}
        >
          {tags && tags.length > 0 ? (
            <span className="flex items-center gap-1 flex-wrap">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">
                  +{tags.length - 2}
                </span>
              )}
            </span>
          ) : (
            <StaticPill value={null} />
          )}
        </td>
      )}

      {/* ── Detail arrow ── */}
      <td className={cn('px-2 w-10', rowPad)} style={{ ...CELL_BORDER }}>
        <PanelRightOpen
          className={cn(
            'h-4 w-4 transition-all duration-150',
            isDetailSelected
              ? 'text-[#3b2778]'
              : 'text-transparent group-hover:text-muted-foreground',
          )}
        />
      </td>
    </tr>
  );
}

export default PipelineTableRow;
