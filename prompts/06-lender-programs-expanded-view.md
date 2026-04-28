# Prompt: Rebuild LenderExpandedView to match the standard expanded-view pattern

## Context

The `LenderExpandedView` component (used at `/superadmin/lender-programs/expanded-view/:lenderId` and `/admin/lender-programs/expanded-view/:lenderId`) is structurally inconsistent with every other expanded view in the app. All other expanded views — `PipelineExpandedView`, `UnderwritingExpandedView`, `LenderManagementExpandedView`, `PeopleExpandedView`, `CompanyExpandedView`, `ProjectExpandedView`, `VolumeLogExpandedView` — share a common 3-column layout, shared components, activity timeline, and toolbar pattern. `LenderExpandedView` is a one-off single-column layout with breadcrumb header, top-level tabs, and a custom `EditableCardField` component that exists nowhere else in the codebase.

This prompt rebuilds `src/components/admin/LenderExpandedView.tsx` to match the standard pattern, with documented caveats for the fields that are unique to `lender_programs`.

## Source of truth — read these first

Before changing anything, read these files end-to-end. They define the standard pattern:

1. `src/components/admin/PipelineExpandedView.tsx` — the canonical reference for the 3-column layout, activity timeline, email thread integration, and team-member filter.
2. `src/components/admin/LenderManagementExpandedView.tsx` — the closest analog (also lender-related, also uses the standard pattern).
3. `src/components/admin/CompanyExpandedView.tsx` — the closest analog for a non-deal entity (not in a sales pipeline, but uses the standard 3-column layout).
4. `src/components/admin/ExpandedLeftColumn.tsx` — the shared left column used by all three deal pipelines. We will NOT use this directly because `lender_programs` isn't a deal table, but we will mirror its toolbar and field-stacking patterns.
5. `src/components/admin/InlineEditableFields.tsx` — shared `StackedEditableField`, `StackedSelectField`, `StackedOwnerField`, `StackedReadOnlyField`, `StackedToggleField`, `EditableTags`, `EditableNotesField`. These are the standard field components. Use them, do not write a custom `EditableCardField`.
6. `src/components/admin/shared/LeadRelatedSidebar.tsx` — the shared right sidebar.
7. `src/components/admin/shared/useInlineSave.ts` — shared inline-save hook with undo support.
8. `src/components/admin/CrmAvatar.tsx` — the standard avatar component used in every other view.
9. The current broken file: `src/components/admin/LenderExpandedView.tsx`.

## What's wrong with the current implementation

| # | Current behavior | Should be |
|---|---|---|
| 1 | Single-column full-width layout | 3-column layout: LEFT (details) / CENTER (activity) / RIGHT (related sidebar) |
| 2 | Top breadcrumb header (`Lender Programs / [name]`) | Mini Toolbar inside the left column with X close, Follow, Copy link, More menu (Delete) |
| 3 | Identity strip with inline Email/Call buttons in the page header | `CrmAvatar` + name in the left column header, with click-to-call/email on the Primary Contact rows |
| 4 | Top-level tabs (Overview / Notes) | No top-level tabs. Activity tabs (Log Activity / Create Note) live in the CENTER column. |
| 5 | Custom `EditableCardField` component (defined inline in this file) | Use the shared `StackedEditableField`, `StackedSelectField`, `StackedReadOnlyField`, `StackedToggleField` from `./InlineEditableFields` |
| 6 | Custom `SectionHeader` and Card-based grouping ("Contact Info", "Program Details", "Activity") | Stacked field labels on the left column, no grouping cards. The visual grouping comes from spacing (`space-y-6`) |
| 7 | Notes tab is a single textarea | Activity timeline with: stats card, Log Activity / Create Note tabs, Earlier timeline with team-member + activity-type filters, comment threading on each activity |
| 8 | No follow/unfollow | Follow button in mini toolbar, hits `entity_followers` table with `entity_type: 'lender_programs'` |
| 9 | No copy-link button | Copy-link button in mini toolbar |
| 10 | No delete capability | Delete in More menu, with confirmation dialog |
| 11 | No undo support | Every save registers an undo via `useUndo()` from `@/contexts/UndoContext` |
| 12 | No `AdminTopBarSearch` integration | Mount `AdminTopBarSearch` via `useAdminTopBar()` |
| 13 | No related sidebar | Right sidebar with related deals (from `lender_management` where this lender was used), related contacts at this lender, files, tasks |
| 14 | No activity logging | `activities` table inserts with `entity_id: lenderId`, `entity_type: 'lender_programs'` |
| 15 | No email thread integration | Pull Gmail threads where the lender's email is in `from:` or `to:` |
| 16 | No `Skeleton` pattern matches the standard | Standard skeleton wrapper |
| 17 | Page mounted at `h-full` | Mount at `h-[calc(100vh-3.5rem)]` like every other expanded view |
| 18 | No `data-full-bleed` attribute | Add `data-full-bleed` so the layout escapes the admin shell padding |

