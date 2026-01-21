import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ColorWheelProps {
  value: string;
  onChange: (color: string) => void;
  size?: number;
  className?: string;
}

// Convert HSL to Hex
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Convert Hex to HSL
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, l: 50 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

const ColorWheel = ({ value, onChange, size = 120, className }: ColorWheelProps) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hsl, setHsl] = useState(() => hexToHsl(value));

  useEffect(() => {
    const newHsl = hexToHsl(value);
    setHsl(newHsl);
  }, [value]);

  const getColorFromPosition = useCallback((clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const x = clientX - centerX;
    const y = clientY - centerY;
    
    // Calculate angle (hue) and distance (saturation)
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    
    const maxRadius = rect.width / 2;
    const distance = Math.min(Math.sqrt(x * x + y * y), maxRadius);
    const saturation = (distance / maxRadius) * 100;
    
    const newHsl = { h: angle, s: saturation, l: 50 };
    setHsl(newHsl);
    onChange(hslToHex(newHsl.h, newHsl.s, newHsl.l));
  }, [onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    getColorFromPosition(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      getColorFromPosition(e.clientX, e.clientY);
    }
  }, [isDragging, getColorFromPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate selector position based on current color
  const selectorAngle = (hsl.h - 90) * (Math.PI / 180);
  const selectorRadius = (hsl.s / 100) * (size / 2 - 8);
  const selectorX = Math.cos(selectorAngle) * selectorRadius;
  const selectorY = Math.sin(selectorAngle) * selectorRadius;

  return (
    <div className={cn("relative", className)}>
      {/* Color Wheel */}
      <div
        ref={wheelRef}
        className="rounded-full cursor-crosshair relative"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(
            from 0deg,
            hsl(0, 100%, 50%),
            hsl(30, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(90, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(150, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(210, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(270, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(330, 100%, 50%),
            hsl(360, 100%, 50%)
          )`,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* White center gradient for saturation */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, white 0%, transparent 70%)',
          }}
        />
        
        {/* Selector dot */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: size / 2 + selectorX - 8,
            top: size / 2 + selectorY - 8,
            backgroundColor: value,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
      
      {/* Lightness slider */}
      <div className="mt-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Brightness</div>
        <input
          type="range"
          min="20"
          max="80"
          value={hsl.l}
          onChange={(e) => {
            const newL = parseInt(e.target.value);
            const newHsl = { ...hsl, l: newL };
            setHsl(newHsl);
            onChange(hslToHex(newHsl.h, newHsl.s, newHsl.l));
          }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, 
              ${hslToHex(hsl.h, hsl.s, 20)}, 
              ${hslToHex(hsl.h, hsl.s, 50)}, 
              ${hslToHex(hsl.h, hsl.s, 80)}
            )`,
          }}
        />
      </div>
    </div>
  );
};

export default ColorWheel;