import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  position: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfileSection = () => {
  const { user } = useAuth();
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();

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
  }, [fullProfile, form]);

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
    queryClient.invalidateQueries({ queryKey: ['user-profile', teamMember.id] });
  };

  if (isLoading || !teamMember) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <AvatarUpload
          userId={teamMember.id}
          currentAvatarUrl={fullProfile?.avatar_url}
          fallbackInitials={(teamMember.name || '??').substring(0, 2).toUpperCase()}
          size="lg"
          tableName="users"
          queryKeysToInvalidate={[['team-member', user?.id || ''], ['team-members'], ['user-profile', teamMember.id]]}
        />
        <div>
          <p className="font-medium">{teamMember.name}</p>
          <p className="text-sm text-muted-foreground">{fullProfile?.email}</p>
        </div>
      </div>

      <Separator />

      {/* Profile Form */}
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
              <Label className="text-sm text-muted-foreground">Email</Label>
              <Input value={fullProfile?.email || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Change email in the Security section</p>
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
                <FormLabel>Position / Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Loan Officer" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <p className="text-sm font-medium">Location</p>
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
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ProfileSection;
