

## Plan: Seed 5-10 Fake Activities for Every Lead and Person

### Current State
- **39 leads** total — only 11 have activities, **28 leads have zero activities**
- **20 people** total — **all 20 have zero activities**

### What Needs to Happen

**1. Seed `lead_activities` for 28 leads missing data**
- Insert 5-8 varied activities per lead (mix of `call`, `email`, `note` types)
- Realistic commercial lending content (intro calls, document requests, term sheets, credit reviews, follow-ups)
- Timestamps spread across the last 1-30 days
- `created_by` set to "Evan"

**2. Seed `people_activities` for all 20 people**
- Insert 5-8 activities per person (mix of `call`, `email`, `note`, `meeting` types)
- Content appropriate to contact/lender context (check-ins, program updates, referral discussions)
- Timestamps spread across the last 1-30 days

**3. Execution approach**
- Use the database insert tool to run batch INSERT statements
- Split into multiple batches to stay within query limits
- No schema changes needed — both tables already exist with correct columns and RLS policies

### Scope
- ~28 leads × ~7 activities = ~196 new `lead_activities` rows
- ~20 people × ~7 activities = ~140 new `people_activities` rows
- Total: ~336 new records

