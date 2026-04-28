import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useWorkspaceSettings, useUpdateWorkspaceSettings } from '@/hooks/useWorkspaceSettings';
import { supabase } from '@/integrations/supabase/client';

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <Label className="text-sm font-medium">{label}</Label>
    <div className="mt-2 flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 rounded cursor-pointer border border-border"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
    </div>
  </div>
);

const ThemeOption = ({
  v,
  label,
  current,
  onClick,
}: {
  v: string;
  label: string;
  current: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
      current === v ? 'bg-[#3b2778] border-[#3b2778] text-white' : 'border-border hover:bg-muted'
    }`}
  >
    {label}
  </button>
);

const BrandingSection = () => {
  const { workspace } = useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();
  const { theme, setTheme } = useTheme();

  const [primary, setPrimary] = useState(workspace.primary_color ?? '#3b2778');
  const [secondary, setSecondary] = useState(workspace.secondary_color ?? '#eee6f6');
  const [accent, setAccent] = useState(workspace.accent_color ?? '#ec4899');
  const [logoUrl, setLogoUrl] = useState<string | null>(workspace.logo_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrimary(workspace.primary_color ?? '#3b2778');
    setSecondary(workspace.secondary_color ?? '#eee6f6');
    setAccent(workspace.accent_color ?? '#ec4899');
    setLogoUrl(workspace.logo_url);
  }, [workspace]);

  // Apply CSS vars live
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-secondary', secondary);
    root.style.setProperty('--brand-accent', accent);
  }, [primary, secondary, accent]);

  const sampleColors = (file: File) => {
    return new Promise<{ primary: string; secondary: string }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ primary, secondary });
        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;
        const counts = new Map<string, number>();
        for (let i = 0; i < imgData.length; i += 16) {
          if (imgData[i + 3] < 200) continue;
          const r = (imgData[i] >> 4) << 4;
          const g = (imgData[i + 1] >> 4) << 4;
          const b = (imgData[i + 2] >> 4) << 4;
          const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        resolve({
          primary: sorted[0]?.[0] ?? primary,
          secondary: sorted[1]?.[0] ?? secondary,
        });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }
    setUploading(true);
    try {
      const path = `workspace/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setLogoUrl(data.publicUrl);

      const sampled = await sampleColors(file);
      setPrimary(sampled.primary);
      setSecondary(sampled.secondary);
      toast.success('Logo uploaded — colors auto-suggested');
    } catch (err) {
      toast.error('Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        primary_color: primary,
        secondary_color: secondary,
        accent_color: accent,
        logo_url: logoUrl,
        default_theme: theme ?? 'system',
      });
      toast.success('Branding saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding & Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workspace logo, colors, and default theme. <em>MVP scope:</em> colors apply to the workspace switcher and active
          settings nav. Migrating the rest of the UI to brand tokens is a follow-up.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Logo */}
          <div>
            <Label className="text-sm font-medium">Logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-16 w-16 rounded-md border border-border flex items-center justify-center bg-muted overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-full max-w-full" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="icon" onClick={() => setLogoUrl(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">PNG / SVG / JPG, ≤2 MB. Color extraction auto-suggests palette.</p>
          </div>

          <Separator />

          <ColorField label="Primary color" value={primary} onChange={setPrimary} />
          <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
          <ColorField label="Accent color" value={accent} onChange={setAccent} />

          <Separator />

          <div>
            <Label className="text-sm font-medium">Default theme</Label>
            <div className="mt-2 flex gap-2">
              <ThemeOption v="light" label="Light" current={theme ?? 'system'} onClick={() => setTheme('light')} />
              <ThemeOption v="dark" label="Dark" current={theme ?? 'system'} onClick={() => setTheme('dark')} />
              <ThemeOption v="system" label="System" current={theme ?? 'system'} onClick={() => setTheme('system')} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save branding
          </Button>
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider">Live preview</Label>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex">
              {/* Mock sidebar */}
              <div className="w-32 p-3 space-y-2" style={{ backgroundColor: primary }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-8 w-auto brightness-0 invert opacity-90" />
                ) : (
                  <span className="text-white text-sm font-bold tracking-tight">CLX</span>
                )}
                <div className="space-y-1.5 pt-2">
                  <div className="h-2 rounded bg-white/30" />
                  <div className="h-2 rounded bg-white/20 w-3/4" />
                  <div className="h-2 rounded bg-white/30" />
                  <div className="h-2 rounded bg-white/20 w-2/3" />
                </div>
              </div>
              {/* Mock content */}
              <div className="flex-1 p-4 space-y-3 bg-background">
                <div className="text-sm font-semibold">Sample dashboard</div>
                <div
                  className="rounded-md p-3 text-xs font-medium"
                  style={{ backgroundColor: secondary, color: primary }}
                >
                  Active item — uses secondary background, primary text
                </div>
                <button
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  Primary CTA
                </button>
                <div className="h-1 rounded" style={{ backgroundColor: primary }} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border p-2">
                    <div className="text-[10px] text-muted-foreground">Card</div>
                    <div className="text-base font-bold" style={{ color: primary }}>
                      $1.2M
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <div className="text-[10px] text-muted-foreground">Card</div>
                    <div className="text-base font-bold" style={{ color: accent }}>
                      +14
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSection;
