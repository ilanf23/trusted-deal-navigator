import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export const AVATAR_COLORS = [
  'bg-[#5C9EAD]', 'bg-[#4CAF50]', 'bg-[#C62828]', 'bg-[#EF6C00]',
  'bg-[#546E7A]', 'bg-[#26A69A]', 'bg-[#6D8B74]', 'bg-[#3E7CB1]',
  'bg-[#8D6E63]', 'bg-[#78909C]',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

type CrmAvatarSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CrmAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: CrmAvatarSize;
  className?: string;
}

const sizeConfig: Record<CrmAvatarSize, { container: string; font: string }> = {
  xxs: { container: 'h-4 w-4', font: 'text-[7px]' },
  xs:  { container: 'h-5 w-5', font: 'text-[8px]' },
  sm:  { container: 'h-6 w-6', font: 'text-[10px]' },
  md:  { container: 'h-7 w-7', font: 'text-[11px]' },
  lg:  { container: 'h-8 w-8', font: 'text-xs' },
  xl:  { container: 'h-14 w-14', font: 'text-lg' },
};

export function CrmAvatar({ name, imageUrl, size = 'md', className }: CrmAvatarProps) {
  const { container, font } = sizeConfig[size];
  const color = getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <Avatar className={cn(container, 'shadow-sm', className)}>
      {imageUrl && (
        <AvatarImage src={imageUrl} alt={name} className="object-cover" />
      )}
      <AvatarFallback className={cn(color, font, 'text-white font-bold')}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export default CrmAvatar;
