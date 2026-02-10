

# Partner Tracking System

## Overview
Build a tracking system that links each partner (user with partner role) to one or more referrals, with a dedicated "Tracking" page in the partner portal. This creates the foundation for later pipeline integration.

## Current State
- `partner_referrals` table already links referrals to partners via `partner_id` (the user's auth ID)
- `partner_commissions` and `partner_referral_status_history` tables exist
- `profiles` table stores partner profile info (company, contact, etc.)
- No dedicated "Tracking" page exists -- referrals are listed on the Referrals page but without a partner-centric tracking view

## What Will Be Built

### 1. New Database Table: `partner_tracking`
A join/tracking table that explicitly links partners to referrals with additional tracking metadata useful for pipeline integration later.

```text
partner_tracking
- id (uuid, PK)
- partner_id (uuid, NOT NULL)       -- the partner user
- referral_id (uuid, NOT NULL)      -- linked referral
- tracking_status (text, default 'active')  -- active, paused, closed
- priority (text, default 'normal')         -- low, normal, high
- internal_notes (text, nullable)           -- partner's private notes
- last_contacted_at (timestamptz, nullable)
- next_follow_up (date, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
```

RLS policies:
- Partners can SELECT, INSERT, UPDATE, DELETE their own records
- Admins have full access

### 2. New Page: `/partner/tracking`
A dedicated tracking dashboard showing all linked referrals in a table/card view with:
- Referral name, company, status, loan type, and amount
- Tracking-specific fields: priority, next follow-up date, internal notes
- Ability to link an existing referral to tracking
- Inline editing of priority, follow-up date, and notes
- Filter/sort by priority or follow-up date

### 3. Sidebar Update
Add a "Tracking" nav item (with a `Target` or `Crosshair` icon) to `PartnerSidebar.tsx` between "My Referrals" and "Commissions".

### 4. Route Registration
Add `/partner/tracking` route inside the existing `PartnerRouteLayout` group in `App.tsx`.

## Technical Details

### Files to Create
- `src/pages/partner/Tracking.tsx` -- Main tracking page component

### Files to Modify
- `src/components/partner/PartnerSidebar.tsx` -- Add nav item
- `src/App.tsx` -- Add route

### Database Migration
- Create `partner_tracking` table with RLS policies
- Enable realtime on the table for live updates

### UI Components Used
- Existing: Card, Badge, Button, Dialog, Input, Select, Table components
- The tracking page will show a table of tracked referrals with inline-editable fields (priority dropdown, follow-up date picker, notes)
- "Link Referral" dialog lets the partner pick from their unlinked referrals to add to tracking

