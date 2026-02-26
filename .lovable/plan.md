

## Plan: Add Color Throughout the Expanded View

The current expanded view is mostly monochrome -- gray text on white. I'll add semantic color accents to every major section to make it feel polished and alive.

### Changes (single file: `UnderwritingExpandedView.tsx`)

**1. Header** 
- Add subtle gradient background: `bg-gradient-to-r from-slate-50 to-blue-50/30`
- Avatar: gradient background `from-amber-200 to-orange-300` with a white ring
- Company name: small blue Building2 icon inline
- Deal value: emerald-600 instead of plain foreground
- Star button: amber-400 color with amber hover

**2. Stats Bar**
- Add colored icons to each stat box (blue Activity icon, violet Clock, amber/red AlertCircle, emerald TrendingUp)
- Stat values colored to match their icon
- Inactive Days turns red when > 30 days
- Light muted background: `bg-muted/30`

**3. Left Details Column**
- Section header "Deal Details" with a blue dot
- Light tinted background: `bg-muted/10`
- Pipeline field: blue Badge instead of plain text
- Stage field: colored Badge matching stage config (blue/amber/violet/emerald)
- Value: emerald-600 font color
- Owned By: blue-600 font color  
- Source: purple Badge
- Empty values: italic style

**4. Center Activity**
- Tab underline colors: blue for "Log Activity", violet for "Create Note"
- Textarea borders tinted to match active tab
- Empty state: dashed border card with a muted Activity icon and helper text

**5. Right Related Panel**
- Section header "Related" with a violet dot
- Each section icon gets a unique color (People=blue, Companies=indigo, Tasks=emerald, Files=orange, Calendar=rose, Projects=cyan, Pipeline=violet)
- Counts shown in rounded Badge pills instead of plain parentheses
- Contact and company entries get small colored avatar circles
- Stage shown as colored Badge in Pipeline Records

### Updated sub-components

- **StatBox**: gains `icon` and `color` props
- **RelatedSection**: gains `iconColor` prop; count rendered as a Badge pill
- **stageConfig**: gains `bg` and `border` fields for Badge styling

### Files modified
- `src/components/admin/UnderwritingExpandedView.tsx`