## What to build

### File: `src/components/admin/LenderExpandedView.tsx` (full rewrite)

#### 1. Imports

Match `LenderManagementExpandedView.tsx` for imports. You will need:

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X, ChevronDown, ChevronRight, ChevronUp, Users, Building2, CheckSquare, FileText,
  CalendarDays, Plus, MessageSquare, Pencil, Activity, Clock, AlertCircle,
  User, Mail, Phone, PhoneCall, Briefcase, Loader2, DollarSign, Globe,
  Tag, Search, Check, List, Copy, MoreHorizontal, Trash2, UserPlus, UserCheck,
} from 'lucide-react';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useCall } from '@/contexts/CallContext';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { useLeadEmailCompose } from '@/hooks/useLeadEmailCompose';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import LeadRelatedSidebar from '@/components/admin/shared/LeadRelatedSidebar';
import {
  StackedEditableField, StackedSelectField, StackedOwnerField, StackedReadOnlyField,
  StackedToggleField, EditableTags, EditableNotesField, formatPhoneNumber,
} from './InlineEditableFields';
import { differenceInDays, parseISO, format } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import type { LenderProgram } from './LenderDetailPanel';
```

#### 2. Container shell

Match `LenderManagementExpandedView`:

```tsx
return (
  <>
    <div data-full-bleed className="lender-expanded-view system-font flex flex-col bg-background md:overflow-hidden overflow-y-auto h-[calc(100vh-3.5rem)]">
      <style>{`
        .lender-expanded-view,
        .lender-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
        .lender-expanded-view [data-radix-scroll-area-viewport] {
          overflow-x: hidden !important;
        }
      `}</style>
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">
        {/* LEFT, CENTER, RIGHT */}
      </div>
    </div>
    <GmailComposeDialog {...composeDialogProps} />
  </>
);
```

#### 3. LEFT column — Lender Details

Width and styling MUST match the other expanded views exactly:

```tsx
<ScrollArea className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] md:shrink-0 md:min-w-[204px] min-w-0 border-b md:border-b-0 md:border-r border-border bg-card overflow-hidden">
  <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">
    {/* Mini toolbar */}
    {/* Header */}
    {/* Stacked fields */}
  </div>
