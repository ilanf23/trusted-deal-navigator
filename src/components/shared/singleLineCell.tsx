import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared primitives that enforce the "one visual line at rest" contract for
// record/list table body rows. See docs/plans/2026-05-26-table-row-single-line-
// height-stability.md for the full contract.

/** Apply to a <td> (or TableCell). Prevents wrapping, clips overflow. */
export const SINGLE_LINE_CELL = "overflow-hidden whitespace-nowrap";

/** Apply to the direct text/inline child of a single-line cell. Allows the
 *  child to shrink inside a flex/fixed-width parent and truncate with ellipsis. */
export const SINGLE_LINE_CONTENT = "block min-w-0 truncate";

/** Apply to chips, badges, dates, action groups inside a single-line cell.
 *  Prevents them from shrinking and from wrapping their internal text. */
export const SINGLE_LINE_CHIP = "shrink-0 whitespace-nowrap";

/** Apply to a shadcn `<Table>` element to enforce the single-line contract on
 *  every body `<TableCell>` via a descendant selector. Useful for record/list
 *  tables built directly on the shadcn primitive (no per-cell className edits
 *  needed). Header cells are left alone — they use their own nowrap rule. */
export const RECORD_TABLE = "[&_tbody_td]:overflow-hidden [&_tbody_td]:whitespace-nowrap";

interface SingleLineCellContentProps extends HTMLAttributes<HTMLSpanElement> {
  /** Used for the native title="" tooltip so users can see the full value on hover. */
  title?: string;
  children: ReactNode;
}

/** Wraps text content inside a body cell so it truncates with an ellipsis and
 *  exposes the full value via the native title attribute on hover. Use for any
 *  unbounded string (names, emails, notes, addresses) rendered in a table row. */
export const SingleLineCellContent = forwardRef<HTMLSpanElement, SingleLineCellContentProps>(
  ({ className, title, children, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(SINGLE_LINE_CONTENT, className)}
      title={title}
      {...rest}
    >
      {children}
    </span>
  ),
);
SingleLineCellContent.displayName = "SingleLineCellContent";
