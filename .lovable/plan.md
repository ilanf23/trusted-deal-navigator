

## Plan: Add Color Throughout the Expanded View

The file currently has zero color enhancements — everything is monochrome gray/foreground. I'll add semantic colors to every section in a single file edit.

### Changes (single file: `src/components/admin/UnderwritingExpandedView.tsx`)

**1. Add imports** — `Activity, Clock, AlertCircle, TrendingUp` from lucide-react for stat icons.

**2. Expand `stageConfig`** — Add `bg` and `borderColor` fields for Badge rendering:
- `moving_to_underwriting`: blue bg/border
- `underwriting`: amber bg/border
- `ready_for_wu_approval`: violet bg/border
- `pre_approval_issued`: emerald bg/border

**3. Update `StatBox`** — Add `icon` (ReactNode) and `color` (string) props. Render colored icon next to colored value.

**4. Update `RelatedSection`** — Add `iconColor` prop. Render count as a small rounded Badge pill instead of plain `(n)` text.

**5. Header bar** (line 206):
- Gradient background: `bg-gradient-to-r from-slate-50/80 to-blue-50/40 dark:from-slate-900/50 dark:to-blue-950/30`
- Avatar: gradient `bg-gradient-to-br from-amber-200 to-orange-300` with `ring-2 ring-white`
- Company name: inline `Building2` icon in blue
- Deal value: `text-emerald-600`
- Star button: `text-amber-400 hover:text-amber-500`

**6. Stats bar** (line 232):
- Background: `bg-muted/30`
- Each StatBox gets a colored icon:
  - Interactions: blue `Activity` icon
  - Last Contacted: violet `Clock` icon
  - Inactive Days: amber (or red if >30) `AlertCircle` icon
  - Days in Stage: emerald `TrendingUp` icon

**7. Left details column** (line 243):
- Background tint: `bg-muted/10`
- Pipeline value: blue Badge
- Stage select trigger: colored border matching stage
- Value: `text-emerald-600 font-semibold`
- Owned By: `text-blue-600`
- Source: purple Badge (or italic dash if empty)
- Empty values: `italic` style

**8. Center activity tabs** (lines 304-329):
- Log Activity active: `border-blue-500 text-blue-600`
- Create Note active: `border-violet-500 text-violet-600`
- Textarea focus borders: `focus-visible:border-blue-400` / `focus-visible:border-violet-400`
- Empty state: dashed border card with muted icon

**9. Right related panel** (lines 372-418):
- Each section's icon gets a unique color class passed via `iconColor`:
  - People: `text-blue-500`
  - Companies: `text-indigo-500`
  - Tasks: `text-emerald-500`
  - Files: `text-orange-500`
  - Calendar: `text-rose-500`
  - Projects: `text-cyan-500`
  - Pipeline Records: `text-violet-500`
- Pipeline Records stage rendered as colored Badge

### Files modified
- `src/components/admin/UnderwritingExpandedView.tsx`

