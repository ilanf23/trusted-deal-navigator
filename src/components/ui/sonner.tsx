import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast, ExternalToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Track recently shown toasts to prevent duplicates
const recentToasts = new Map<string, number>();
const TOAST_COOLDOWN_MS = 3000; // 3 seconds cooldown for same message

// Wrapper to deduplicate toast messages
const createDedupedToast = () => {
  const dedupe = (
    method: typeof sonnerToast.success,
    message: string | React.ReactNode,
    options?: ExternalToast
  ) => {
    const key = typeof message === 'string' ? message : JSON.stringify(message);
    const now = Date.now();
    const lastShown = recentToasts.get(key);
    
    // Skip if same message was shown within cooldown period
    if (lastShown && now - lastShown < TOAST_COOLDOWN_MS) {
      return;
    }
    
    recentToasts.set(key, now);
    
    // Clean up old entries periodically
    if (recentToasts.size > 50) {
      const cutoff = now - TOAST_COOLDOWN_MS;
      for (const [k, v] of recentToasts) {
        if (v < cutoff) recentToasts.delete(k);
      }
    }
    
    return method(message, options);
  };

  // Create wrapper with same API as sonner toast
  const toast = Object.assign(
    (message: string | React.ReactNode, options?: ExternalToast) => 
      dedupe(sonnerToast, message, options),
    {
      success: (message: string | React.ReactNode, options?: ExternalToast) => 
        dedupe(sonnerToast.success, message, options),
      error: (message: string | React.ReactNode, options?: ExternalToast) => 
        dedupe(sonnerToast.error, message, options),
      warning: (message: string | React.ReactNode, options?: ExternalToast) => 
        dedupe(sonnerToast.warning, message, options),
      info: (message: string | React.ReactNode, options?: ExternalToast) => 
        dedupe(sonnerToast.info, message, options),
      loading: sonnerToast.loading,
      promise: sonnerToast.promise,
      custom: sonnerToast.custom,
      dismiss: sonnerToast.dismiss,
      message: sonnerToast.message,
    }
  );

  return toast;
};

const toast = createDedupedToast();

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
