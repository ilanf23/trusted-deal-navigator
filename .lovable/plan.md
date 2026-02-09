

# Partner Dashboard - Referral Submission, Tracking, and Commissions

## Overview

Create a new "Partner" user role and dashboard at `/partner` where external partners can sign up, submit referrals (leads), track their referral status in real time as deals move through pipeline stages, and view earned commissions.

---

## 1. Database Changes

### New role: `partner`

Add `'partner'` to the existing `app_role` enum so partners get their own role distinct from `admin` and `client`.

### New tables

#### `partner_referrals`
Stores each referral a partner submits. Links to the `leads` table once the admin team processes it.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| partner_id | uuid (NOT NULL) | The auth user ID of the partner |
| lead_id | uuid (nullable, FK -> leads) | Linked once admin creates/matches a lead |
| name | text | Referral contact name |
| email | text | |
| phone | text | |
| company_name | text | |
| loan_amount | numeric | |
| loan_type | text | e.g. CRE, Business Acquisition, Working Capital |
| property_address | text | |
| urgency | text | e.g. Urgent, Standard, No Rush |
| notes | text | |
| status | text | `submitted`, `in_review`, `approved`, `declined`, `funded` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Partners can INSERT their own referrals and SELECT only their own rows. Admins get full access.

#### `partner_referral_status_history`
Logs every status change so partners see a timeline.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| referral_id | uuid (FK -> partner_referrals) | |
| old_status | text | |
| new_status | text | |
| changed_at | timestamptz | |
| note | text | Optional message from admin |

RLS: Partners can SELECT rows for their own referrals. Admins get full access.

#### `partner_commissions`
Tracks commissions earned on funded deals.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| partner_id | uuid | |
| referral_id | uuid (FK -> partner_referrals) | |
| amount | numeric | Commission amount |
| status | text | `pending`, `approved`, `paid` |
| paid_at | timestamptz | |
| created_at | timestamptz | |
| notes | text | |

RLS: Partners can SELECT their own. Admins get full access.

### Database trigger

A trigger on `partner_referrals` that auto-inserts into `partner_referral_status_history` whenever `status` changes, so the timeline is always accurate.

### Realtime

Enable realtime on `partner_referrals` and `partner_referral_status_history` so the partner dashboard updates live when admins change a referral's status.

---

## 2. Authentication and Routing

### Auth changes

- Add `'partner'` to the `app_role` enum.
- Update `Auth.tsx` login redirect logic: if user has role `partner`, redirect to `/partner`.
- Update `ProtectedRoute.tsx` to recognize partner role and prevent partners from accessing admin or client routes.

### New route guard: `PartnerRoute`

A simple component (similar to `ProtectedRoute`) that checks the user has the `partner` role and redirects otherwise.

### New routes in `App.tsx`

```
/partner                -> Partner Dashboard
/partner/referrals      -> Referral list + submission
/partner/commissions    -> Commission tracker
/partner/profile        -> Partner profile
```

---

## 3. Frontend Components

### Partner Layout (`src/components/partner/PartnerLayout.tsx`)

Sidebar navigation matching the existing portal style (dark sidebar with logo) with links to Dashboard, My Referrals, Commissions, and Profile.

### Partner Dashboard (`src/pages/partner/Dashboard.tsx`)

Summary cards:
- Total Referrals submitted
- Active Referrals (in review/approved)
- Funded Deals
- Total Commissions Earned

Plus a "Recent Referrals" list showing latest 5 with status badges.

### Referral Submission + List (`src/pages/partner/Referrals.tsx`)

- A table/list of all submitted referrals with status badges (color-coded)
- "New Referral" button opens a form dialog with fields:
  - Contact Name, Email, Phone, Company Name
  - Loan Amount, Loan Type (dropdown), Property Address
  - Urgency (Urgent / Standard / No Rush)
  - Notes
- Clicking a referral row expands to show the **status timeline** (from `partner_referral_status_history`) so the partner sees every stage change with timestamps.

### Commissions Page (`src/pages/partner/Commissions.tsx`)

- Summary: Total Earned, Pending, Paid
- Table listing each commission with referral name, amount, status, and date.

### Partner Profile (`src/pages/partner/Profile.tsx`)

Basic profile page showing the partner's email and account info.

---

## 4. Admin Side - Managing Partner Referrals

On the admin side, partner referrals will appear with `source = 'partner_referral'` when converted to leads. Admins can update referral status from the existing CRM/lead detail dialog. When an admin changes the status on `partner_referrals`, the trigger logs it to the history table, and the partner sees it in real time.

---

## 5. File Summary

| Action | File |
|---|---|
| Create | `src/components/partner/PartnerLayout.tsx` |
| Create | `src/components/partner/PartnerSidebar.tsx` |
| Create | `src/components/partner/PartnerRoute.tsx` |
| Create | `src/pages/partner/Dashboard.tsx` |
| Create | `src/pages/partner/Referrals.tsx` |
| Create | `src/pages/partner/Commissions.tsx` |
| Create | `src/pages/partner/Profile.tsx` |
| Edit | `src/App.tsx` - add partner routes |
| Edit | `src/pages/Auth.tsx` - add partner redirect |
| Edit | `src/contexts/AuthContext.tsx` - recognize partner role |
| Edit | `src/components/auth/ProtectedRoute.tsx` - block partners from admin/client |
| Migration | Create tables, enum value, trigger, RLS policies, realtime |

