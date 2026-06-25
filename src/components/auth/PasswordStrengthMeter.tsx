import { Check, X } from 'lucide-react';
import {
  strengthRules,
  getStrength,
  getStrengthLabel,
  getStrengthColor,
} from '@/lib/password';

interface PasswordStrengthMeterProps {
  password: string;
}

/**
 * Live password-strength indicator: a progress bar plus a per-rule checklist.
 * Renders nothing until the user types something. Shared by the signup form
 * (Auth.tsx) and the change-password form (SecuritySection.tsx).
 */
const PasswordStrengthMeter = ({ password }: PasswordStrengthMeterProps) => {
  if (password.length === 0) return null;

  const strength = getStrength(password);

  return (
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
          const passed = rule.test(password);
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
  );
};

export default PasswordStrengthMeter;
