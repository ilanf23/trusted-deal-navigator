import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Camera, Loader2, X, ZoomIn, ZoomOut, RotateCw, Square, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  fallbackInitials: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tableName?: string;
  tableIdColumn?: string;
  tableImageColumn?: string;
  queryKeysToInvalidate?: string[][];
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
};

type ShapeType = 'circle' | 'square';
type Step = 'select' | 'crop' | 'preview';

interface CropState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export const AvatarUpload = ({
  userId,
  currentAvatarUrl,
  fallbackInitials,
  className = '',
  size = 'md',
  tableName = 'users',
  tableIdColumn = 'user_id',
  tableImageColumn = 'avatar_url',
  queryKeysToInvalidate = [['team-member'], ['team-members']],
}: AvatarUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [uploading, setUploading] = useState(false);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [shape, setShape] = useState<ShapeType>('circle');
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const queryClient = useQueryClient();

  const CANVAS_SIZE = 280;
  const OUTPUT_SIZE = 400;

  // Draw the crop preview on canvas
  const drawCropCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Dark overlay background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.rotate((crop.rotation * Math.PI) / 180);
    ctx.scale(crop.zoom, crop.zoom);
    ctx.translate(-CANVAS_SIZE / 2 + crop.x, -CANVAS_SIZE / 2 + crop.y);

    const scale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = (CANVAS_SIZE - drawW) / 2;
    const drawY = (CANVAS_SIZE - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Clip mask overlay
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    } else {
      const r = 16;
      const s = CANVAS_SIZE;
      ctx.moveTo(r, 0);
      ctx.lineTo(s - r, 0);
      ctx.quadraticCurveTo(s, 0, s, r);
      ctx.lineTo(s, s - r);
      ctx.quadraticCurveTo(s, s, s - r, s);
      ctx.lineTo(r, s);
      ctx.quadraticCurveTo(0, s, 0, s - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
    }
    ctx.fill();
    ctx.restore();

    // Border guide
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
    } else {
      ctx.roundRect(1, 1, CANVAS_SIZE - 2, CANVAS_SIZE - 2, 15);
    }
    ctx.stroke();
    ctx.restore();
  }, [crop, shape]);

  useEffect(() => {
    if (step === 'crop') drawCropCanvas();
  }, [crop, shape, step, drawCropCanvas]);

  const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.src = url;
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setRawImageUrl(url);
    imageRef.current = await loadImage(url);
    setCrop({ x: 0, y: 0, zoom: 1, rotation: 0 });
    setStep('crop');
  };

  // Generate cropped output
  const applyCrop = useCallback(async () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = OUTPUT_SIZE / CANVAS_SIZE;

    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.rotate((crop.rotation * Math.PI) / 180);
    ctx.scale(crop.zoom, crop.zoom);
    ctx.translate(-OUTPUT_SIZE / 2 + crop.x * scale, -OUTPUT_SIZE / 2 + crop.y * scale);

    const imgScale = Math.max(OUTPUT_SIZE / img.naturalWidth, OUTPUT_SIZE / img.naturalHeight);
    const drawW = img.naturalWidth * imgScale;
    const drawH = img.naturalHeight * imgScale;
    ctx.drawImage(img, (OUTPUT_SIZE - drawW) / 2, (OUTPUT_SIZE - drawH) / 2, drawW, drawH);
    ctx.restore();

    // Apply shape clip
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    } else {
      const r = 24;
      const s = OUTPUT_SIZE;
      ctx.moveTo(r, 0); ctx.lineTo(s - r, 0); ctx.quadraticCurveTo(s, 0, s, r);
      ctx.lineTo(s, s - r); ctx.quadraticCurveTo(s, s, s - r, s);
      ctx.lineTo(r, s); ctx.quadraticCurveTo(0, s, 0, s - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    }
    ctx.fill();

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCroppedBlob(blob);
      setCroppedUrl(canvas.toDataURL('image/png'));
      setStep('preview');
    }, 'image/png');
  }, [crop, shape]);

  // Drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCrop(c => ({ ...c, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleUpload = async () => {
    if (!croppedBlob || !userId) return;
    setUploading(true);
    try {
      const filePath = `${userId}/avatar.png`;
      await supabase.storage.from('avatars').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/png' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [tableImageColumn]: `${urlData.publicUrl}?t=${Date.now()}` })
        .eq(tableIdColumn, userId);
      if (updateError) throw updateError;

      toast.success('Profile photo updated!');
      handleClose();
      for (const key of queryKeysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    } catch (error: any) {
      toast.error('Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      await supabase.storage.from('avatars').remove([
        `${userId}/avatar.png`, `${userId}/avatar.jpg`,
        `${userId}/avatar.jpeg`, `${userId}/avatar.webp`,
      ]);
      const { error } = await supabase.from(tableName)
        .update({ [tableImageColumn]: null }).eq(tableIdColumn, userId);
      if (error) throw error;
      toast.success('Profile photo removed');
      handleClose();
      for (const key of queryKeysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    } catch (error: any) {
      toast.error('Failed to remove photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('select');
    setCroppedUrl(null);
    setCroppedBlob(null);
    setRawImageUrl(null);
    imageRef.current = null;
    setCrop({ x: 0, y: 0, zoom: 1, rotation: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`relative cursor-pointer ${className} group/avatar`}
      >
        <Avatar className={`${sizeClasses[size]} border border-sidebar-border/50 transition-all group-hover/avatar:border-sidebar-foreground/40`}>
          <AvatarImage src={currentAvatarUrl || undefined} alt="Profile" />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-base font-medium">
            {fallbackInitials}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'select' && 'Update Profile Photo'}
              {step === 'crop' && 'Crop & Adjust'}
              {step === 'preview' && 'Preview & Save'}
            </DialogTitle>
          </DialogHeader>

          {/* STEP: SELECT */}
          {step === 'select' && (
            <div className="flex flex-col items-center gap-6 py-4">
              <Avatar className="w-32 h-32 ring-4 ring-muted">
                <AvatarImage src={currentAvatarUrl || undefined} alt="Current" />
                <AvatarFallback className="text-3xl font-medium bg-muted">{fallbackInitials}</AvatarFallback>
              </Avatar>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  Choose Photo
                </Button>
                {currentAvatarUrl && (
                  <Button variant="destructive" onClick={handleRemove} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* STEP: CROP */}
          {step === 'crop' && (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Shape selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShape('circle')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                    shape === 'circle'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary'
                  )}
                >
                  <Circle className="w-4 h-4" /> Circle
                </button>
                <button
                  onClick={() => setShape('square')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                    shape === 'square'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary'
                  )}
                >
                  <Square className="w-4 h-4" /> Square
                </button>
              </div>

              {/* Canvas crop area */}
              <div className="relative rounded-xl overflow-hidden bg-background shadow-inner border border-border">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  className="cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                <p className="absolute bottom-2 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
                  Drag to reposition
                </p>
              </div>

              {/* Zoom */}
              <div className="w-full space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ZoomOut className="w-3 h-3" /> Zoom</span>
                  <span>{Math.round(crop.zoom * 100)}%</span>
                </div>
                <Slider
                  min={50} max={300} step={1}
                  value={[crop.zoom * 100]}
                  onValueChange={([v]) => setCrop(c => ({ ...c, zoom: v / 100 }))}
                />
              </div>

              {/* Rotation */}
              <div className="w-full space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><RotateCw className="w-3 h-3" /> Rotate</span>
                  <span>{crop.rotation}°</span>
                </div>
                <Slider
                  min={-180} max={180} step={1}
                  value={[crop.rotation]}
                  onValueChange={([v]) => setCrop(c => ({ ...c, rotation: v }))}
                />
              </div>

              <div className="flex gap-3 w-full pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setStep('select'); setCrop({ x: 0, y: 0, zoom: 1, rotation: 0 }); }}>
                  Back
                </Button>
                <Button className="flex-1" onClick={applyCrop}>
                  Apply Crop
                </Button>
              </div>
            </div>
          )}

          {/* STEP: PREVIEW */}
          {step === 'preview' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="flex gap-6 items-end">
                {/* Large preview */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn('w-24 h-24 overflow-hidden ring-4 ring-muted', shape === 'circle' ? 'rounded-full' : 'rounded-2xl')}
                    style={{ backgroundImage: `url(${croppedUrl})`, backgroundSize: 'cover' }}
                  />
                  <span className="text-xs text-muted-foreground">Large</span>
                </div>
                {/* Medium preview */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn('w-12 h-12 overflow-hidden ring-2 ring-muted', shape === 'circle' ? 'rounded-full' : 'rounded-xl')}
                    style={{ backgroundImage: `url(${croppedUrl})`, backgroundSize: 'cover' }}
                  />
                  <span className="text-xs text-muted-foreground">Medium</span>
                </div>
                {/* Small preview */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn('w-8 h-8 overflow-hidden ring-2 ring-muted', shape === 'circle' ? 'rounded-full' : 'rounded-lg')}
                    style={{ backgroundImage: `url(${croppedUrl})`, backgroundSize: 'cover' }}
                  />
                  <span className="text-xs text-muted-foreground">Small</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Preview at multiple sizes — looks good?
              </p>

              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setStep('crop')}>
                  Edit Again
                </Button>
                <Button className="flex-1" onClick={handleUpload} disabled={uploading}>
                  {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : 'Save Photo'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
