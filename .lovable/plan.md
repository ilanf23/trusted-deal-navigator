

## Restore "New Lead" Filter (Keep UI, No Data)

### What Changed
The last edit removed both the "New Lead" activity data **and** the filter. You want to keep the filter button visible but just not fetch any lead_created data from the database.

### Changes

**`src/hooks/useFeedData.ts`**
- Add `'lead_created'` back to the `FeedActivityType` union type
- Add `'New Lead'` back to the `FEED_ACTIVITY_FILTERS` array
- Do NOT re-add the database fetching logic (keep it removed)

**`src/pages/admin/PipelineFeed.tsx`**
- Add `'New Lead': ['lead_created']` back to the `typeMap` object in the filter logic

**`src/components/feed/ActivityCard.tsx`**
- Restore the `lead_created` cases in the icon, badge color, and label switch statements

**`src/components/feed/FeedCenter.tsx`**
- Add `a.type === 'lead_created'` back to the "notes" tab filter

This way the filter appears in the UI but shows the empty state since no `lead_created` activities are ever pushed into the array.

