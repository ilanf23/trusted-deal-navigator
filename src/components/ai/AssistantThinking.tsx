import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cycling status lines shown while the assistant runs its tool-calling read
 * loop. Generic by design — never reference a specific person or page.
 */
const STATUSES = [
  'Thinking',
  'Reading your data',
  'Connecting the dots',
  'Pulling it together',
];

interface AssistantThinkingProps {
  className?: string;
}

/**
 * Premium "AI is working" indicator for the CLX Assistant chat.
 * A glowing orb with an orbiting sparkle paired with shimmering status text
 * that cycles through what the assistant is doing. Replaces the plain
 * three-dot typing indicator.
 */
const AssistantThinking = ({ className }: AssistantThinkingProps) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % STATUSES.length);
    }, 1900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={cn('flex items-center gap-2.5 py-1.5', className)}>
      {/* Animated AI orb */}
      <span className="relative flex h-5 w-5 items-center justify-center">
        {/* soft pulsing aura */}
        <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping motion-reduce:hidden" />
        {/* glowing core */}
        <span className="relative h-2.5 w-2.5 rounded-full bg-gradient-to-br from-primary to-primary/40 shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
        {/* orbiting sparkle */}
        <span className="absolute inset-0 animate-loader-orbit motion-reduce:animate-none">
          <Sparkles
            className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 text-primary"
            strokeWidth={2.5}
          />
        </span>
      </span>

      {/* Shimmering, cycling status text */}
      <span key={idx} className="animate-fade-in">
        <span
          className={cn(
            'bg-clip-text text-sm font-medium text-transparent',
            'bg-[linear-gradient(110deg,hsl(var(--muted-foreground))_30%,hsl(var(--primary))_50%,hsl(var(--muted-foreground))_70%)]',
            'bg-[length:200%_100%] animate-text-shimmer',
            'motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground',
          )}
        >
          {STATUSES[idx]}
        </span>
        <span className="text-sm font-medium text-primary/70">…</span>
      </span>
    </div>
  );
};

export default AssistantThinking;
