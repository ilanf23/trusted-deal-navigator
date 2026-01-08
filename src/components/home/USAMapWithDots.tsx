import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Define safe bounding boxes for regions inside the USA outline
// Each region has: minX, maxX, minY, maxY, and count of dots to generate
const regions = [
  // Northeast Corridor (dense)
  { minX: 84, maxX: 94, minY: 38, maxY: 54, count: 25 },
  // California coast
  { minX: 12, maxX: 22, minY: 44, maxY: 70, count: 18 },
  // Florida
  { minX: 76, maxX: 86, minY: 72, maxY: 88, count: 12 },
  // Texas
  { minX: 44, maxX: 60, minY: 62, maxY: 80, count: 16 },
  // Chicago/Great Lakes
  { minX: 62, maxX: 78, minY: 38, maxY: 52, count: 14 },
  // Southeast
  { minX: 72, maxX: 84, minY: 56, maxY: 72, count: 14 },
  // Pacific Northwest
  { minX: 14, maxX: 24, minY: 22, maxY: 36, count: 8 },
  // Mountain West (sparse)
  { minX: 24, maxX: 40, minY: 40, maxY: 70, count: 10 },
  // Plains/Midwest
  { minX: 46, maxX: 64, minY: 30, maxY: 60, count: 12 },
  // Southern states
  { minX: 58, maxX: 74, minY: 58, maxY: 78, count: 10 },
  // Northern Plains (sparse)
  { minX: 28, maxX: 54, minY: 26, maxY: 42, count: 8 },
];

// Generate random dots within safe regions
const generateRandomDots = () => {
  const dots: { x: number; y: number }[] = [];
  
  regions.forEach((region) => {
    for (let i = 0; i < region.count; i++) {
      dots.push({
        x: region.minX + Math.random() * (region.maxX - region.minX),
        y: region.minY + Math.random() * (region.maxY - region.minY),
      });
    }
  });
  
  return dots;
};

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
  
  // Generate and shuffle random positions once on mount
  const shuffledPositions = useMemo(() => shuffleArray(generateRandomDots()), []);

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
