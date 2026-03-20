import { FileSpreadsheet } from 'lucide-react';

interface SheetFileCardProps {
  name: string;
  modifiedTime: string;
  onClick: () => void;
}

export function SheetFileCard({ name, modifiedTime, onClick }: SheetFileCardProps) {
  const formattedDate = new Date(modifiedTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center text-left w-full rounded-xl border border-border/50 bg-background hover:shadow-md hover:border-border transition-all duration-150 overflow-hidden"
    >
      {/* Thumbnail area */}
      <div className="w-full aspect-[4/3] bg-[#f0faf0] flex items-center justify-center border-b border-border/30">
        <FileSpreadsheet className="h-12 w-12 text-emerald-600 opacity-60 group-hover:opacity-90 transition-opacity" />
      </div>
      {/* File info */}
      <div className="w-full px-3 py-2.5 space-y-0.5">
        <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
      </div>
    </button>
  );
}
