import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  SINGLE_LINE_CELL,
  SingleLineCellContent,
} from "@/components/shared/singleLineCell";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
  render?: (row: T) => ReactNode;
  /** Opt this column out of single-line truncation (e.g., for action columns
   *  or columns whose render() already controls overflow). */
  multiLine?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  activeRowId?: string | number | null;
  rowId?: (row: T) => string | number;
  emptyState?: ReactNode;
  className?: string;
  /** Enforce the one-line row contract on body cells. Defaults to true.
   *  Pass false for tables whose cells are designed to wrap (rare). */
  singleLine?: boolean;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  activeRowId,
  rowId,
  emptyState,
  className,
  singleLine = true,
}: DataTableProps<T>) {
  return (
    <ScrollArea className={cn("w-full", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                  alignClass[col.align || "left"],
                  col.className,
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {emptyState || "No data available"}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, idx) => {
              const id = rowId ? rowId(row) : idx;
              const isActive = activeRowId != null && id === activeRowId;

              return (
                <TableRow
                  key={id}
                  className={cn(
                    "border-b border-border transition-colors",
                    onRowClick && "cursor-pointer",
                    isActive ? "bg-accent/5" : "hover:bg-muted/50",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => {
                    const enforceSingleLine = singleLine && !col.multiLine;
                    let cellChildren: ReactNode;
                    if (col.render) {
                      cellChildren = col.render(row);
                    } else {
                      const raw = String(
                        (row as Record<string, unknown>)[col.key] ?? "",
                      );
                      cellChildren = enforceSingleLine ? (
                        <SingleLineCellContent title={raw}>{raw}</SingleLineCellContent>
                      ) : (
                        raw
                      );
                    }
                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "px-4 py-3 text-sm",
                          enforceSingleLine && SINGLE_LINE_CELL,
                          alignClass[col.align || "left"],
                          col.className,
                        )}
                        style={col.width ? { width: col.width } : undefined}
                      >
                        {cellChildren}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
