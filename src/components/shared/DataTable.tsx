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

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  activeRowId?: string | number | null;
  rowId?: (row: T) => string | number;
  emptyState?: ReactNode;
  className?: string;
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
                  "px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider",
                  alignClass[col.align || "left"],
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
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-sm",
                        alignClass[col.align || "left"],
                      )}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
