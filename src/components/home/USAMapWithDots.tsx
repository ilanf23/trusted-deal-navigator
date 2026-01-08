import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Positions carefully placed inside USA outline (percentages relative to map container)
const dotPositions = [
  // California
  { x: 14, y: 42 }, { x: 16, y: 50 }, { x: 18, y: 58 }, { x: 15, y: 52 },
  { x: 12, y: 46 }, { x: 17, y: 55 }, { x: 14, y: 48 }, { x: 19, y: 62 },
  // Pacific Northwest (Oregon, Washington)
  { x: 15, y: 28 }, { x: 17, y: 32 }, { x: 14, y: 35 }, { x: 18, y: 26 },
  // Mountain States (Idaho, Montana, Wyoming)
  { x: 24, y: 28 }, { x: 28, y: 24 }, { x: 32, y: 28 }, { x: 26, y: 32 },
  { x: 22, y: 38 }, { x: 30, y: 34 }, { x: 35, y: 30 },
  // Nevada, Utah, Colorado
  { x: 20, y: 45 }, { x: 24, y: 48 }, { x: 28, y: 44 }, { x: 32, y: 42 },
  { x: 36, y: 40 }, { x: 38, y: 44 }, { x: 26, y: 52 },
  // Arizona, New Mexico
  { x: 24, y: 58 }, { x: 28, y: 62 }, { x: 32, y: 58 }, { x: 36, y: 62 },
  { x: 30, y: 55 }, { x: 34, y: 55 },
  // Texas
  { x: 42, y: 58 }, { x: 46, y: 62 }, { x: 50, y: 58 }, { x: 44, y: 66 },
  { x: 48, y: 70 }, { x: 52, y: 64 }, { x: 46, y: 55 }, { x: 40, y: 62 },
  { x: 54, y: 68 }, { x: 50, y: 72 },
  // Great Plains (Dakotas, Nebraska, Kansas)
  { x: 44, y: 28 }, { x: 48, y: 32 }, { x: 52, y: 28 }, { x: 46, y: 36 },
  { x: 50, y: 40 }, { x: 44, y: 44 }, { x: 48, y: 48 }, { x: 52, y: 44 },
  // Oklahoma, Arkansas
  { x: 50, y: 52 }, { x: 54, y: 55 }, { x: 58, y: 52 }, { x: 56, y: 48 },
  // Midwest (Minnesota, Iowa, Missouri, Illinois)
  { x: 56, y: 30 }, { x: 60, y: 34 }, { x: 58, y: 38 }, { x: 62, y: 42 },
  { x: 56, y: 44 }, { x: 60, y: 48 }, { x: 64, y: 38 }, { x: 58, y: 28 },
  // Wisconsin, Michigan
  { x: 64, y: 28 }, { x: 68, y: 32 }, { x: 66, y: 26 }, { x: 70, y: 28 },
  { x: 72, y: 32 }, { x: 68, y: 36 },
  // Louisiana, Mississippi, Alabama
  { x: 58, y: 62 }, { x: 62, y: 58 }, { x: 66, y: 62 }, { x: 64, y: 66 },
  { x: 70, y: 58 }, { x: 68, y: 54 },
  // Tennessee, Kentucky
  { x: 68, y: 48 }, { x: 72, y: 44 }, { x: 66, y: 52 }, { x: 74, y: 48 },
  // Ohio, Indiana
  { x: 74, y: 38 }, { x: 70, y: 42 }, { x: 76, y: 42 }, { x: 72, y: 38 },
  // Georgia, South Carolina, North Carolina
  { x: 74, y: 56 }, { x: 78, y: 52 }, { x: 76, y: 60 }, { x: 80, y: 56 },
  { x: 82, y: 52 }, { x: 78, y: 48 },
  // Florida
  { x: 78, y: 68 }, { x: 82, y: 72 }, { x: 80, y: 64 }, { x: 76, y: 66 },
  // Virginia, West Virginia, Maryland
  { x: 82, y: 44 }, { x: 78, y: 42 }, { x: 84, y: 48 }, { x: 80, y: 46 },
  // Pennsylvania, New York
  { x: 82, y: 36 }, { x: 86, y: 32 }, { x: 84, y: 38 }, { x: 80, y: 34 },
  { x: 88, y: 28 }, { x: 86, y: 36 },
  // New England
  { x: 90, y: 26 }, { x: 88, y: 30 }, { x: 92, y: 28 }, { x: 90, y: 32 },
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

      // Calculate delay - starts at 350ms and decreases to 25ms
      const progress = dotIndexRef.current / shuffledPositions.length;
      const delay = Math.max(25, 350 * (1 - progress * 0.95));

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
