import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  fallbackInitials: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
};

export const AvatarUpload = ({
  userId,
  currentAvatarUrl,
  fallbackInitials,
  className = '',
  size = 'md',
}: AvatarUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) return;

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Delete existing avatar if any
      await supabase.storage.from('avatars').remove([filePath]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update team_members with new avatar URL
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast.success('Profile photo updated!');
      setIsOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Invalidate queries to refresh avatar
      queryClient.invalidateQueries({ queryKey: ['team-member'] });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!userId) return;

    setUploading(true);
    try {
      // Remove from storage
      const { error: storageError } = await supabase.storage
        .from('avatars')
        .remove([`${userId}/avatar.png`, `${userId}/avatar.jpg`, `${userId}/avatar.jpeg`, `${userId}/avatar.webp`]);

      // Update team_members to remove avatar URL
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ avatar_url: null })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast.success('Profile photo removed');
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['team-member'] });
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error('Failed to remove photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`relative cursor-pointer ${className} group/avatar`}
      >
        <Avatar className={`${sizeClasses[size]} ring-2 ring-sidebar-border transition-all group-hover/avatar:ring-sidebar-primary`}>
          <AvatarImage src={currentAvatarUrl || undefined} alt="Profile" />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-base font-medium">
            {fallbackInitials}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            {/* Preview */}
            <div className="relative">
              <Avatar className="w-32 h-32 ring-4 ring-muted">
                <AvatarImage src={previewUrl || currentAvatarUrl || undefined} alt="Preview" />
                <AvatarFallback className="text-3xl font-medium bg-muted">
                  {fallbackInitials}
                </AvatarFallback>
              </Avatar>
              {previewUrl && (
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="w-4 h-4 mr-2" />
                Choose Photo
              </Button>
              
              {currentAvatarUrl && !previewUrl && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                </Button>
              )}
            </div>

            {/* Upload button */}
            {previewUrl && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Photo'
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
