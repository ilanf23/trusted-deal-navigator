import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Positions carefully placed well inside USA outline (percentages relative to map container)
// All positions moved significantly inward to ensure they stay within the country boundary
const dotPositions = [
  // Washington (more inward and down)
  { x: 18, y: 26 }, { x: 20, y: 28 }, { x: 22, y: 25 }, { x: 19, y: 30 },
  // Oregon
  { x: 16, y: 34 }, { x: 18, y: 38 }, { x: 20, y: 36 }, { x: 17, y: 40 },
  // California (moved right, away from coast)
  { x: 16, y: 46 }, { x: 18, y: 52 }, { x: 20, y: 56 }, { x: 17, y: 60 },
  { x: 19, y: 64 }, { x: 22, y: 58 }, { x: 21, y: 52 }, { x: 23, y: 62 },
  { x: 18, y: 68 }, { x: 21, y: 72 }, { x: 24, y: 66 }, { x: 20, y: 48 },
  // Nevada
  { x: 22, y: 48 }, { x: 24, y: 54 }, { x: 23, y: 60 }, { x: 25, y: 52 },
  // Idaho
  { x: 24, y: 32 }, { x: 26, y: 38 }, { x: 25, y: 44 }, { x: 27, y: 36 },
  // Montana (moved down from border)
  { x: 30, y: 28 }, { x: 34, y: 30 }, { x: 38, y: 28 }, { x: 32, y: 32 },
  { x: 36, y: 34 }, { x: 40, y: 32 }, { x: 33, y: 36 }, { x: 37, y: 38 },
  // Wyoming
  { x: 34, y: 40 }, { x: 38, y: 42 }, { x: 36, y: 46 }, { x: 40, y: 44 },
  // Utah
  { x: 26, y: 50 }, { x: 28, y: 56 }, { x: 27, y: 62 }, { x: 29, y: 54 },
  // Colorado
  { x: 36, y: 50 }, { x: 40, y: 52 }, { x: 38, y: 56 }, { x: 42, y: 54 },
  { x: 37, y: 60 }, { x: 41, y: 58 }, { x: 39, y: 48 }, { x: 43, y: 50 },
  // Arizona (moved up and right)
  { x: 28, y: 66 }, { x: 32, y: 68 }, { x: 30, y: 72 }, { x: 34, y: 70 },
  // New Mexico
  { x: 36, y: 64 }, { x: 40, y: 66 }, { x: 38, y: 70 }, { x: 42, y: 68 },
  { x: 37, y: 74 }, { x: 41, y: 72 }, { x: 39, y: 62 }, { x: 43, y: 64 },
  // North Dakota (moved down from border)
  { x: 46, y: 28 }, { x: 50, y: 30 }, { x: 48, y: 32 }, { x: 52, y: 28 },
  // South Dakota
  { x: 46, y: 36 }, { x: 50, y: 38 }, { x: 48, y: 42 }, { x: 52, y: 40 },
  // Nebraska
  { x: 46, y: 46 }, { x: 50, y: 48 }, { x: 54, y: 46 }, { x: 48, y: 50 },
  // Kansas
  { x: 46, y: 54 }, { x: 50, y: 56 }, { x: 54, y: 54 }, { x: 48, y: 58 },
  // Oklahoma
  { x: 48, y: 62 }, { x: 52, y: 64 }, { x: 56, y: 62 }, { x: 50, y: 66 },
  { x: 54, y: 60 }, { x: 58, y: 64 }, { x: 60, y: 60 }, { x: 62, y: 62 },
  // Texas (moved up and right, away from borders)
  { x: 44, y: 68 }, { x: 48, y: 72 }, { x: 52, y: 70 }, { x: 46, y: 76 },
  { x: 50, y: 78 }, { x: 54, y: 74 }, { x: 48, y: 80 }, { x: 52, y: 78 },
  { x: 56, y: 76 }, { x: 58, y: 72 }, { x: 56, y: 80 }, { x: 52, y: 82 },
  { x: 50, y: 84 }, { x: 54, y: 82 }, { x: 46, y: 74 }, { x: 60, y: 74 },
  // Minnesota (moved down)
  { x: 56, y: 32 }, { x: 60, y: 34 }, { x: 58, y: 38 }, { x: 62, y: 36 },
  // Iowa
  { x: 58, y: 44 }, { x: 62, y: 46 }, { x: 60, y: 48 }, { x: 64, y: 44 },
  // Missouri
  { x: 60, y: 54 }, { x: 64, y: 56 }, { x: 62, y: 60 }, { x: 66, y: 58 },
  // Arkansas
  { x: 60, y: 66 }, { x: 64, y: 68 }, { x: 62, y: 70 }, { x: 66, y: 66 },
  // Louisiana (moved up from gulf)
  { x: 62, y: 76 }, { x: 66, y: 78 }, { x: 64, y: 80 }, { x: 68, y: 76 },
  // Wisconsin (moved down from border)
  { x: 64, y: 34 }, { x: 68, y: 36 }, { x: 66, y: 40 }, { x: 70, y: 38 },
  // Illinois
  { x: 68, y: 46 }, { x: 70, y: 50 }, { x: 69, y: 54 }, { x: 71, y: 48 },
  // Michigan (moved down and left, away from lakes)
  { x: 70, y: 36 }, { x: 72, y: 40 }, { x: 71, y: 44 }, { x: 73, y: 38 },
  { x: 68, y: 42 }, { x: 70, y: 46 }, { x: 72, y: 34 }, { x: 69, y: 38 },
  // Indiana
  { x: 72, y: 50 }, { x: 74, y: 54 }, { x: 73, y: 58 }, { x: 75, y: 52 },
  // Ohio
  { x: 76, y: 48 }, { x: 78, y: 52 }, { x: 77, y: 56 }, { x: 79, y: 50 },
  // Kentucky
  { x: 74, y: 60 }, { x: 78, y: 62 }, { x: 76, y: 64 }, { x: 80, y: 60 },
  // Tennessee
  { x: 72, y: 66 }, { x: 76, y: 68 }, { x: 80, y: 66 }, { x: 74, y: 70 },
  // Mississippi
  { x: 68, y: 72 }, { x: 70, y: 76 }, { x: 69, y: 80 }, { x: 71, y: 74 },
  // Alabama
  { x: 74, y: 72 }, { x: 76, y: 76 }, { x: 75, y: 80 }, { x: 77, y: 74 },
  // Georgia (moved left from coast)
  { x: 78, y: 70 }, { x: 80, y: 74 }, { x: 79, y: 78 }, { x: 81, y: 72 },
  { x: 77, y: 76 }, { x: 80, y: 68 }, { x: 78, y: 80 }, { x: 76, y: 82 },
  // Florida (moved significantly left from coast)
  { x: 78, y: 84 }, { x: 80, y: 86 }, { x: 79, y: 88 }, { x: 81, y: 84 },
  { x: 82, y: 82 }, { x: 80, y: 90 }, { x: 78, y: 82 }, { x: 76, y: 84 },
  // South Carolina (moved left from coast)
  { x: 80, y: 66 }, { x: 82, y: 70 }, { x: 81, y: 74 }, { x: 79, y: 68 },
  // North Carolina (moved left from coast)
  { x: 80, y: 60 }, { x: 82, y: 62 }, { x: 81, y: 64 }, { x: 78, y: 62 },
  // Virginia (moved left from coast)
  { x: 80, y: 54 }, { x: 82, y: 56 }, { x: 81, y: 58 }, { x: 78, y: 56 },
  // West Virginia
  { x: 78, y: 52 }, { x: 80, y: 56 }, { x: 79, y: 50 }, { x: 77, y: 54 },
  // Pennsylvania
  { x: 80, y: 44 }, { x: 82, y: 46 }, { x: 81, y: 48 }, { x: 78, y: 46 },
  // New York (moved down and left)
  { x: 82, y: 40 }, { x: 84, y: 42 }, { x: 83, y: 44 }, { x: 80, y: 42 },
  { x: 81, y: 38 }, { x: 83, y: 40 }, { x: 82, y: 36 }, { x: 79, y: 44 },
  // New England (moved down and left from coast)
  { x: 86, y: 38 }, { x: 88, y: 42 }, { x: 87, y: 46 }, { x: 85, y: 40 },
  { x: 84, y: 36 }, { x: 86, y: 44 }, { x: 85, y: 34 }, { x: 84, y: 48 },
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
    <div className="relative w-[26rem] xl:w-[31rem]">
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
