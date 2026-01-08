import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Generate a dense grid of dots to fill the entire USA
// Using a 3% spacing grid to create approximately 1000+ dots for solid fill
const generateDenseGrid = (): { x: number; y: number }[] => {
  const dots: { x: number; y: number }[] = [];
  const spacing = 2.5; // Tighter spacing for denser fill
  
  // Cover the main continental US area with a fine grid
  for (let x = 8; x <= 96; x += spacing) {
    for (let y = 16; y <= 92; y += spacing) {
      // Add slight randomization for organic look
      const jitterX = (Math.random() - 0.5) * 1.5;
      const jitterY = (Math.random() - 0.5) * 1.5;
      dots.push({ 
        x: Math.min(98, Math.max(2, x + jitterX)), 
        y: Math.min(96, Math.max(4, y + jitterY)) 
      });
    }
  }
  
  return dots;
};

const dotPositions = generateDenseGrid();

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface USAMapWithDotsProps {
  onDotAdded?: (count: number) => void;
}

const USAMapWithDots = ({ onDotAdded }: USAMapWithDotsProps) => {
  const [dots, setDots] = useState<Dot[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dotIndexRef = useRef(0);
  
  // Shuffle positions once on mount
  const shuffledPositions = useMemo(() => shuffleArray(dotPositions), []);

  useEffect(() => {
    const addNextDot = () => {
      if (dotIndexRef.current >= shuffledPositions.length) {
        return;
      }

      const position = shuffledPositions[dotIndexRef.current];
      const newDot: Dot = {
        id: dotIndexRef.current,
        x: position.x,
        y: position.y,
      };

      setDots((prev) => [...prev, newDot]);
      dotIndexRef.current += 1;
      
      // Notify parent
      onDotAdded?.(dotIndexRef.current);

      // Faster timing for more dots: start slow then speed up quickly
      const delays = [800, 500, 300, 150, 80, 40];
      const delay = dotIndexRef.current <= delays.length ? delays[dotIndexRef.current - 1] : 15;

      timeoutRef.current = setTimeout(addNextDot, delay);
    };

    // Start animation after a short delay
    timeoutRef.current = setTimeout(addNextDot, 400);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [shuffledPositions, onDotAdded]);

  return (
    <div className="relative w-[26rem] xl:w-[31rem]">
      {/* Container with mask using the USA map image */}
      <div className="relative">
        {/* The USA map image - visible as the outline */}
        <img
          src={usaMap}
          alt="United States of America"
          className="w-full h-auto invert opacity-80"
        />
        
        {/* Dots overlay - masked to only show within the white areas of the map */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{
            maskImage: `url(${usaMap})`,
            WebkitMaskImage: `url(${usaMap})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskOrigin: 'content-box',
            WebkitMaskOrigin: 'content-box',
            padding: '2px',
          }}
        >
          {dots.map((dot) => (
            <div
              key={dot.id}
              className="absolute rounded-full bg-accent"
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: '6px',
                height: '6px',
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 4px hsl(var(--accent) / 0.5)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default USAMapWithDots;
