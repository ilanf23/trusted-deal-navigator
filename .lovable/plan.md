

## Remove Hardcoded Data from Feed Page

### Problem
Two pieces of hardcoded business data exist on the Feed page:

1. **Team members** in `FeedLeftPanel.tsx` -- a static array of 4 names (Evan, Brad, Maura, Wendy), where "Brad" does not even exist in the `team_members` database table
2. **Stage labels** duplicated in both `useFeedData.ts` and `FeedRightPanel.tsx` -- an incomplete map that only covers 7 of 14 pipeline stages in the `lead_status` enum

### What stays the same
- `FEED_ACTIVITY_FILTERS` (Note, Call, Email, SMS, Task, New Lead) -- these are UI configuration mapping to known activity types, not business data
- `avatarColors` in `ActivityCard.tsx` -- UI color config for initials, not business data
- Type icons, badge colors, and type labels -- UI presentation config

### Changes

**1. `src/components/feed/FeedLeftPanel.tsx`**
- Remove the hardcoded `TEAM_MEMBERS` array
- Accept a new `teamMembers` prop (fetched from DB by the parent)
- Render team avatar buttons dynamically from the prop
- Each member shows first initial, uses the same purple brand styling

**2. `src/pages/admin/PipelineFeed.tsx`**
- Add a `useQuery` call to fetch `team_members` from the database (`id, name`)
- Pass the fetched list to `FeedLeftPanel` as `teamMembers` prop

**3. `src/constants/appConfig.ts`**
- Add a single shared `STAGE_LABELS` constant covering all 14 `lead_status` enum values:
  - discovery, questionnaire, pre_qualification, document_collection, underwriting, approval, funded, lost, initial_review, moving_to_underwriting, onboarding, ready_for_wu_approval, pre_approval_issued, won

**4. `src/hooks/useFeedData.ts`**
- Remove the local `STAGE_LABELS` constant
- Import the shared one from `appConfig.ts`

**5. `src/components/feed/FeedRightPanel.tsx`**
- Remove the local `STAGE_LABELS` constant
- Import the shared one from `appConfig.ts`

### Technical Details

New prop interface for FeedLeftPanel:
```text
teamMembers: { id: string; name: string }[]
```

New constant in appConfig.ts:
```text
STAGE_LABELS = {
  discovery -> "Discovery"
  questionnaire -> "Questionnaire"
  pre_qualification -> "Pre-Qualification"
  document_collection -> "Document Collection"
  underwriting -> "Underwriting"
  approval -> "Approval"
  funded -> "Funded"
  lost -> "Lost"
  initial_review -> "Initial Review"
  moving_to_underwriting -> "Moving to UW"
  onboarding -> "Onboarding"
  ready_for_wu_approval -> "Ready for WU Approval"
  pre_approval_issued -> "Pre-Approval Issued"
  won -> "Won"
}
```

Database query in PipelineFeed:
```text
supabase.from('team_members').select('id, name').order('name')
```

Files changed: 5 files, no new tables or migrations needed.
