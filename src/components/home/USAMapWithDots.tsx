import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Positions carefully placed inside USA outline (percentages relative to map container)
// All positions moved inward to ensure they stay within the country boundary
const dotPositions = [
  // Washington (moved down and right)
  { x: 14, y: 22 }, { x: 17, y: 24 }, { x: 20, y: 20 }, { x: 16, y: 26 },
  // Oregon
  { x: 12, y: 30 }, { x: 15, y: 34 }, { x: 18, y: 32 }, { x: 14, y: 36 },
  // California
  { x: 10, y: 42 }, { x: 12, y: 48 }, { x: 14, y: 52 }, { x: 11, y: 56 },
  { x: 13, y: 60 }, { x: 16, y: 54 }, { x: 15, y: 48 }, { x: 17, y: 58 },
  { x: 12, y: 64 }, { x: 15, y: 68 }, { x: 18, y: 62 }, { x: 14, y: 44 },
  // Nevada
  { x: 18, y: 44 }, { x: 20, y: 50 }, { x: 19, y: 56 }, { x: 21, y: 48 },
  // Idaho (moved down)
  { x: 22, y: 28 }, { x: 24, y: 34 }, { x: 23, y: 40 }, { x: 25, y: 32 },
  // Montana (moved significantly down)
  { x: 28, y: 22 }, { x: 32, y: 24 }, { x: 36, y: 22 }, { x: 30, y: 26 },
  { x: 34, y: 28 }, { x: 38, y: 26 }, { x: 31, y: 30 }, { x: 35, y: 32 },
  // Wyoming
  { x: 32, y: 34 }, { x: 36, y: 36 }, { x: 34, y: 40 }, { x: 38, y: 38 },
  // Utah
  { x: 24, y: 44 }, { x: 26, y: 50 }, { x: 25, y: 56 }, { x: 27, y: 48 },
  // Colorado
  { x: 34, y: 44 }, { x: 38, y: 46 }, { x: 36, y: 50 }, { x: 40, y: 48 },
  { x: 35, y: 54 }, { x: 39, y: 52 }, { x: 37, y: 42 }, { x: 41, y: 44 },
  // Arizona
  { x: 24, y: 62 }, { x: 28, y: 64 }, { x: 26, y: 68 }, { x: 30, y: 66 },
  // New Mexico
  { x: 32, y: 60 }, { x: 36, y: 62 }, { x: 34, y: 66 }, { x: 38, y: 64 },
  { x: 33, y: 70 }, { x: 37, y: 68 }, { x: 35, y: 58 }, { x: 39, y: 60 },
  // North Dakota (moved significantly down)
  { x: 44, y: 24 }, { x: 48, y: 26 }, { x: 46, y: 28 }, { x: 50, y: 24 },
  // South Dakota
  { x: 44, y: 32 }, { x: 48, y: 34 }, { x: 46, y: 38 }, { x: 50, y: 36 },
  // Nebraska
  { x: 44, y: 42 }, { x: 48, y: 44 }, { x: 52, y: 42 }, { x: 46, y: 46 },
  // Kansas
  { x: 44, y: 50 }, { x: 48, y: 52 }, { x: 52, y: 50 }, { x: 46, y: 54 },
  // Oklahoma
  { x: 44, y: 58 }, { x: 48, y: 60 }, { x: 52, y: 58 }, { x: 46, y: 62 },
  { x: 50, y: 56 }, { x: 54, y: 60 }, { x: 56, y: 56 }, { x: 58, y: 58 },
  // Texas
  { x: 40, y: 64 }, { x: 44, y: 68 }, { x: 48, y: 66 }, { x: 42, y: 72 },
  { x: 46, y: 74 }, { x: 50, y: 70 }, { x: 44, y: 78 }, { x: 48, y: 76 },
  { x: 52, y: 72 }, { x: 56, y: 74 }, { x: 54, y: 78 }, { x: 50, y: 80 },
  { x: 46, y: 82 }, { x: 52, y: 84 }, { x: 40, y: 70 }, { x: 58, y: 70 },
  // Minnesota (moved down)
  { x: 54, y: 28 }, { x: 58, y: 30 }, { x: 56, y: 34 }, { x: 60, y: 32 },
  // Iowa
  { x: 56, y: 40 }, { x: 60, y: 42 }, { x: 58, y: 44 }, { x: 62, y: 40 },
  // Missouri
  { x: 58, y: 50 }, { x: 62, y: 52 }, { x: 60, y: 56 }, { x: 64, y: 54 },
  // Arkansas
  { x: 58, y: 62 }, { x: 62, y: 64 }, { x: 60, y: 66 }, { x: 64, y: 62 },
  // Louisiana
  { x: 58, y: 72 }, { x: 62, y: 74 }, { x: 60, y: 78 }, { x: 64, y: 76 },
  // Wisconsin (moved down)
  { x: 62, y: 30 }, { x: 66, y: 32 }, { x: 64, y: 36 }, { x: 68, y: 34 },
  // Illinois
  { x: 66, y: 42 }, { x: 68, y: 46 }, { x: 67, y: 50 }, { x: 69, y: 44 },
  // Michigan (moved down significantly)
  { x: 70, y: 30 }, { x: 74, y: 32 }, { x: 72, y: 36 }, { x: 76, y: 34 },
  { x: 68, y: 38 }, { x: 72, y: 40 }, { x: 74, y: 28 }, { x: 70, y: 26 },
  // Indiana
  { x: 70, y: 46 }, { x: 72, y: 50 }, { x: 71, y: 54 }, { x: 73, y: 48 },
  // Ohio
  { x: 76, y: 44 }, { x: 78, y: 48 }, { x: 77, y: 52 }, { x: 79, y: 46 },
  // Kentucky
  { x: 72, y: 56 }, { x: 76, y: 58 }, { x: 74, y: 60 }, { x: 78, y: 56 },
  // Tennessee
  { x: 70, y: 62 }, { x: 74, y: 64 }, { x: 78, y: 62 }, { x: 72, y: 66 },
  // Mississippi
  { x: 66, y: 68 }, { x: 68, y: 72 }, { x: 67, y: 76 }, { x: 69, y: 70 },
  // Alabama
  { x: 72, y: 68 }, { x: 74, y: 72 }, { x: 73, y: 76 }, { x: 75, y: 70 },
  // Georgia
  { x: 78, y: 66 }, { x: 80, y: 70 }, { x: 79, y: 74 }, { x: 81, y: 68 },
  { x: 77, y: 72 }, { x: 82, y: 64 }, { x: 80, y: 76 }, { x: 78, y: 78 },
  // Florida
  { x: 78, y: 82 }, { x: 82, y: 84 }, { x: 80, y: 88 }, { x: 84, y: 86 },
  { x: 86, y: 82 }, { x: 88, y: 88 }, { x: 84, y: 80 }, { x: 80, y: 80 },
  // South Carolina
  { x: 82, y: 62 }, { x: 84, y: 66 }, { x: 83, y: 70 }, { x: 85, y: 64 },
  // North Carolina
  { x: 82, y: 56 }, { x: 86, y: 58 }, { x: 84, y: 60 }, { x: 88, y: 56 },
  // Virginia
  { x: 84, y: 50 }, { x: 88, y: 52 }, { x: 86, y: 54 }, { x: 82, y: 52 },
  // West Virginia
  { x: 80, y: 50 }, { x: 82, y: 54 }, { x: 81, y: 48 }, { x: 83, y: 52 },
  // Pennsylvania
  { x: 84, y: 42 }, { x: 88, y: 44 }, { x: 86, y: 46 }, { x: 82, y: 44 },
  // New York (moved down)
  { x: 86, y: 36 }, { x: 90, y: 38 }, { x: 88, y: 40 }, { x: 84, y: 38 },
  { x: 87, y: 34 }, { x: 91, y: 36 }, { x: 89, y: 32 }, { x: 85, y: 40 },
  // New England (moved down)
  { x: 92, y: 32 }, { x: 94, y: 36 }, { x: 93, y: 40 }, { x: 95, y: 34 },
  { x: 91, y: 30 }, { x: 96, y: 38 }, { x: 94, y: 28 }, { x: 92, y: 42 },
];

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

      // Custom timing: 1000ms → 750ms → 500ms → 375ms → 200ms → 100ms → then 50ms
      const delays = [1000, 750, 500, 375, 200, 100];
      const delay = dotIndexRef.current <= delays.length ? delays[dotIndexRef.current - 1] : 50;

      timeoutRef.current = setTimeout(addNextDot, delay);
    };

    // Start animation after a short delay
    timeoutRef.current = setTimeout(addNextDot, 600);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [shuffledPositions, onDotAdded]);

  return (
    <div className="relative w-80 xl:w-96">
      <img
        src={usaMap}
        alt="United States of America"
        className="w-full h-auto invert opacity-80"
      />
      {/* Dots overlay */}
      <div className="absolute inset-0">
        {dots.map((dot) => (
          <div
            key={dot.id}
            className="absolute w-2 h-2 rounded-full bg-accent animate-scale-in"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 6px hsl(var(--accent) / 0.6)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default USAMapWithDots;
