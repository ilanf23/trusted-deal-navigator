# Fix: ActivityCard Dead Space & Duplicate Content

## Target File
`src/components/feed/ActivityCard.tsx`

## Problem
For **call-type activity cards**, there's redundant content and dead space:

1. **Duplicate text**: The `ActivityContent` renders the raw `activity.content` (e.g. "Incoming call — completed") on one line, and then `CallStatusLine` renders the exact same text with a green dot right below it. This is the same information shown twice.

2. **Dead space**: The card layout uses `flex flex-col gap-2` (line ~501) which puts 8px between every row. With the duplicate content, the card stretches vertically for no reason. The call card has 5 stacked rows (header → contact → content → status → action) when it only needs 3-4.

3. **The content row is empty/useless for calls**: Most call activities have `content` set to something like "Incoming call — completed" which is metadata, not real content. Unlike emails (which have subjects + body) or notes (which have text), call cards don't have meaningful content to preview.

## Fix Instructions

### 1. Hide the content row for call activities when it duplicates the status line
In the main render (around line 534), wrap the content block so it **skips rendering for calls** when the content is just a status echo:

```tsx
{/* Content preview — skip for calls (status line handles it) */}
{!isCall && (
  <div>
    {isEmail ? (
      <EmailContentPreview subject={activity.subject} content={activity.content} isExpanded={isExpanded} />
    ) : (
      <div className={cn(!isExpanded && 'line-clamp-2')}>
        <ActivityContent content={activity.content} />
      </div>
    )}
  </div>
)}
```

This removes the duplicate "Incoming call — completed" text. The `CallStatusLine` already shows this info with a semantic colored dot — that's the better version.

### 2. Merge the contact row and status line for calls into one compact row
Instead of having the contact name on one row and the status dot on a separate row, combine them on the **same line** for calls:

Replace the separate contact + status blocks (around lines 515-545) with a single combined row for calls:

```tsx
{/* Contact + inline call status (calls only) */}
{isCall && activity.leadName && (
  <div className="flex items-center gap-2">
    <span
      className={cn(
        'w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0',
        getRecipientColor(recipientInitial)
      )}
    >
      {recipientInitial}
    </span>
    <button
      type="button"
      onClick={handleViewLead}
      className="text-[14px] font-medium text-[#3b2778] hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-sm"
      role="link"
      aria-label={`View ${activity.leadName}`}
    >
      {activity.leadName}
    </button>
    {activity.leadCompany && (
      <span className="text-[13px] text-gray-400 truncate">— {activity.leadCompany}</span>
    )}
    <span className="text-gray-300 mx-0.5">·</span>
    <CallStatusLine direction={activity.direction} subType={activity.subType} />
  </div>
)}

{/* Contact row — non-email, non-call types */}
{!isEmail && !isCall && activity.leadName && (
  <ActivityContact
    recipientInitial={recipientInitial}
    leadName={activity.leadName}
    leadCompany={activity.leadCompany}
    onClick={handleViewLead}
  />
)}
```

And remove the standalone `{isCall && <CallStatusLine ... />}` block (line ~545) since it's now inlined.

### 3. Tighten the gap for call cards
The outer `flex flex-col gap-2` creates 8px between every row. With fewer rows, this is fine. But also tighten the header section's inner gap from `gap-1` to `gap-0.5` for the call variant since the contact+status is now a single compact line:

In the `gap-1` flex-col (line ~503), for the header section keep `gap-1` — the compactness now comes from having fewer total rows.

### 4. Result: Call card should render as exactly 3 rows
After these changes, a call card shows:

```
[Avatar] Unknown logged a Phone Call                    3 days ago
         [U] Unknown Contact · ● Incoming call — completed
         [████ Call Back ████]  [💬] [😊]
```

Instead of the current 5-row layout:

```
[Avatar] Unknown logged a Phone Call                    3 days ago
         [U] Unknown Contact
         Incoming call — completed          ← duplicate
         ● Incoming call — completed        ← duplicate
         [████ Call Back ████]  [💬] [😊]
```

## What NOT to Change
- Don't touch the email, SMS, note, or other activity type rendering paths
- Don't change any handlers, hooks, or state management
- Don't change the `CallStatusLine` component itself — it's fine
- Don't change `ActivityContent` or `EmailContentPreview`
- Don't change the action buttons, reactions, or comment section
- Keep all accessibility attributes as-is
