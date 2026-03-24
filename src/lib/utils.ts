import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
}

export function getLeadDisplayName(lead: { opportunity_name?: string | null; name: string; company_name?: string | null }): string {
  if (lead.opportunity_name?.trim()) return lead.opportunity_name.trim();
  return lead.name;
}
