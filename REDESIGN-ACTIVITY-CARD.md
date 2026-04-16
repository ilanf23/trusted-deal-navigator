# Redesign: ActivityCard Component

## Target File
`src/components/feed/ActivityCard.tsx` (695 lines)

## What This Component Does
The `ActivityCard` is the main feed card in the CRM activity feed (`FeedCenter.tsx`). It renders call logs, emails, SMS, notes, tasks, and stage changes. Each card has an avatar with a type badge, a header pill, timestamp, contact link, content preview, action buttons (Call Back, Reply All, View Thread), comments, and emoji reactions.

## Current Problems (Design Critique)

**Visual Hierarchy is broken:**
- The header pill ("Unknown logged a Phone Call") competes with the comment/emoji buttons in the top-right — two focal points fighting for attention
- The contact name link (blue text, 13px) is the same visual weight as the timestamp — users can't scan to the important info fast enough
- The "Call Back" button is styled as a ghost pill (gray text, gray border) making it look disabled rather than actionable
- Content preview, contact name, and metadata all sit at roughly the same font size (12-14px) creating a flat hierarchy

**Spacing is inconsistent:**
- `mt-1`, `mt-1.5`, `mt-2`, `mt-4` are used without a clear rhythm. The card feels like elements are just stacked with arbitrary gaps
- Internal padding is `px-5 py-3.5` — the vertical padding is too tight relative to the horizontal, making the card feel squeezed
- The avatar section uses inline styles (`width: 40, height: 40, marginTop: 1`) mixing systems

**Color & Contrast issues:**
- Gray-on-gray timestamps (gray-400 on white) are hard to read — below WCAG AA for normal text
- The lock icon (gray-300) is nearly invisible and adds no clear value
- The "Call Back" button's gray-500 text on white with a gray-200 border is too low-contrast for a primary action
- The type badge (22px circle on 40px avatar) uses `ring-2 ring-white` but the ring blends into the white card background

**Component Structure:**
- Too many inline styles mixed with Tailwind (`style={{ borderRadius: '9999px' }}` when `rounded-full` exists)
- The card handles 6+ activity types in one monolithic component — consider extracting type-specific renderers
- Comment section is 55+ lines of inline JSX that could be its own component

## Redesign Requirements

