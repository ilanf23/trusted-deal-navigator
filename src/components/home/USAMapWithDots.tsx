import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Positions carefully placed inside USA outline (percentages relative to map container)
// Doubled dot count with positions adjusted to fit within country boundaries
const dotPositions = [
  // Washington
  { x: 12, y: 12 }, { x: 15, y: 14 }, { x: 18, y: 10 }, { x: 14, y: 18 },
  // Oregon
  { x: 10, y: 22 }, { x: 13, y: 26 }, { x: 16, y: 24 }, { x: 11, y: 28 },
  // California
  { x: 8, y: 35 }, { x: 10, y: 40 }, { x: 12, y: 45 }, { x: 9, y: 50 },
  { x: 11, y: 55 }, { x: 14, y: 48 }, { x: 13, y: 42 }, { x: 15, y: 52 },
  { x: 10, y: 58 }, { x: 13, y: 62 }, { x: 16, y: 56 }, { x: 12, y: 38 },
  // Nevada
  { x: 16, y: 38 }, { x: 18, y: 44 }, { x: 17, y: 50 }, { x: 19, y: 42 },
  // Idaho
  { x: 20, y: 18 }, { x: 22, y: 24 }, { x: 21, y: 30 }, { x: 23, y: 22 },
  // Montana
  { x: 26, y: 12 }, { x: 30, y: 14 }, { x: 34, y: 12 }, { x: 28, y: 16 },
  { x: 32, y: 18 }, { x: 36, y: 16 }, { x: 29, y: 20 }, { x: 33, y: 22 },
  // Wyoming
  { x: 30, y: 26 }, { x: 34, y: 28 }, { x: 32, y: 32 }, { x: 36, y: 30 },
  // Utah
  { x: 22, y: 38 }, { x: 24, y: 44 }, { x: 23, y: 50 }, { x: 25, y: 42 },
  // Colorado
  { x: 32, y: 38 }, { x: 36, y: 40 }, { x: 34, y: 44 }, { x: 38, y: 42 },
  { x: 33, y: 48 }, { x: 37, y: 46 }, { x: 35, y: 36 }, { x: 39, y: 38 },
  // Arizona
  { x: 22, y: 56 }, { x: 26, y: 58 }, { x: 24, y: 62 }, { x: 28, y: 60 },
  // New Mexico
  { x: 30, y: 54 }, { x: 34, y: 56 }, { x: 32, y: 60 }, { x: 36, y: 58 },
  { x: 31, y: 64 }, { x: 35, y: 62 }, { x: 33, y: 52 }, { x: 37, y: 54 },
  // North Dakota
  { x: 42, y: 14 }, { x: 46, y: 16 }, { x: 44, y: 18 }, { x: 48, y: 14 },
  // South Dakota
  { x: 42, y: 22 }, { x: 46, y: 24 }, { x: 44, y: 28 }, { x: 48, y: 26 },
  // Nebraska
  { x: 42, y: 32 }, { x: 46, y: 34 }, { x: 50, y: 32 }, { x: 44, y: 36 },
  // Kansas
  { x: 42, y: 42 }, { x: 46, y: 44 }, { x: 50, y: 42 }, { x: 44, y: 46 },
  // Oklahoma
  { x: 42, y: 52 }, { x: 46, y: 54 }, { x: 50, y: 52 }, { x: 44, y: 56 },
  { x: 48, y: 50 }, { x: 52, y: 54 }, { x: 54, y: 50 }, { x: 56, y: 52 },
  // Texas
  { x: 38, y: 58 }, { x: 42, y: 62 }, { x: 46, y: 60 }, { x: 40, y: 66 },
  { x: 44, y: 68 }, { x: 48, y: 64 }, { x: 42, y: 72 }, { x: 46, y: 70 },
  { x: 50, y: 66 }, { x: 54, y: 68 }, { x: 52, y: 72 }, { x: 48, y: 74 },
  { x: 44, y: 76 }, { x: 50, y: 78 }, { x: 38, y: 64 }, { x: 56, y: 64 },
  // Minnesota
  { x: 52, y: 18 }, { x: 56, y: 20 }, { x: 54, y: 24 }, { x: 58, y: 22 },
  // Iowa
  { x: 54, y: 32 }, { x: 58, y: 34 }, { x: 56, y: 36 }, { x: 60, y: 32 },
  // Missouri
  { x: 56, y: 42 }, { x: 60, y: 44 }, { x: 58, y: 48 }, { x: 62, y: 46 },
  // Arkansas
  { x: 56, y: 54 }, { x: 60, y: 56 }, { x: 58, y: 58 }, { x: 62, y: 54 },
  // Louisiana
  { x: 56, y: 66 }, { x: 60, y: 68 }, { x: 58, y: 72 }, { x: 62, y: 70 },
  // Wisconsin
  { x: 60, y: 22 }, { x: 64, y: 24 }, { x: 62, y: 28 }, { x: 66, y: 26 },
  // Illinois
  { x: 64, y: 34 }, { x: 66, y: 38 }, { x: 65, y: 42 }, { x: 67, y: 36 },
  // Michigan
  { x: 68, y: 22 }, { x: 72, y: 24 }, { x: 70, y: 28 }, { x: 74, y: 26 },
  { x: 66, y: 30 }, { x: 70, y: 32 }, { x: 72, y: 20 }, { x: 68, y: 18 },
  // Indiana
  { x: 68, y: 38 }, { x: 70, y: 42 }, { x: 69, y: 46 }, { x: 71, y: 40 },
  // Ohio
  { x: 74, y: 36 }, { x: 76, y: 40 }, { x: 75, y: 44 }, { x: 77, y: 38 },
  // Kentucky
  { x: 70, y: 48 }, { x: 74, y: 50 }, { x: 72, y: 52 }, { x: 76, y: 48 },
  // Tennessee
  { x: 68, y: 54 }, { x: 72, y: 56 }, { x: 76, y: 54 }, { x: 70, y: 58 },
  // Mississippi
  { x: 64, y: 60 }, { x: 66, y: 64 }, { x: 65, y: 68 }, { x: 67, y: 62 },
  // Alabama
  { x: 70, y: 60 }, { x: 72, y: 64 }, { x: 71, y: 68 }, { x: 73, y: 62 },
  // Georgia
  { x: 76, y: 58 }, { x: 78, y: 62 }, { x: 77, y: 66 }, { x: 79, y: 60 },
  { x: 75, y: 64 }, { x: 80, y: 56 }, { x: 78, y: 68 }, { x: 76, y: 70 },
  // Florida
  { x: 76, y: 74 }, { x: 80, y: 76 }, { x: 78, y: 80 }, { x: 82, y: 78 },
  { x: 84, y: 74 }, { x: 86, y: 80 }, { x: 82, y: 72 }, { x: 78, y: 72 },
  // South Carolina
  { x: 80, y: 54 }, { x: 82, y: 58 }, { x: 81, y: 62 }, { x: 83, y: 56 },
  // North Carolina
  { x: 80, y: 48 }, { x: 84, y: 50 }, { x: 82, y: 52 }, { x: 86, y: 48 },
  // Virginia
  { x: 82, y: 42 }, { x: 86, y: 44 }, { x: 84, y: 46 }, { x: 80, y: 44 },
  // West Virginia
  { x: 78, y: 42 }, { x: 80, y: 46 }, { x: 79, y: 40 }, { x: 81, y: 44 },
  // Pennsylvania
  { x: 82, y: 34 }, { x: 86, y: 36 }, { x: 84, y: 38 }, { x: 80, y: 36 },
  // New York
  { x: 84, y: 28 }, { x: 88, y: 30 }, { x: 86, y: 32 }, { x: 82, y: 30 },
  { x: 85, y: 26 }, { x: 89, y: 28 }, { x: 87, y: 24 }, { x: 83, y: 32 },
  // New England
  { x: 90, y: 22 }, { x: 92, y: 26 }, { x: 91, y: 30 }, { x: 93, y: 24 },
  { x: 89, y: 20 }, { x: 94, y: 28 }, { x: 92, y: 18 }, { x: 90, y: 32 },
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
