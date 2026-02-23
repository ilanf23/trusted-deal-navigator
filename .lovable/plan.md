

## Redesign FeedRightPanel to Match Copper CRM Reference

### Changes to `src/components/feed/FeedRightPanel.tsx`

**1. Add date header at top**
- Display current date formatted as "Sunday, February 22nd" using `date-fns` `format(new Date(), 'EEEE, MMMM do')`.
- Right-aligned, subtle text styling.

**2. Restyle "Keep things moving" section**
- Remove the `AlertCircle` icon from the section header; use plain gray label text ("Keep things moving").
- Redesign each task card to be a white card (`bg-card`) with rounded corners and light border:
  - Add an **X dismiss button** (top-right corner) using the `X` icon from lucide-react. Dismiss hides the card locally via state (no DB change).
  - Add a **large dark icon** on the left (~48px, dark rounded square with a monitor/checkbox icon inside).
  - Bold title: "You have a task due in N day(s)!"
  - Subtitle with task name in quotes and due label.
  - Assignee initials badge (small circle).
  - Add a **"GET ON IT" button** -- outlined border, centered at bottom. Clicking navigates to the task.

**3. Restyle "Upcoming Meetings" section**
- Remove `CalendarClock` icon from section header (meetings are nested under "Keep things moving" visually in the reference -- but we'll keep them as a distinct group for clarity).
- Redesign each meeting card:
  - Add **X dismiss button** top-right.
  - Use **larger avatar circle** (~48px) with initials and a small calendar badge overlay (a small Google Calendar-style colored circle icon at bottom-right of the avatar).
  - Bold title: "Upcoming Meeting".
  - Subtitle: "with [Name] +N more".
  - Body text with **bold** keywords for day/time: "You have a meeting **tomorrow** at **2:30pm EST**."
  - Add a **"PREPARE" button** -- outlined, centered at bottom. Clicking navigates to calendar.

**4. Update "Suggestions" section**
- Remove `UserPlus` icon from header.
- Add a subtle separator line above the section.
- Move "View all" to be next to "Add Suggested People" header row (already done).
- Make the "+" icon always visible (remove `opacity-0 group-hover:opacity-100`).

**5. Update "Team Members" section to "Invite Team Members"**
- Rename header to "Invite Team Members".
- Remove `Users` icon from header.
- Add a subtitle: "Add team members to collaborate with them on CLX".

**6. General card styling**
- Cards use `bg-card` (white in light mode) instead of `bg-muted/50`.
- More padding inside cards (~p-4).
- Dismiss state managed via local `useState` (array of dismissed IDs).

### Technical Details

- **File modified**: `src/components/feed/FeedRightPanel.tsx`
- **New imports**: `X`, `Monitor` (or `SquareCheck`) from lucide-react; `useState` from react
- **Dismiss state**: `const [dismissedIds, setDismissedIds] = useState<string[]>([])` -- filter out dismissed items from render
- **Bold time formatting**: Split the meeting time string to wrap day/time in `<span className="font-bold">` tags
- **No hardcoded data** -- all content remains database-driven
- **Component stays under 300 lines** -- may extract a `DismissableCard` wrapper if needed