</ScrollArea>
```

##### 3a. Mini toolbar (matches `ExpandedLeftColumn.tsx` lines 330-409)

```tsx
<div className="flex items-center justify-between -ml-1 -mr-1">
  <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Close">
    <X className="h-5 w-5" />
  </Button>
  <div className="flex items-center gap-1.5">
    <Button
      onClick={() => toggleFollowMutation.mutate()}
      disabled={!teamMemberId || toggleFollowMutation.isPending}
      className="h-8 rounded-full px-4 text-sm font-medium gap-1.5 bg-[#3b2778] hover:bg-[#2e1f5e] text-white"
    >
      {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
    <Button variant="ghost" size="icon" onClick={handleCopyLink} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Copy link">
      <Copy className="h-4 w-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="h-3.5 w-3.5 mr-2" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleFollowMutation.mutate()}>
          {isFollowing ? <UserCheck className="h-3.5 w-3.5 mr-2" /> : <UserPlus className="h-3.5 w-3.5 mr-2" />}
          {isFollowing ? 'Unfollow' : 'Follow'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Record
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

The follow toggle wires `entity_followers` with `entity_type: 'lender_programs'`. Copy the `useQuery` + `useMutation` pattern from `ExpandedLeftColumn.tsx` lines 192-238 — only the `entity_type` literal changes.

##### 3b. Header (matches `CompanyExpandedView.tsx` lines 885-899)

```tsx
<div className="flex items-start gap-4">
  <CrmAvatar name={lender.lender_name} size="xl" />
  <div className="min-w-0 flex-1 pt-0.5">
    <h2 className="text-xl font-semibold text-foreground break-words leading-tight">{lender.lender_name}</h2>
    {lender.contact_name && (
      <p className="text-sm text-muted-foreground mt-0.5 break-words">{lender.contact_name}</p>
    )}
    <div className="mt-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
        <Briefcase className="h-3 w-3" />
        Lender Program
      </span>
    </div>
  </div>
</div>
```

##### 3c. Stacked fields

Use `StackedEditableField` for every editable text field. Use `StackedSelectField` for any field that has a fixed option set. Use `StackedReadOnlyField` for `Created`. The shared field components require a `tableName` prop — pass `'lender_programs' as any` or extend the types if needed (CAVEAT: these components currently type `tableName` against the deal pipeline tables; you may need to widen the union to include `'lender_programs'` and `'companies'` and `'people'` — check if Company and People expanded views already do this and follow their pattern).

**Field order — replicate the natural CRM order:**

```tsx
{/* Lender Name */}
<StackedEditableField label="Lender Name" value={lender.lender_name ?? ''} field="lender_name" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Program Name */}
<StackedEditableField label="Program Name" value={lender.program_name ?? ''} field="program_name" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Lender Type */}
<StackedEditableField label="Lender Type" value={lender.lender_type ?? ''} field="lender_type" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Program Type */}
<StackedEditableField label="Program Type" value={lender.program_type ?? ''} field="program_type" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Tags */}
<div>
  <label className="text-sm text-muted-foreground block mb-3">Tags</label>
  <EditableTags tags={lender.tags ?? []} leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
</div>

{/* Primary Contact card — replicate ExpandedLeftColumn.tsx lines 477-513 */}
<div>
  <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
  <div className="border-b border-border pb-3">
    <div className="flex items-start gap-3 px-1 py-1.5">
      <CrmAvatar name={lender.contact_name ?? lender.lender_name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-base text-foreground break-words">{lender.contact_name ?? '—'}</p>
        {lender.lender_type && <p className="text-xs text-muted-foreground break-words">{lender.lender_type}</p>}
      </div>
    </div>
    {lender.phone && (
      <button
        type="button"
        onClick={() => handleCallPhone(lender.phone!)}
        className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
      >
        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
        <span className="text-sm text-foreground min-w-0 flex-1 whitespace-nowrap">{formatPhoneNumber(lender.phone)}</span>
      </button>
    )}
    {lender.email && (
      <button
        type="button"
        onClick={() => openCompose({ to: lender.email!, recipientName: lender.contact_name ?? lender.lender_name })}
        className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
      >
        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
        <span className="text-sm text-foreground break-all min-w-0 flex-1">{lender.email}</span>
      </button>
    )}
  </div>
</div>

{/* Loan Types */}
<StackedEditableField label="Loan Types" value={lender.loan_types ?? ''} field="loan_types" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Loan Size */}
<StackedEditableField label="Loan Size" value={lender.loan_size_text ?? ''} field="loan_size_text" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Interest Range */}
<StackedEditableField label="Interest Range" value={lender.interest_range ?? ''} field="interest_range" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Term */}
<StackedEditableField label="Term" value={lender.term ?? ''} field="term" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* States */}
<StackedEditableField label="States" value={lender.states ?? ''} field="states" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Lender Specialty */}
<StackedEditableField label="Lender Specialty" value={lender.lender_specialty ?? ''} field="lender_specialty" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Looking For */}
<StackedEditableField label="Looking For" value={lender.looking_for ?? ''} field="looking_for" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Location */}
<StackedEditableField label="Location" value={lender.location ?? ''} field="location" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Owner */}
{ownerOptions.length > 0 ? (
  <StackedOwnerField label="Owner" value={lender.assigned_to ?? ''} displayValue={assignedName} options={ownerOptions} onChange={(v) => { void handleOwnerChange(v); }} />
) : (
  <StackedReadOnlyField label="Owner" value={assignedName} />
)}

{/* Call Status */}
<StackedEditableField label="Call Status" value={lender.call_status ?? ''} field="call_status" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Last Contact */}
<StackedEditableField label="Last Contact" value={lender.last_contact ?? ''} field="last_contact" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Next Call */}
<StackedEditableField label="Next Call" value={lender.next_call ?? ''} field="next_call" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

{/* Description (notes-style) */}
<div>
  <label className="text-sm text-muted-foreground block mb-3">Description</label>
  <EditableNotesField value={lender.description ?? ''} field="description" leadId={lender.id} placeholder="Add a description" onSaved={handleFieldSaved} tableName="lender_programs" />
</div>

{/* Created */}
<StackedReadOnlyField label="Created" value={formatDate(lender.created_at)} locked />
```

**CAVEATS — fields that DO NOT apply to lender_programs (do not add):**

- `Status` (Open/Won/Lost/Abandoned) — `lender_programs` is not a deal record, so no deal outcome
- `Priority` — no `deal_priority` column on `lender_programs`
- `Win Percentage` + AI scoring — Potential pipeline only
- `Pipeline switcher` (`PipelineSelectField`) — `lender_programs` isn't part of the deal pipeline
- `Stage` (`loan_stage`) — no pipeline stage concept
- `CLX File Name` — deal-only
- `Waiting On` — deal-only
- `Value` (`deal_value`) — deal-only
- `Close Date` — deal-only
- `Source` — deal-only
- `Loss Reason` — deal-only
- `Visibility` — keep this if you want, but it's typically a deal-record field
- `Bank Relationships` — deal-only
- `Client Working with Other Lenders` toggle — deal-only
- `Weekly's` toggle — deal-only

If you decide any of those fields actually exist on `lender_programs` after checking the schema, add them. Otherwise leave them out — do NOT add empty placeholder fields.

#### 4. CENTER column — Activity timeline

Replicate `LenderManagementExpandedView.tsx` (or `PipelineExpandedView.tsx`) center column EXACTLY, with these substitutions:

- `entity_type: 'lender_programs'` everywhere `entity_type: 'lender_management'` appears
- `lender_programs` table reference everywhere `lender_management` appears
- Query keys: `['lender-program-activities', lenderId]`, `['lender-program-emails', lenderId]`, etc.

The center column needs:

1. **Stats card (3 columns):** Interactions count, Last Contacted (formatted short date), Inactive Days. Pull from `last_contact` and the activities count.

2. **Activity tabs (Log Activity / Create Note):** Identical to `PipelineExpandedView.tsx` lines 897-1018. Inserts to `activities` table with `entity_id: lenderId, entity_type: 'lender_programs'`.

3. **Earlier timeline:** Identical to `PipelineExpandedView.tsx` lines 1019-1300. Pull activities from `activities` table where `entity_id = lenderId AND entity_type = 'lender_programs'`. Pull Gmail threads where lender's email is in the search query. Merge and sort newest-first. Filter by team member + activity type. Comment threading via `activity_comments` table.

#### 5. RIGHT column — Related sidebar

```tsx
<LeadRelatedSidebar
  entityId={lender.id}
  entityType="lender_programs"
  // Pass additional props per LeadRelatedSidebar's API — check the file for the
  // exact prop signature, since this skill author hasn't read its full implementation
/>
```

**CAVEAT:** Read `src/components/admin/shared/LeadRelatedSidebar.tsx` first. If it doesn't accept `entity_type: 'lender_programs'`, extend its type union. The right sidebar should show:

- **Related Deals** — query `lender_management` table where the lender was used (check schema for the FK — likely `lender_program_id` or via a join table)
- **Related People** — query `people` table where `company_name` matches `lender.lender_name`
- **Related Files** — `lender_files` table (or whatever the equivalent is — check schema)
- **Related Tasks** — `tasks` table where description references `lender.id`

If `LeadRelatedSidebar` is too tightly coupled to deal pipelines and can't be reused, render the related sections inline using the same `RelatedSection` collapsible pattern shown in `PipelineExpandedView.tsx` lines 152-185.

#### 6. Hooks and handlers

```tsx
const { lenderId } = useParams<{ lenderId: string }>();
const navigate = useNavigate();
const queryClient = useQueryClient();
const { registerUndo, isUndoingRef } = useUndo();
const { setSearchComponent } = useAdminTopBar();
const [searchTerm, setSearchTerm] = useState('');
const { teamMember } = useTeamMember();
const { data: teamMembers = [] } = useAssignableUsers();
const { makeOutboundCall } = useCall();
const { openCompose, dialogProps: composeDialogProps } = useLeadEmailCompose({
  leadId: lenderId,
  tableName: 'lender_programs' as any, // widen the type in the hook if needed
});
const { data: gmailConnection } = useGmailConnection();

const handleCallPhone = useCallback((phone: string) => {
  void makeOutboundCall(phone, lenderId, undefined);
}, [makeOutboundCall, lenderId]);

useEffect(() => {
  setSearchComponent(<AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />);
  return () => setSearchComponent(null);
}, [searchTerm]);

const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
  queryClient.invalidateQueries({ queryKey: ['lender-program-expanded', lenderId] });
  queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
  if (!isUndoingRef.current) toast.success('Updated');
}, [lenderId, queryClient, isUndoingRef]);

const handleOwnerChange = useCallback(async (newOwnerId: string) => {
  if (!lenderId) return;
  const previousOwner = lender?.assigned_to ?? null;
  const { error } = await supabase.from('lender_programs').update({ assigned_to: newOwnerId || null }).eq('id', lenderId);
  if (error) { toast.error('Failed to save'); return; }
  registerUndo({
    label: 'Owner changed',
    execute: async () => {
      const { error: e } = await supabase.from('lender_programs').update({ assigned_to: previousOwner || null }).eq('id', lenderId);
      if (e) throw e;
      handleFieldSaved('assigned_to', previousOwner ?? '');
    },
  });
  handleFieldSaved('assigned_to', newOwnerId);
}, [lenderId, lender?.assigned_to, registerUndo, handleFieldSaved]);

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  } catch {
    toast.error('Could not copy link');
  }
};

function goBack() {
  navigate(-1);
}
```

#### 7. Delete confirmation dialog

Match the pattern in other expanded views — show a confirmation Dialog before hard-deleting. After delete, navigate back to `/admin/lender-programs`.

#### 8. Loading + not-found states

Match `LenderManagementExpandedView`:

```tsx
if (isLoading || !lender) {
  return (
    <div className="flex items-center justify-center h-full">
      <Skeleton className="h-12 w-64" />
    </div>
  );
}
```

## Type widening — likely needed

The shared `InlineEditableFields` components (`StackedEditableField`, etc.) and the `useLeadEmailCompose` hook probably constrain their `tableName` prop to the deal pipeline tables (`'potential' | 'underwriting' | 'lender_management'`). To avoid `any`-casting, widen those unions to include `'lender_programs'` (and `'companies'`, `'people'` if they aren't already there). Check `CompanyExpandedView` and `PeopleExpandedView` for the precedent — they likely already had to do this.

## Verification checklist

After the rewrite, confirm visually that the Lender Programs expanded view matches `LenderManagementExpandedView` in every structural way:

- [ ] 3-column layout at desktop, stacks vertically on mobile
- [ ] Left column width: 255px / 323px / 408px at md / lg / xl breakpoints
- [ ] Mini toolbar with X (left) + Follow + Copy + More (right)
- [ ] CrmAvatar in header (not a Building2 icon in a colored circle)
- [ ] Entity-type pill below the name ("Lender Program")
- [ ] All fields use the stacked label-on-top pattern from `InlineEditableFields`, NOT the icon-card pattern
- [ ] Primary Contact card with click-to-call + click-to-email buttons that actually wire through `useCall` and `useLeadEmailCompose`
- [ ] Center column has Stats card, Log Activity / Create Note tabs, Earlier timeline with team-member filter and activity-type filter
- [ ] Right column has related deals, related contacts, related files, related tasks
- [ ] Every save registers an undo
- [ ] AdminTopBarSearch is mounted in the top bar
- [ ] Follow/unfollow works against `entity_followers` with `entity_type: 'lender_programs'`
- [ ] Copy link works
- [ ] Delete with confirmation dialog works
- [ ] No top-level Overview/Notes tabs (those are gone)
- [ ] No breadcrumb header at the top of the page
- [ ] No top-level Email/Call buttons in the page header (they live on the Primary Contact card now)
- [ ] Routes still work: `/superadmin/lender-programs/expanded-view/:lenderId` and `/admin/lender-programs/expanded-view/:lenderId`

## Out of scope

- Do not touch `LenderDetailPanel.tsx`, `LenderFilterPanel.tsx`, `LenderProgramAssistant.tsx`, or `src/pages/admin/LenderPrograms.tsx`. The list view and the side panel stay as they are. This prompt is only for the full-page expanded view.
- Do not change the `lender_programs` table schema. Work with what's there.
- Do not change the routing — the routes already exist in `App.tsx` lines 159-160 and 204-205.

## Definition of done

The rewritten `LenderExpandedView.tsx` is structurally indistinguishable from `LenderManagementExpandedView.tsx` (same 3-column layout, same toolbar, same activity timeline, same related sidebar) — with the only differences being the field set (program-specific fields instead of deal fields) and the absence of pipeline/deal-outcome/priority/win-percentage controls.
