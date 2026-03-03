

## Plan: Sanitize File Names in Upload Handlers

### Problem
Three upload handlers embed `file.name` directly into the storage key. Filenames with spaces or special characters (e.g., `Screenshot 2026-02-27 at 12.13.05 PM.png`) cause storage rejection.

`LeadFilesSection.tsx` already avoids this by using `crypto.randomUUID() + extension`, but the other three do not.

### Changes

**1. Add `sanitizeFileName` utility to `src/lib/utils.ts`**
```ts
export function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
}
```

**2. Fix `PipelineExpandedView.tsx` (line 557)**
```ts
// Before
const filePath = `${leadId}/${Date.now()}_${file.name}`;
// After
const filePath = `${leadId}/${Date.now()}_${sanitizeFileName(file.name)}`;
```

**3. Fix `UnderwritingExpandedView.tsx` (line 709)**
Same pattern — wrap `file.name` with `sanitizeFileName()`.

**4. Fix `PeopleExpandedView.tsx` (line 752)**
Same pattern — wrap `file.name` with `sanitizeFileName()`.

**5. Fix `LeadFilesSection.tsx` (line 108)**
Already safe (uses UUID), but for consistency, sanitize the extension:
```ts
const safeName = sanitizeFileName(file.name);
const filePath = `${leadId}/${crypto.randomUUID()}_${safeName}`;
```
This also preserves the original filename in the path for easier debugging.

### Files to Modify
- `src/lib/utils.ts` — add `sanitizeFileName`
- `src/components/admin/PipelineExpandedView.tsx` — import + use
- `src/components/admin/UnderwritingExpandedView.tsx` — import + use
- `src/components/admin/PeopleExpandedView.tsx` — import + use
- `src/components/admin/LeadFilesSection.tsx` — import + use (consistency)

No database or migration changes needed.

