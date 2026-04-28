import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AvatarUpload from '@/components/admin/AvatarUpload';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import SecuritySection from './SecuritySection';
import SessionSection from './SessionSection';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().optional(),
  position: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const SectionHeading = ({ title, description }: { title: string; description?: string }) => (
  <div>
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
  </div>
);

const ProfileSection = () => {
  const { user } = useAuth();
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const { data: fullProfile, isLoading } = useQuery({
    queryKey: ['user-profile', teamMember?.id],
    queryFn: async () => {
      if (!teamMember) return null;
      const { data, error } = await supabase
        .from('users')
        .select('name, email, phone, position, city, state, zip_code, avatar_url')
        .eq('id', teamMember.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!teamMember,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      phone: '',
      position: '',
      city: '',
      state: '',
      zip_code: '',
    },
  });

  useEffect(() => {
    if (fullProfile) {
      form.reset({
        name: fullProfile.name || '',
        phone: fullProfile.phone || '',
        position: fullProfile.position || '',
        city: fullProfile.city || '',
        state: fullProfile.state || '',
        zip_code: fullProfile.zip_code || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullProfile]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!teamMember) return;
    const { error } = await supabase
      .from('users')
      .update({
        name: values.name,
        phone: values.phone || null,
        position: values.position || null,
        city: values.city || null,
        state: values.state || null,
        zip_code: values.zip_code || null,
      })
      .eq('id', teamMember.id);

    if (error) {
      toast.error('Failed to update profile');
      return;
    }

    toast.success('Profile updated');
    queryClient.invalidateQueries({ queryKey: ['team-member'] });
    queryClient.invalidateQueries({ queryKey: ['team-members'] });
    queryClient.invalidateQueries({ queryKey: ['assignable-users'] });
    queryClient.invalidateQueries({ queryKey: ['user-profile', teamMember.id] });
  };

  const handleDeleteAccount = async () => {
    toast.error('Account deletion requires admin approval — please contact your workspace owner.');
  };

  if (isLoading || !teamMember) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information, security, and active sessions.
        </p>
      </div>

      {/* Photo */}
      <section className="space-y-4">
        <SectionHeading title="Profile photo" description="JPEG or PNG, recommended 400×400, max 5 MB." />
        <div className="flex items-center gap-4">
          <AvatarUpload
            userId={teamMember.id}
            currentAvatarUrl={fullProfile?.avatar_url}
            fallbackInitials={(teamMember.name || '??').substring(0, 2).toUpperCase()}
            size="lg"
            tableName="users"
            tableIdColumn="id"
            queryKeysToInvalidate={[['team-member', user?.id || ''], ['team-members'], ['user-profile', teamMember.id]]}
          />
          <div>
            <p className="font-medium">{teamMember.name}</p>
            <p className="text-sm text-muted-foreground">{fullProfile?.email}</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Name + contact */}
      <section className="space-y-4">
        <SectionHeading title="Personal information" />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Email</Label>
                <Input value={fullProfile?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Update via Change Email below.</p>
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4567" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Senior Loan Officer" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <Separator />

      {/* Security (email + password) */}
      <section className="space-y-4">
        <SectionHeading title="Security" description="Update your email or password." />
        <SecuritySection />
      </section>

      <Separator />

      {/* 2FA */}
      <section className="space-y-3">
        <SectionHeading title="Two-factor authentication" description="Add an extra step at sign-in." />
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium">Authenticator app</p>
            <p className="text-xs text-muted-foreground mt-1">
              {twoFactorEnabled ? 'Enabled — codes required at every sign-in.' : 'Coming soon — authenticator-based MFA.'}
            </p>
          </div>
          <Switch
            checked={twoFactorEnabled}
            onCheckedChange={(v) => {
              setTwoFactorEnabled(v);
              toast.info('Two-factor enrollment will be available shortly.');
            }}
            disabled
          />
        </div>
      </section>

      <Separator />

      {/* Sessions */}
      <section className="space-y-4">
        <SectionHeading title="Sessions" description="Where you're signed in." />
        <SessionSection />
      </section>

      <Separator />

      {/* Danger zone */}
      <section className="space-y-3">
        <SectionHeading title="Danger zone" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground mt-1">
              Permanently delete your account and remove your data. This action can't be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove your data from the workspace. Account deletion is processed by an
                  admin — you'll receive a confirmation email.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, request deletion
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
};

export default ProfileSection;
