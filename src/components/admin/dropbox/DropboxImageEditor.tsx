import { useState, useCallback, useRef, useEffect } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, X, Save, Download, Link, Share2 } from 'lucide-react';
import { useDropboxSaveEdited, type DropboxEntry } from '@/hooks/useDropbox';
import '@/styles/filerobot-overrides.css';

type EditorTab = 'Adjust' | 'Annotate' | 'Filters' | 'Resize';

interface DropboxImageEditorProps {
  entry: DropboxEntry;
  imageUrl: string;
  initialTab?: EditorTab;
  onClose: () => void;
  onSaved: () => void;
}

const darkTheme = {
  palette: {
    'bg-secondary': '#18181b',
    'bg-primary': '#27272a',
    'bg-primary-active': '#3f3f46',
    'bg-hover': '#1c1c1f',
    'bg-stateless': '#27272a',
    'accent-primary': '#2563eb',
    'accent-primary-active': '#1d4ed8',
    'icons-primary': '#e4e4e7',
    'icons-secondary': '#a1a1aa',
    'borders-secondary': '#3f3f46',
    'borders-primary': '#52525b',
    'borders-strong': '#71717a',
    'light-shadow': 'rgba(0, 0, 0, 0.3)',
    'warning': '#ef4444',
    'txt-primary': '#fafafa',
    'txt-secondary': '#a1a1aa',
    'txt-primary-invert': '#18181b',
    'txt-placeholder': '#71717a',
    'btn-primary-text': '#ffffff',
    'btn-disabled-text': '#52525b',
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
  },
};

const tabMap: Record<string, string> = {
  Adjust: TABS.ADJUST,
  Annotate: TABS.ANNOTATE,
  Filters: TABS.FILTERS,
  Resize: TABS.RESIZE,
};

export function DropboxImageEditor({ entry, imageUrl, initialTab, onClose, onSaved }: DropboxImageEditorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  const [pendingExtension, setPendingExtension] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const saveEditedMutation = useDropboxSaveEdited();
  const getCurrentImgDataFnRef = useRef<(() => any) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Block Escape from propagating outside so parent handlers don't fire
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // If save dialog is open, let dialog handle it. Otherwise close editor.
        if (!saveDialogOpen) {
          onClose();
        }
      }
    };
    // Use capture to intercept before other listeners
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, saveDialogOpen]);

  const handleEditorSave = useCallback((editedImageObject: any) => {
    setPendingImageBase64(editedImageObject.imageBase64);
    setPendingExtension(editedImageObject.extension);
    setSaveDialogOpen(true);
  }, []);

  const triggerSave = useCallback(() => {
    if (getCurrentImgDataFnRef.current) {
      const imgData = getCurrentImgDataFnRef.current();
      if (imgData) {
        handleEditorSave(imgData);
      }
    }
  }, [handleEditorSave]);

  const triggerDownload = useCallback(() => {
    if (getCurrentImgDataFnRef.current) {
      const imgData = getCurrentImgDataFnRef.current();
      if (imgData?.imageBase64) {
        const link = document.createElement('a');
        link.href = imgData.imageBase64;
        link.download = imgData.fullName || entry.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [entry.name]);

  const doSave = useCallback(async (mode: 'overwrite' | 'copy') => {
    if (!pendingImageBase64) return;

    setSaving(true);
    try {
      const base64Data = pendingImageBase64.includes(',')
        ? pendingImageBase64.split(',')[1]
        : pendingImageBase64;

      let targetPath: string;
      if (mode === 'overwrite') {
        targetPath = entry.path_lower;
      } else {
        const dir = entry.path_lower.substring(0, entry.path_lower.lastIndexOf('/'));
        const nameParts = entry.name.split('.');
        const ext = nameParts.length > 1 ? nameParts.pop() : pendingExtension;
        const baseName = nameParts.join('.');
        targetPath = `${dir}/${baseName}_edited.${ext}`;
      }

      await saveEditedMutation.mutateAsync({
        path: targetPath,
        content: base64Data,
        mode: mode === 'overwrite' ? 'overwrite' : 'add',
      });

      setSaveDialogOpen(false);
      onSaved();
    } catch {
      // Error toast handled by the mutation
    } finally {
      setSaving(false);
    }
  }, [pendingImageBase64, pendingExtension, entry, saveEditedMutation, onSaved]);

  const fileNameParts = entry.name.split('.');
  const extension = fileNameParts.length > 1 ? fileNameParts.pop()!.toUpperCase() : '';
  const baseName = fileNameParts.join('.');

  const dropboxWebUrl = `https://www.dropbox.com/home${entry.path_display ? entry.path_display.substring(0, entry.path_display.lastIndexOf('/')) : ''}?preview=${encodeURIComponent(entry.name)}`;

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 z-50 bg-zinc-950 flex flex-col" style={{ height: '100vh', width: '100vw' }}>
        {/* Header — Google Drive style */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-950 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-white hover:bg-zinc-800" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-zinc-400">Dropbox</span>
              <span className="text-zinc-500">/</span>
              <span className="font-medium text-white">{baseName}</span>
              {extension && (
                <span className="ml-1 px-1.5 py-0.5 bg-zinc-700 text-zinc-300 text-[10px] font-semibold uppercase rounded">
                  {extension}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5"
              onClick={() => navigator.clipboard.writeText(dropboxWebUrl)}
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5"
              onClick={triggerDownload}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={triggerSave}
            >
              <Save className="h-4 w-4" />
              Save to Dropbox
            </Button>
          </div>
        </div>

        {/* Editor area — takes remaining height */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <FilerobotImageEditor
            source={imageUrl}
            onSave={handleEditorSave}
            getCurrentImgDataFnRef={getCurrentImgDataFnRef}
            theme={darkTheme}
            removeSaveButton
            annotationsCommon={{
              fill: '#2563eb',
              stroke: '#1e40af',
              strokeWidth: 2,
            }}
            Text={{
              text: 'Text',
              fontSize: 20,
              fontFamily: 'Inter',
              fonts: ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New'],
            }}
            Rotate={{ angle: 90, componentType: 'slider' }}
            Crop={{
              presetsItems: [
                { titleKey: '16:9', descriptionKey: '16:9', ratio: 16 / 9 },
                { titleKey: '4:3', descriptionKey: '4:3', ratio: 4 / 3 },
                { titleKey: '1:1', descriptionKey: '1:1', ratio: 1 },
                { titleKey: '3:4', descriptionKey: '3:4', ratio: 3 / 4 },
                { titleKey: '9:16', descriptionKey: '9:16', ratio: 9 / 16 },
              ],
            }}
            tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.RESIZE]}
            defaultTabId={initialTab ? tabMap[initialTab] || TABS.ADJUST : TABS.ADJUST}
            defaultToolId={TOOLS.CROP}
            savingPixelRatio={4}
            previewPixelRatio={2}
            observePluginContainerSize
          />
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Save edited image</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            How would you like to save <span className="font-medium text-foreground">{entry.name}</span>?
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => doSave('copy')} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save as Copy
            </Button>
            <Button onClick={() => doSave('overwrite')} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Overwrite Original
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