### 1. Visual Hierarchy (apply these levels)
- **Primary** (seen first): Actor name + action type in the header — use 14px semibold for the name, 14px regular for the action
- **Secondary** (scanned next): Contact name — make it 14px medium, use the brand purple (#3b2778) instead of blue-600 to match the CRM's purple theme. Add the colored initial circle inline
- **Tertiary** (read on demand): Content preview — keep at 14px but use gray-500. Truncate to 2 lines collapsed
- **Quaternary** (available but not prominent): Timestamp — move to 12px, gray-400, use relative time ("3d ago" not full date). Drop the lock icon unless the activity is actually private
- **Primary CTA**: The action button (Call Back / Reply All) should be the ONE primary action — give it a filled style: `bg-gray-900 text-white hover:bg-gray-800` with rounded-full. Small size (h-8 px-3.5 text-xs font-medium)

### 2. Spacing System (use 4px base unit)
- Card padding: `p-4` (16px all sides) for comfortable density
- Stack spacing between rows: `gap-1` (4px) for tightly related items (header → timestamp), `gap-2` (8px) for distinct sections (timestamp → content), `gap-3` (12px) for the action row
- Avatar to content: `gap-3` (12px)
- Card margin bottom: `mb-2` (keep current)
- Use Tailwind spacing utilities exclusively — remove ALL inline style objects for spacing

### 3. Color System
- Keep the existing `recipientColors` map and `SUB_TYPE_ICONS` color coding — these are good
- Card background: `bg-white` default, `bg-gray-50/50` on hover (subtle)
- Borders: `border border-gray-200` (slightly more visible than current gray-100)
- Expanded state: `shadow-md ring-1 ring-purple-100` (ties to the CRM purple theme)
- Timestamp text: `text-gray-500` (bump from gray-400 for readability)
- The call direction indicator should use semantic colors: green-500 for completed inbound, blue-500 for outbound, red-500 for missed
- Comment/emoji buttons: keep as ghost circles but reduce to `w-8 h-8` and move them to the action row instead of absolute-positioned top-right

### 4. Typography
- Actor name: 14px / semibold (600)
- Action label: 14px / regular (400) / gray-500
- Contact name: 14px / medium (500) / gray-900
- Content preview: 14px / regular (400) / gray-600
- Timestamp: 12px / regular (400) / gray-500
- Button text: 12px / medium (500)
- Comment text: 13px / regular / gray-600
- Use `tracking-normal` everywhere, no letter-spacing hacks

### 5. Layout Changes
- **Remove the header pill** (the `bg-gray-50 border rounded-full` wrapper around actor+action). Just render the text inline — the pill adds visual noise without purpose
- **Move comment + emoji buttons** from absolute top-right into the action button row (Row 4). This eliminates the position:absolute hack and the visual competition with the header
- **Call status line**: For call activities, add a small inline status indicator below the content: a colored dot + "Incoming call — completed" or "Outgoing call — 2m 34s" in 12px gray-500
- **Clean up the avatar**: Remove all inline styles. Use `relative w-10 h-10` on the wrapper, `w-10 h-10 rounded-full` on the circle, and `absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white` on the badge

### 6. Accessibility
- All interactive elements need `focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2`
- The "Call Back" button needs `aria-label="Call back {contactName}"` 
- Comment and emoji buttons need proper `aria-label` and `aria-expanded` for their popovers
- Ensure the contact name link has `role="link"` since it's a `<button>` acting as navigation
- Color contrast: verify all text/background combos meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- The emoji picker needs `role="listbox"` with `role="option"` on each emoji

### 7. Component Architecture
Extract these sub-components (keep them in the same file or a nearby `/feed` folder):
- `ActivityAvatar` — avatar circle + type badge overlay
- `ActivityHeader` — actor name + action label + timestamp
- `ActivityContact` — contact initial + name link + company
- `ActivityActions` — type-specific CTA buttons + comment/emoji buttons
- `CommentSection` — the full comment thread + input (currently 55 lines inline)
- Keep `ActivityContent` and `EmailContentPreview` as they are (already extracted)

### 8. Interaction & Animation
- Card hover: `transition-shadow duration-150` with `hover:shadow-sm`
- Card expand: use `framer-motion` `AnimatePresence` + `motion.div` with `initial={{ height: 0, opacity: 0 }}` `animate={{ height: 'auto', opacity: 1 }}` for smooth expand/collapse of the expanded section and comments
- Button hover: `transition-colors duration-100`
- Emoji picker: fade in with `animate-in fade-in-0 duration-150`

### 9. Code Quality
- Remove every `style={{ borderRadius: '9999px' }}` — replace with `rounded-full`
- Remove every `style={{ position: 'absolute', ... }}` — use Tailwind positioning
- Remove `style={{ minWidth, minHeight, flexShrink }}` from icons — use `shrink-0` and Tailwind sizing
- Use `cn()` for all conditional classes (already imported)
- Follow the project convention: `cva` for variants if you add size/style variants to the card
- Do NOT hardcode team member names per the CLAUDE.md rule

## What NOT to Change
- Keep all the existing hooks (`useFeedComments`, `useFeedReactions`, `useToggleFeedReaction`, etc.)
- Keep the `FeedActivity` type interface and all props
- Keep the `SUB_TYPE_ICONS` mapping — it's comprehensive and correct
- Keep the `handleReply`, `handleViewThread`, `handleCallBack`, `handleViewLead` handlers — the logic is fine
- Keep the `EMOJI_PRESETS` list
- Keep the `recipientColors` map
- Keep `ActivityContent` and `EmailContentPreview` sub-components as-is

## Reference
- CRM uses a purple theme: primary `#3b2778`, highlight `#eee6f6`, borders `#c8bdd6`
- shadcn/ui primitives are in `src/components/ui/` — use them where applicable
- Framer Motion is already a project dependency
- Use `cn()` from `@/lib/utils` for class merging
