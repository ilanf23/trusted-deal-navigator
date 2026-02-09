

# Partner Dashboard Redesign

## Overview
Redesign the partner dashboard to match the professional, polished aesthetic of Evan's command center -- with a hero section, better stat cards, a pipeline summary, quick actions, and an improved referrals table.

## What Changes

### 1. Welcome Header with Greeting
- Dynamic time-of-day greeting ("Good morning!", "Happy Monday!", etc.)
- Subtitle: "Here's your referral overview"
- Clean layout matching Evan's header style

### 2. Hero Card -- Commissions Goal Tracker
- Full-width gradient card (primary blue, matching Evan's annual goal card)
- Shows total commissions earned vs a goal (or lifetime earnings if no goal)
- Decorative background circles for visual depth
- Progress bar showing commission trajectory

### 3. Upgraded Stat Cards
- 4-column grid with icon backgrounds (colored circle behind each icon)
- Subtle trend indicators and better typography
- Cards: Total Referrals, Active Referrals, Funded Deals, Total Commissions
- Each card gets a colored icon container instead of a bare icon

### 4. Quick Actions Row
- "Submit New Referral" button linking to /partner/referrals
- "View Commissions" button linking to /partner/commissions
- Professional button styling with icons

### 5. Two-Column Layout (below stats)
- **Left column**: Recent Referrals table with better formatting -- avatar placeholder initials, status badges with dot indicators, loan type and amount shown
- **Right column**: Referral Status Breakdown -- simple visual showing count per status (submitted, in review, approved, funded, declined) with colored bars/indicators

### 6. Loading State
- Centered spinner with "Loading dashboard..." text (matching Evan's pattern)

## Technical Details

### Files Modified
- `src/pages/partner/Dashboard.tsx` -- Complete redesign of the dashboard component

### Approach
- Use existing UI components (Card, Badge, Progress, Button)
- Use Recharts for any mini-charts if needed (already installed)
- Follow the same data-fetching pattern (Supabase queries + realtime subscription)
- Use semantic Tailwind tokens (bg-card, text-foreground, border-border) for dark mode compatibility
- Brand colors: Primary blue (#0066FF), accent orange (#FF8000), clean whites
- Responsive grid: 1 col mobile, 2 col tablet, 4 col desktop for stats

