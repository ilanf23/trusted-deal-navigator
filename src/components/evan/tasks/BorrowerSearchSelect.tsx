import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

  const selectedLead = leads.find((lead) => lead.id === value);
  const displayValue = selectedLead
    ? `${selectedLead.name}${selectedLead.company_name ? ` (${selectedLead.company_name})` : ""}`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
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
      <PopoverContent className="w-[300px] p-0 z-[200]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command className="bg-transparent" shouldFilter={true}>
          <CommandInput placeholder="Search borrowers..." className="h-9" />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>No borrowers found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="text-muted-foreground">No borrower</span>
              </CommandItem>
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={`${lead.name} ${lead.company_name || ""}`}
                  onSelect={() => {
                    onValueChange(lead.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === lead.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{lead.name}</span>
                    {lead.company_name && (
                      <span className="text-muted-foreground text-xs">({lead.company_name})</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
