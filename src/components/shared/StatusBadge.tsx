import { cn } from "@/lib/utils";

type StatusVariant = "subtle" | "solid";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

interface StatusColor {
  bg: string;
  text: string;
  solidBg: string;
}

const STATUS_COLORS: Record<string, StatusColor> = {
  // Lead/deal stages
  new: { bg: "bg-blue-100", text: "text-blue-700", solidBg: "bg-blue-600" },
  contacted: { bg: "bg-sky-100", text: "text-sky-700", solidBg: "bg-sky-600" },
  qualified: { bg: "bg-indigo-100", text: "text-indigo-700", solidBg: "bg-indigo-600" },
  negotiation: { bg: "bg-purple-100", text: "text-purple-700", solidBg: "bg-purple-600" },
  won: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },
  lost: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },

  // General statuses
  active: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },
  inactive: { bg: "bg-gray-100", text: "text-gray-700", solidBg: "bg-gray-500" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700", solidBg: "bg-yellow-600" },

  // Invoice/payment
  paid: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },
  overdue: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },

  // Contract
  draft: { bg: "bg-gray-100", text: "text-gray-600", solidBg: "bg-gray-500" },
  sent: { bg: "bg-blue-100", text: "text-blue-700", solidBg: "bg-blue-600" },
  signed: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },
  expired: { bg: "bg-orange-100", text: "text-orange-700", solidBg: "bg-orange-600" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },
  viewed: { bg: "bg-cyan-100", text: "text-cyan-700", solidBg: "bg-cyan-600" },

  // Pipeline stages
  initial_review: { bg: "bg-blue-100", text: "text-blue-700", solidBg: "bg-blue-600" },
  underwriting: { bg: "bg-indigo-100", text: "text-indigo-700", solidBg: "bg-indigo-600" },
  closing: { bg: "bg-purple-100", text: "text-purple-700", solidBg: "bg-purple-600" },
  funded: { bg: "bg-emerald-100", text: "text-emerald-700", solidBg: "bg-emerald-600" },
  dead: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },
  on_hold: { bg: "bg-amber-100", text: "text-amber-700", solidBg: "bg-amber-600" },
  needs_attention: { bg: "bg-orange-100", text: "text-orange-700", solidBg: "bg-orange-600" },
  dormant: { bg: "bg-slate-100", text: "text-slate-600", solidBg: "bg-slate-500" },

  // Review
  under_review: { bg: "bg-violet-100", text: "text-violet-700", solidBg: "bg-violet-600" },
  countered: { bg: "bg-amber-100", text: "text-amber-700", solidBg: "bg-amber-600" },
  pending_response: { bg: "bg-yellow-100", text: "text-yellow-700", solidBg: "bg-yellow-600" },
  complete: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },
  in_review: { bg: "bg-violet-100", text: "text-violet-700", solidBg: "bg-violet-600" },

  // Priority
  high: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", solidBg: "bg-yellow-600" },
  low: { bg: "bg-green-100", text: "text-green-700", solidBg: "bg-green-600" },

  // Temperature
  hot: { bg: "bg-red-100", text: "text-red-700", solidBg: "bg-red-600" },
  warm: { bg: "bg-orange-100", text: "text-orange-700", solidBg: "bg-orange-600" },
  cold: { bg: "bg-blue-100", text: "text-blue-700", solidBg: "bg-blue-600" },
};

const FALLBACK: StatusColor = {
  bg: "bg-gray-100",
  text: "text-gray-600",
  solidBg: "bg-gray-500",
};

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/[\s-]+/g, "_");
}

function formatLabel(status: string): string {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, variant = "subtle", className }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const colors = STATUS_COLORS[normalized] || FALLBACK;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        variant === "subtle"
          ? cn(colors.bg, colors.text)
          : cn(colors.solidBg, "text-white"),
        className,
      )}
    >
      {formatLabel(status)}
    </span>
  );
}
