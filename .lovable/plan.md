

# Fake Partners + CRM Partner Tag

## Overview
Create 5 fake partners in the database, link each to 1-2 leads from the pipeline via `partner_referrals`, and show a partner name tag in the CRM lead detail popup.

## Part 1: Seed Data via Edge Function

Since `partner_referrals.partner_id` references auth users, we need to create real auth users with the partner role. We'll create an edge function `seed-partners` that:

1. Creates 5 fake partner auth users (with confirmed emails)
2. Updates their profiles with company/contact info
3. Assigns them the `partner` role in `user_roles`
4. Creates `partner_referrals` rows linking each partner to 1-2 random leads (using `lead_id`)

### Fake Partners
| Name | Email | Company |
|------|-------|---------|
| Marcus Rivera | marcus.rivera@partnertest.com | Rivera Capital Advisors |
| Sarah Kim | sarah.kim@partnertest.com | Kim & Associates Realty |
| David Thornton | david.thornton@partnertest.com | Thornton Financial Group |
| Angela Brooks | angela.brooks@partnertest.com | Brooks Commercial Lending |
| Robert Chen | robert.chen@partnertest.com | Chen Pacific Ventures |

Each will be linked to 1-2 leads randomly from the existing pipeline leads.

### File to Create
- `supabase/functions/seed-partners/index.ts`

## Part 2: Partner Tag in CRM Popup

In `src/components/admin/LeadDetailDialog.tsx`, add a query to check if the current lead has a `partner_referrals` record (where `lead_id = lead.id`). If found, display a colored badge/tag in the right sidebar header area (next to Stage and Assigned To) showing the referring partner's name.

### Changes to `LeadDetailDialog.tsx`
- Add a `useQuery` to fetch `partner_referrals` where `lead_id` matches, joining with `profiles` to get the partner name
- In the right sidebar header (around line 2536), add a row showing a "Referred by: [Partner Name]" badge when a partner referral exists
- Use a distinctive badge color (e.g., purple/indigo) to make it stand out

### Technical Details

Query pattern:
```typescript
const { data: partnerReferral } = useQuery({
  queryKey: ['lead-partner-referral', lead?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('partner_referrals')
      .select('id, partner_id, name, profiles!partner_referrals_partner_id_fkey(contact_person, company_name)')
      .eq('lead_id', lead!.id)
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!lead?.id && open,
});
```

If profiles join doesn't work (no FK), we'll do a two-step query: fetch the referral, then fetch the partner's profile by `user_id = partner_id`.

Badge display in the right sidebar header:
```
[Stage selector] [Assigned To selector]
[Partner Badge: "Referred by Marcus Rivera"]  <-- new row
```

### Files Modified
- `src/components/admin/LeadDetailDialog.tsx` -- add partner referral query + badge display

### Files Created
- `supabase/functions/seed-partners/index.ts` -- one-time seed function

