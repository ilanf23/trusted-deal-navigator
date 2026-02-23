

## Seed Realistic Activity Data into the Feed

### Problem
The Feed page (`/admin/evan/pipeline/feed`) already pulls from real database tables via the `useFeedData` hook, but the existing data is thin:
- `evan_communications`: 63 records, but most have `lead_id = NULL` and generic content like "Incoming call - completed"
- `lead_activities`: 0 records (empty)
- `evan_tasks`: 63 records, but many lack lead associations

The feed appears sparse and doesn't showcase the Copper CRM-style activity stream properly.

### What We'll Do

Seed ~40 realistic, time-staggered activity records into `evan_communications` that reference actual leads in the database. These will include emails, calls, and SMS messages with realistic commercial lending content, spread across the last 3 days so the feed's Today/Yesterday/Earlier grouping looks natural.

All records will reference real `lead_id` values from the 39 existing leads, and use team member names that match the existing team (Evan, Brad, Wendy, Maura, Adam).

#### Step 1: Insert Realistic Communications

Insert ~30 `evan_communications` records with:
- **Emails** (inbound/outbound): Subject lines and previews about term sheets, document requests, lender updates, financial reviews
- **Calls** (inbound/outbound): Call summaries discussing deal progress, lender feedback, client check-ins
- **SMS**: Quick follow-up messages about scheduling calls, document reminders

Each record will:
- Reference a real `lead_id` from the existing leads table
- Have a realistic `content` field (1-2 sentences of commercial lending context)
- Be timestamped across the last 3 days (today, yesterday, earlier)
- Alternate between `inbound` and `outbound` direction

#### Step 2: Insert Realistic Tasks

Insert ~10 `evan_tasks` records with lead associations:
- "Send term sheet to [Lead Name]"
- "Follow up on document collection for [Company]"
- "Schedule lender call for [Deal]"

Each linked to a real `lead_id`.

### No Code Changes Needed

The `useFeedData` hook and `FeedCenter`/`ActivityCard` components already handle this data correctly. Once the database has rich data, the feed will populate automatically with:
- Proper actor names (derived from team member assignments)
- Lead names and companies
- Type badges (Email, Call, SMS, Task, Note)
- Today/Yesterday/Earlier grouping
- Content previews

The old `feedMockData.ts` file (which is no longer imported by the feed page) can be left as-is since it's unused.

### Technical Details

- All inserts go to existing tables with existing RLS policies (admin-only)
- No schema changes required
- No new files or hooks needed
- The `useFeedData` hook's 30-second refetch interval will pick up new data automatically
