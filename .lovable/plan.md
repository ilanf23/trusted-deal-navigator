

# Track Whether Features Have Been Built

## Current State
The Module Tracker currently uses the `business_requirements.status` field (draft/approved/implemented/verified) to approximate whether a feature is "built." Toggling a feature checkbox flips between `draft` and `verified`, which overwrites the requirement's workflow status and loses intermediate states (e.g., a feature marked "approved" gets reset to "draft" when unchecked).

## Solution
Add a dedicated `is_built` boolean column to the `business_requirements` table. This cleanly separates "has this feature been built?" from the requirement workflow status (draft/approved/implemented/verified), so both can be tracked independently.

## Changes

### 1. Database Migration
- Add `is_built` boolean column to `business_requirements`, defaulting to `false`
- Backfill: set `is_built = true` for any existing rows where `status = 'verified'`

### 2. ModuleCard.tsx
- Update the `ModuleFeature` interface to include `is_built: boolean`
- Change progress calculation to count `is_built` instead of `status === 'verified'`
- Update the checkbox toggle to update `is_built` (not `status`) in the database
- Keep the "Built" badge tied to `is_built`

### 3. ModuleTracker.tsx (parent page)
- Update the feature mapping to pass `is_built` from requirements data into `ModuleFeature`
- Update `handleFeatureStatusChange` to handle `is_built` changes
- Update the "Open Requirements" stat to optionally reflect build status

### 4. RequirementsTable.tsx
- Add a "Built" column with a toggleable checkbox
- Allow toggling `is_built` directly from the table without changing the requirement status
- Add a "Built" filter option in the toolbar

### 5. ModuleDetailDialog.tsx
- In the Requirements tab, show a "Built" checkbox next to each requirement
- Allow toggling `is_built` from the detail dialog

## Technical Details

```text
business_requirements table
+------------------+
| existing columns |
| ...              |
| + is_built bool  |  <-- NEW: defaults to false
+------------------+
```

The `is_built` field is independent of `status`. A requirement can be:
- status: "approved", is_built: false (approved but not yet built)
- status: "approved", is_built: true (approved and built)
- status: "verified", is_built: true (fully verified and built)

No new tables or edge functions needed -- this is a single column addition with UI updates across 4 component files.

