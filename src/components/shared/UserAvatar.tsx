import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserAvatar({ src, name, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], "rounded-full", className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="bg-muted text-xs">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
