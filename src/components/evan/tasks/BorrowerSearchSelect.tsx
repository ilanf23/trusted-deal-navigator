import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


interface Lead {
  id: string;
  name: string;
  company_name: string | null;
}

interface BorrowerSearchSelectProps {
  leads: Lead[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function BorrowerSearchSelect({
  leads,
  value,
  onValueChange,
  placeholder = "Select a borrower",
  className,
}: BorrowerSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedLead = leads.find((lead) => lead.id === value);
  const displayValue = selectedLead
    ? `${selectedLead.name}${selectedLead.company_name ? ` (${selectedLead.company_name})` : ""}`
    : null;

  const uniqueLeads = React.useMemo(() => {
    const seen = new Set<string>();
    return leads.filter((l) => {
      const key = `${l.name}||${l.company_name ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leads]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return uniqueLeads;
    const q = search.toLowerCase();
    return uniqueLeads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.company_name && l.company_name.toLowerCase().includes(q))
    );
  }, [uniqueLeads, search]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full max-w-[300px] justify-between h-9 text-sm font-normal rounded-lg",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-[200] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Sticky search input */}
        <div className="flex items-center border-b px-3 bg-popover">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search borrowers..."
            className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus={false}
          />
        </div>
        {/* Scrollable list */}
        <div className="max-h-[280px] overflow-y-auto overscroll-contain p-1" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No borrowers found.</div>
          )}
          <div
            role="option"
            aria-selected={!value}
            onClick={() => { onValueChange(null); setOpen(false); }}
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
            <span className="text-muted-foreground">No borrower</span>
          </div>
          {filtered.map((lead) => (
            <div
              key={lead.id}
              role="option"
              aria-selected={value === lead.id}
              onClick={() => { onValueChange(lead.id); setOpen(false); }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <Check className={cn("mr-2 h-4 w-4", value === lead.id ? "opacity-100" : "opacity-0")} />
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lead.name}</span>
                {lead.company_name && (
                  <span className="text-muted-foreground text-xs">({lead.company_name})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
