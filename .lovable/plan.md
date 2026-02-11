

## Fix: Borrower Search Dropdown Scrolling

### Problem
The `cmdk` library dynamically sets an inline `--cmdk-list-height` CSS variable on `CommandList`, which overrides any `maxHeight` styling. This causes the scrollbar to flash briefly then disappear as the library recalculates height to fit all content.

### Solution
Replace the scrolling mechanism by wrapping the list content in a `ScrollArea` component (from Radix) inside the `CommandList`, and remove the height constraint from `CommandList` so `cmdk` doesn't fight with it.

### Changes

**File: `src/components/evan/tasks/BorrowerSearchSelect.tsx`**

1. Import `ScrollArea` from `@/components/ui/scroll-area`
2. Remove the inline `style` from `CommandList`
3. Wrap the `CommandEmpty` and `CommandGroup` inside a `ScrollArea` with a fixed `h-[200px]` class
4. This gives us a native Radix scrollbar that `cmdk` cannot override

The structure will change from:
```
CommandList (style maxHeight - gets overridden by cmdk)
  CommandEmpty
  CommandGroup
    items...
```

To:
```
CommandList (no height constraint)
  ScrollArea (h-[200px] - cmdk can't touch this)
    CommandEmpty
    CommandGroup
      items...
  /ScrollArea
```

This is a single-file change to `BorrowerSearchSelect.tsx`.
