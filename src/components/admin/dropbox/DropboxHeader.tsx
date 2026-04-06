import { useState } from 'react';
import { Plus, Unplug, FolderPlus, FileText, Presentation, Table2, Globe, Upload, ArrowRightLeft, FileInput, Pen, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface DropboxHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  connectedEmail: string | null;
  onDisconnect: () => void;
}

export function DropboxHeader({
  searchQuery,
  onSearchChange,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
  connectedEmail,
  onDisconnect,
}: DropboxHeaderProps) {
  const avatarInitial = connectedEmail?.charAt(0).toUpperCase() || '?';
  const { toast } = useToast();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b">
      {/* + New button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* Create section */}
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuItem onClick={onNewFolder}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Folder
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="h-4 w-4 mr-2" />
              Document
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openExternal('https://docs.google.com/document/create')}>
                Google Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternal('https://office.live.com/start/Word.aspx')}>
                Word Online
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Presentation className="h-4 w-4 mr-2" />
              Presentation
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openExternal('https://docs.google.com/presentation/create')}>
                Google Slides
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternal('https://office.live.com/start/PowerPoint.aspx')}>
                PowerPoint Online
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Table2 className="h-4 w-4 mr-2" />
              Spreadsheet
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openExternal('https://docs.google.com/spreadsheets/create')}>
                Google Sheets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternal('https://office.live.com/start/Excel.aspx')}>
                Excel Online
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => toast({ title: 'Coming soon', description: 'Web shortcut creation is coming soon.' })}>
            <Globe className="h-4 w-4 mr-2" />
            Web shortcut
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Add section */}
          <DropdownMenuLabel>Add</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={onUploadFiles}>
                Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUploadFolder}>
                Folder
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => openExternal('https://www.dropbox.com/transfer')}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer a copy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openExternal('https://www.dropbox.com/requests')}>
            <FileInput className="h-4 w-4 mr-2" />
            Send file request
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openExternal('https://www.dropbox.com/googledrive')}>
            Import from Google Drive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openExternal('https://www.dropbox.com/onedrive')}>
            Import from Microsoft OneDrive
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Modify section */}
          <DropdownMenuLabel>Modify</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Pen className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openExternal('https://www.dropbox.com/paper')}>
                PDF
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PenLine className="h-4 w-4 mr-2" />
              Sign
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openExternal('https://sign.dropbox.com')}>
                Sign yourself
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternal('https://sign.dropbox.com')}>
                Get signatures
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-sm">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Right — account menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{avatarInitial}</AvatarFallback>
            </Avatar>
            {connectedEmail && (
              <span className="text-xs text-muted-foreground max-w-[160px] truncate hidden sm:inline">
                {connectedEmail}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {connectedEmail && (
            <>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate">
                {connectedEmail}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setShowDisconnectDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Unplug className="h-4 w-4 mr-2" />
            Disconnect Dropbox
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Disconnect confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Dropbox?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the Dropbox connection{connectedEmail ? ` for ${connectedEmail}` : ''}. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDisconnect();
                setShowDisconnectDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
