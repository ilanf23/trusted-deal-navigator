

# Commission Section Redesign

## Problem
The current commission "hero card" with a progress bar toward a $50,000 goal feels gimmicky and unnecessary. Partners just need to see their earnings clearly.

## What Changes

Remove the goal tracker, progress bar, and decorative circles. Replace with a clean, professional commission summary card that shows:

- **Total Commissions Earned** as the primary large number
- **Funded Deals count** as supporting context
- A subtle gradient background kept for visual hierarchy, but toned down

## Technical Details

### File Modified
- `src/pages/partner/Dashboard.tsx`

### Specific Changes

1. **Remove** the `COMMISSION_GOAL` constant and `commissionProgress` calculation
2. **Redesign** the hero card section:
   - Keep the gradient card (`from-[#0066FF] to-[#0052cc]`) but remove the decorative circles
   - Show commission earnings as a single prominent figure with a label
   - Add funded deals count as a secondary stat beside it
   - Remove the progress bar, goal text, and percentage display
3. The card becomes a simple, elegant earnings banner -- two key numbers side by side with clean typography

### Result
A professional earnings summary that presents real data without artificial gamification.

