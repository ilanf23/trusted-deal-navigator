import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SheetEditor } from '@/components/admin/sheets/SheetEditor';
import { useTeamMember } from '@/hooks/useTeamMember';

interface SheetViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spreadsheetId: string;
  spreadsheetName: string;
}

export function SheetViewerDialog({
  open,
  onOpenChange,
  spreadsheetId,
  spreadsheetName,
}: SheetViewerDialogProps) {
  const { teamMember } = useTeamMember();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="truncate">{spreadsheetName}</DialogTitle>
        </DialogHeader>
        <div className="h-[80vh] overflow-hidden">
          <SheetEditor
            spreadsheetId={spreadsheetId}
            spreadsheetName={spreadsheetName}
            teamMemberName={teamMember?.name}
            onBack={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
