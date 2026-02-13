

## Fix: Revenue Chart Responsive Layout for Smaller Screens

### Problems Identified
1. The chart header row crams the title, MTD/YTD tabs, and 3 legend items into a single horizontal line -- overflows on smaller screens
2. The chart height is fixed at 450px which is too tall for smaller viewports
3. The Y-axis widths (55px each side) eat into chart space on narrow screens
4. The top section uses `lg:flex-row` but the chart area itself has no responsive adjustments

### Changes (single file)

**File: `src/components/evan/dashboard/CompanyRevenueHero.tsx`**

1. **Chart header**: Stack title+tabs above the legend on small screens using `flex-col sm:flex-row` instead of a single row
2. **Legend**: Hide on very small screens or wrap to a second line with `flex-wrap`
3. **Chart height**: Change from fixed `h-[450px]` to responsive `h-[280px] md:h-[380px] lg:h-[450px]`
4. **Y-axis widths**: Reduce from 55px to 45px on smaller screens (via responsive check or smaller default)
5. **Chart margins**: Reduce left/right margins on small screens
6. **Chart padding**: Reduce the `p-5` container padding to `p-3 md:p-5`
7. **Bar size**: Reduce bar width for smaller viewports

### No database or other file changes needed.
