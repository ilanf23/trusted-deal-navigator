import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, Check, X, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

// --- Email Change ---

const emailSchema = z.object({
  newEmail: z.string().email('Please enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

// --- Password Change ---

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

// --- Password Strength ---

interface StrengthRule {
  label: string;
  test: (pw: string) => boolean;
}

const strengthRules: StrengthRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw) => /\d/.test(pw) },
  { label: 'Special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const getStrength = (pw: string) => {
  const passed = strengthRules.filter((r) => r.test(pw)).length;
  return Math.round((passed / strengthRules.length) * 100);
};

const getStrengthLabel = (strength: number) => {
  if (strength <= 20) return 'Very weak';
  if (strength <= 40) return 'Weak';
  if (strength <= 60) return 'Fair';
  if (strength <= 80) return 'Good';
  return 'Strong';
};

const getStrengthColor = (strength: number) => {
  if (strength <= 20) return '#ef4444';
  if (strength <= 40) return '#f97316';
  if (strength <= 60) return '#eab308';
  if (strength <= 80) return '#3b82f6';
  return '#22c55e';
};

const SecuritySection = () => {
  const { user } = useAuth();

  // Get last password change date from user metadata
  const lastPasswordChange = user?.user_metadata?.last_password_change as string | undefined;

  return (
    <div className="space-y-8">
      <EmailChangeForm currentEmail={user?.email} />
      <Separator />
      <PasswordChangeForm lastPasswordChange={lastPasswordChange} />
    </div>
  );
};

// --- Email Change Form ---

const EmailChangeForm = ({ currentEmail }: { currentEmail?: string }) => {
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '' },
  });

  const onSubmit = async (values: EmailFormValues) => {
    if (values.newEmail === currentEmail) {
      toast.error('New email is the same as your current email');
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: values.newEmail });

    if (error) {
      toast.error(error.message || 'Failed to update email');
      return;
    }

    toast.success('Confirmation email sent to both your old and new email addresses');
    form.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-medium">Change Email</h3>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          A confirmation email will be sent to both your current and new email addresses. You must confirm from both to complete the change.
        </p>
      </div>

      {currentEmail && (
        <p className="text-sm text-muted-foreground">
          Current email: <span className="font-medium text-foreground">{currentEmail}</span>
        </p>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="newEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Email Address</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="Enter new email address" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Update Email'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

// --- Password Change Form ---

const PasswordChangeForm = ({ lastPasswordChange }: { lastPasswordChange?: string }) => {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = form.watch('newPassword');
  const strength = getStrength(newPassword);

  const onSubmit = async (values: PasswordFormValues) => {
    // Verify current password by attempting to sign in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      toast.error('Unable to verify identity');
      return;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.currentPassword,
    });

    if (verifyError) {
      toast.error('Current password is incorrect');
      form.setError('currentPassword', { message: 'Current password is incorrect' });
      return;
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: values.newPassword,
      data: { last_password_change: new Date().toISOString() },
    });

    if (error) {
      toast.error(error.message || 'Failed to update password');
      return;
    }

    toast.success('Password updated successfully');
    form.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-medium">Change Password</h3>
      </div>

      {lastPasswordChange && (
        <p className="text-sm text-muted-foreground">
          Last changed: {new Date(lastPasswordChange).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input {...field} type={showCurrent ? 'text' : 'password'} placeholder="Enter current password" />
                    <PasswordToggle show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input {...field} type={showNew ? 'text' : 'password'} placeholder="Enter new password" />
                    <PasswordToggle show={showNew} onToggle={() => setShowNew(!showNew)} />
                  </div>
                </FormControl>
                <FormMessage />

                {/* Strength indicator */}
                {newPassword.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full transition-all rounded-full"
                          style={{ width: `${strength}%`, backgroundColor: getStrengthColor(strength) }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-20 text-right">{getStrengthLabel(strength)}</span>
                    </div>
                    <ul className="space-y-1">
                      {strengthRules.map((rule) => {
                        const passed = rule.test(newPassword);
                        return (
                          <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                            {passed ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <X className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={passed ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
                              {rule.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input {...field} type={showConfirm ? 'text' : 'password'} placeholder="Confirm new password" />
                    <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

// --- Password Toggle (module-scoped to avoid remounting on parent re-render) ---

const PasswordToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={show ? 'Hide password' : 'Show password'}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    tabIndex={-1}
  >
    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
);

export default SecuritySection;
