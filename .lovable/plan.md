

## Redesign: Company Revenue Hero Chart

### What's Changing

The current blue gradient hero card will be completely redesigned into a clean, white/light card layout with a much larger chart that includes both bar and line visualizations. The chart area will be significantly taller and the overall widget more prominent.

### New Design

**Layout: Full-width white card with clean corporate aesthetic**

**Top Section:**
- "2026 Revenue Goal" header with large revenue number and $1.5M target
- Progress bar (using brand blue #0066FF)
- MTD/YTD toggle tabs
- Momentum/status message

**Chart Area (450px tall -- significantly larger than current 300px):**
- Light gray background with subtle grid lines
- **Bars**: Individual monthly (YTD) or daily (MTD) revenue in brand blue
- **Line**: Cumulative revenue as an orange accent line with dots
- **Dashed reference line**: Goal pace / trend line
- Clean dark axis labels on white background
- Professional tooltip with white background and border

**Bottom Stats Bar:**
- 4-column grid: YTD Revenue, Monthly Avg, Best Month, Deals Closed
- Light card style with subtle borders instead of white-on-blue text

### Visual Style
- White card background with subtle border (matches corporate aesthetic)
- Blue (#0066FF) for bars and primary elements
- Orange (#FF8000) for the cumulative line (brand accent)
- Dark text for readability
- No gradient background -- clean and professional

### Technical Changes

**File: `src/components/evan/dashboard/CompanyRevenueHero.tsx`**

1. Replace the blue gradient card with a white bordered card
2. Remove decorative background circles
3. Increase chart height from 300px to 450px
4. Add `Bar` component from recharts for individual period revenue
5. Change `Line` color to orange (#FF8000) for cumulative
6. Change `Area` gradient to light blue fill
7. Switch tooltip to light theme (white bg, dark text, border)
8. Update axis tick colors to dark/muted for light background
9. Restyle the stats footer with bordered sections instead of opacity-based white text
10. Restyle the momentum card and progress bar for light background
11. Update all text colors from white/opacity to proper dark foreground colors

**Data logic stays the same** -- same query, same calculations, just a visual overhaul.

### No other files change. No database changes needed.

