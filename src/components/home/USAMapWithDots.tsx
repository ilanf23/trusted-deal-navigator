import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Tripled dot density - positions as percentages
// Weighted toward coasts and population centers
const dotPositions = [
  // Pacific Northwest (Washington)
  { x: 13, y: 18 }, { x: 16, y: 20 }, { x: 14, y: 22 }, { x: 17, y: 19 },
  { x: 15, y: 24 }, { x: 18, y: 21 }, { x: 12, y: 20 }, { x: 19, y: 23 },
  // Oregon
  { x: 11, y: 28 }, { x: 14, y: 30 }, { x: 12, y: 33 }, { x: 16, y: 31 },
  { x: 13, y: 35 }, { x: 17, y: 28 }, { x: 10, y: 31 }, { x: 15, y: 34 },
  // California (high density - major population)
  { x: 9, y: 40 }, { x: 11, y: 44 }, { x: 10, y: 48 }, { x: 12, y: 52 },
  { x: 13, y: 56 }, { x: 11, y: 60 }, { x: 14, y: 50 }, { x: 12, y: 42 },
  { x: 15, y: 54 }, { x: 10, y: 64 }, { x: 13, y: 46 }, { x: 16, y: 58 },
  { x: 11, y: 66 }, { x: 14, y: 62 }, { x: 12, y: 38 }, { x: 15, y: 48 },
  { x: 13, y: 68 }, { x: 16, y: 44 }, { x: 10, y: 56 }, { x: 17, y: 52 },
  // Nevada
  { x: 18, y: 42 }, { x: 20, y: 48 }, { x: 19, y: 54 }, { x: 21, y: 46 },
  { x: 17, y: 50 }, { x: 22, y: 52 }, { x: 19, y: 40 }, { x: 20, y: 56 },
  // Idaho
  { x: 21, y: 26 }, { x: 23, y: 32 }, { x: 22, y: 38 }, { x: 24, y: 30 },
  { x: 20, y: 34 }, { x: 25, y: 28 }, { x: 23, y: 40 }, { x: 21, y: 36 },
  // Montana
  { x: 27, y: 20 }, { x: 31, y: 22 }, { x: 29, y: 24 }, { x: 33, y: 21 },
  { x: 35, y: 23 }, { x: 28, y: 26 }, { x: 32, y: 25 }, { x: 36, y: 24 },
  { x: 30, y: 28 }, { x: 34, y: 27 }, { x: 37, y: 22 }, { x: 26, y: 24 },
  // Wyoming
  { x: 31, y: 32 }, { x: 35, y: 34 }, { x: 33, y: 38 }, { x: 37, y: 36 },
  { x: 29, y: 36 }, { x: 39, y: 34 }, { x: 32, y: 40 }, { x: 36, y: 38 },
  // Utah
  { x: 24, y: 44 }, { x: 26, y: 50 }, { x: 25, y: 56 }, { x: 27, y: 48 },
  { x: 23, y: 52 }, { x: 28, y: 54 }, { x: 26, y: 42 }, { x: 24, y: 58 },
  // Colorado
  { x: 33, y: 44 }, { x: 37, y: 46 }, { x: 35, y: 50 }, { x: 39, y: 48 },
  { x: 34, y: 52 }, { x: 38, y: 50 }, { x: 36, y: 42 }, { x: 40, y: 44 },
  { x: 32, y: 48 }, { x: 41, y: 46 }, { x: 37, y: 54 }, { x: 35, y: 40 },
  // Arizona
  { x: 23, y: 62 }, { x: 27, y: 64 }, { x: 25, y: 68 }, { x: 29, y: 66 },
  { x: 24, y: 70 }, { x: 28, y: 62 }, { x: 26, y: 72 }, { x: 30, y: 68 },
  { x: 22, y: 66 }, { x: 31, y: 64 }, { x: 27, y: 60 }, { x: 25, y: 74 },
  // New Mexico
  { x: 31, y: 60 }, { x: 35, y: 62 }, { x: 33, y: 66 }, { x: 37, y: 64 },
  { x: 32, y: 70 }, { x: 36, y: 68 }, { x: 34, y: 58 }, { x: 38, y: 60 },
  { x: 30, y: 64 }, { x: 39, y: 66 }, { x: 35, y: 72 }, { x: 33, y: 56 },
  // North Dakota
  { x: 43, y: 22 }, { x: 47, y: 24 }, { x: 45, y: 26 }, { x: 49, y: 23 },
  { x: 44, y: 28 }, { x: 48, y: 21 }, { x: 46, y: 25 }, { x: 50, y: 27 },
  // South Dakota
  { x: 43, y: 32 }, { x: 47, y: 34 }, { x: 45, y: 38 }, { x: 49, y: 36 },
  { x: 44, y: 40 }, { x: 48, y: 31 }, { x: 46, y: 36 }, { x: 51, y: 34 },
  // Nebraska
  { x: 43, y: 42 }, { x: 47, y: 44 }, { x: 51, y: 42 }, { x: 45, y: 46 },
  { x: 49, y: 40 }, { x: 53, y: 44 }, { x: 44, y: 48 }, { x: 48, y: 46 },
  // Kansas
  { x: 43, y: 50 }, { x: 47, y: 52 }, { x: 51, y: 50 }, { x: 45, y: 54 },
  { x: 49, y: 48 }, { x: 53, y: 52 }, { x: 44, y: 56 }, { x: 48, y: 54 },
  // Oklahoma
  { x: 43, y: 58 }, { x: 47, y: 60 }, { x: 51, y: 58 }, { x: 45, y: 62 },
  { x: 49, y: 56 }, { x: 53, y: 60 }, { x: 55, y: 56 }, { x: 57, y: 58 },
  { x: 44, y: 64 }, { x: 50, y: 62 }, { x: 54, y: 54 }, { x: 46, y: 66 },
  // Texas (high density - major population)
  { x: 39, y: 64 }, { x: 43, y: 68 }, { x: 47, y: 66 }, { x: 41, y: 72 },
  { x: 45, y: 74 }, { x: 49, y: 70 }, { x: 43, y: 78 }, { x: 47, y: 76 },
  { x: 51, y: 72 }, { x: 55, y: 74 }, { x: 53, y: 78 }, { x: 49, y: 80 },
  { x: 45, y: 82 }, { x: 51, y: 84 }, { x: 39, y: 70 }, { x: 57, y: 70 },
  { x: 42, y: 66 }, { x: 46, y: 78 }, { x: 50, y: 68 }, { x: 54, y: 80 },
  { x: 48, y: 84 }, { x: 52, y: 76 }, { x: 44, y: 70 }, { x: 56, y: 68 },
  { x: 40, y: 76 }, { x: 58, y: 72 }, { x: 46, y: 86 }, { x: 50, y: 82 },
  // Minnesota
  { x: 53, y: 26 }, { x: 57, y: 28 }, { x: 55, y: 32 }, { x: 59, y: 30 },
  { x: 54, y: 34 }, { x: 58, y: 25 }, { x: 56, y: 36 }, { x: 60, y: 32 },
  { x: 52, y: 30 }, { x: 61, y: 28 }, { x: 55, y: 24 }, { x: 57, y: 38 },
  // Iowa
  { x: 55, y: 40 }, { x: 59, y: 42 }, { x: 57, y: 44 }, { x: 61, y: 40 },
  { x: 56, y: 46 }, { x: 60, y: 38 }, { x: 58, y: 48 }, { x: 62, y: 44 },
  // Missouri
  { x: 57, y: 50 }, { x: 61, y: 52 }, { x: 59, y: 56 }, { x: 63, y: 54 },
  { x: 58, y: 58 }, { x: 62, y: 48 }, { x: 60, y: 60 }, { x: 64, y: 56 },
  { x: 56, y: 54 }, { x: 65, y: 52 }, { x: 61, y: 46 }, { x: 59, y: 62 },
  // Arkansas
  { x: 57, y: 62 }, { x: 61, y: 64 }, { x: 59, y: 66 }, { x: 63, y: 62 },
  { x: 58, y: 68 }, { x: 62, y: 60 }, { x: 60, y: 70 }, { x: 64, y: 66 },
  // Louisiana
  { x: 57, y: 72 }, { x: 61, y: 74 }, { x: 59, y: 78 }, { x: 63, y: 76 },
  { x: 58, y: 80 }, { x: 62, y: 70 }, { x: 60, y: 82 }, { x: 64, y: 78 },
  { x: 56, y: 76 }, { x: 65, y: 74 }, { x: 61, y: 68 }, { x: 59, y: 84 },
  // Wisconsin
  { x: 61, y: 28 }, { x: 65, y: 30 }, { x: 63, y: 34 }, { x: 67, y: 32 },
  { x: 62, y: 36 }, { x: 66, y: 27 }, { x: 64, y: 38 }, { x: 68, y: 34 },
  { x: 60, y: 32 }, { x: 69, y: 30 }, { x: 65, y: 25 }, { x: 63, y: 40 },
  // Illinois (high density - Chicago)
  { x: 65, y: 42 }, { x: 67, y: 46 }, { x: 66, y: 50 }, { x: 68, y: 44 },
  { x: 64, y: 48 }, { x: 69, y: 42 }, { x: 67, y: 52 }, { x: 65, y: 54 },
  { x: 63, y: 46 }, { x: 70, y: 48 }, { x: 66, y: 40 }, { x: 68, y: 56 },
  // Michigan
  { x: 69, y: 28 }, { x: 73, y: 30 }, { x: 71, y: 34 }, { x: 75, y: 32 },
  { x: 67, y: 36 }, { x: 71, y: 38 }, { x: 73, y: 27 }, { x: 69, y: 25 },
  { x: 70, y: 40 }, { x: 74, y: 36 }, { x: 72, y: 24 }, { x: 68, y: 32 },
  { x: 76, y: 29 }, { x: 70, y: 22 }, { x: 74, y: 26 }, { x: 72, y: 42 },
  // Indiana
  { x: 69, y: 46 }, { x: 71, y: 50 }, { x: 70, y: 54 }, { x: 72, y: 48 },
  { x: 68, y: 52 }, { x: 73, y: 44 }, { x: 71, y: 56 }, { x: 69, y: 58 },
  // Ohio
  { x: 75, y: 44 }, { x: 77, y: 48 }, { x: 76, y: 52 }, { x: 78, y: 46 },
  { x: 74, y: 50 }, { x: 79, y: 43 }, { x: 77, y: 54 }, { x: 75, y: 56 },
  { x: 73, y: 48 }, { x: 80, y: 50 }, { x: 76, y: 41 }, { x: 78, y: 58 },
  // Kentucky
  { x: 71, y: 56 }, { x: 75, y: 58 }, { x: 73, y: 60 }, { x: 77, y: 56 },
  { x: 72, y: 62 }, { x: 76, y: 54 }, { x: 74, y: 64 }, { x: 78, y: 60 },
  // Tennessee
  { x: 69, y: 62 }, { x: 73, y: 64 }, { x: 77, y: 62 }, { x: 71, y: 66 },
  { x: 75, y: 60 }, { x: 79, y: 64 }, { x: 70, y: 68 }, { x: 74, y: 66 },
  { x: 68, y: 64 }, { x: 80, y: 60 }, { x: 72, y: 70 }, { x: 76, y: 68 },
  // Mississippi
  { x: 65, y: 68 }, { x: 67, y: 72 }, { x: 66, y: 76 }, { x: 68, y: 70 },
  { x: 64, y: 74 }, { x: 69, y: 67 }, { x: 67, y: 78 }, { x: 65, y: 80 },
  // Alabama
  { x: 71, y: 68 }, { x: 73, y: 72 }, { x: 72, y: 76 }, { x: 74, y: 70 },
  { x: 70, y: 74 }, { x: 75, y: 67 }, { x: 73, y: 78 }, { x: 71, y: 80 },
  // Georgia (high density - Atlanta)
  { x: 77, y: 66 }, { x: 79, y: 70 }, { x: 78, y: 74 }, { x: 80, y: 68 },
  { x: 76, y: 72 }, { x: 81, y: 65 }, { x: 79, y: 76 }, { x: 77, y: 78 },
  { x: 75, y: 70 }, { x: 82, y: 72 }, { x: 78, y: 63 }, { x: 80, y: 80 },
  { x: 76, y: 76 }, { x: 83, y: 68 }, { x: 79, y: 82 }, { x: 81, y: 74 },
  // Florida (high density)
  { x: 77, y: 82 }, { x: 81, y: 84 }, { x: 79, y: 88 }, { x: 83, y: 86 },
  { x: 85, y: 82 }, { x: 87, y: 86 }, { x: 83, y: 80 }, { x: 79, y: 80 },
  { x: 78, y: 86 }, { x: 82, y: 88 }, { x: 80, y: 78 }, { x: 84, y: 84 },
  { x: 86, y: 80 }, { x: 88, y: 84 }, { x: 81, y: 90 }, { x: 85, y: 88 },
  // South Carolina
  { x: 81, y: 62 }, { x: 83, y: 66 }, { x: 82, y: 70 }, { x: 84, y: 64 },
  { x: 80, y: 68 }, { x: 85, y: 61 }, { x: 83, y: 72 }, { x: 81, y: 74 },
  // North Carolina
  { x: 81, y: 56 }, { x: 85, y: 58 }, { x: 83, y: 60 }, { x: 87, y: 56 },
  { x: 82, y: 62 }, { x: 86, y: 54 }, { x: 84, y: 64 }, { x: 88, y: 58 },
  { x: 80, y: 58 }, { x: 89, y: 54 }, { x: 85, y: 52 }, { x: 83, y: 66 },
  // Virginia
  { x: 83, y: 50 }, { x: 87, y: 52 }, { x: 85, y: 54 }, { x: 81, y: 52 },
  { x: 84, y: 56 }, { x: 88, y: 49 }, { x: 86, y: 58 }, { x: 82, y: 54 },
  { x: 80, y: 50 }, { x: 89, y: 52 }, { x: 85, y: 47 }, { x: 87, y: 56 },
  // West Virginia
  { x: 79, y: 50 }, { x: 81, y: 54 }, { x: 80, y: 48 }, { x: 82, y: 52 },
  { x: 78, y: 52 }, { x: 83, y: 47 }, { x: 81, y: 56 }, { x: 79, y: 58 },
  // Pennsylvania
  { x: 83, y: 42 }, { x: 87, y: 44 }, { x: 85, y: 46 }, { x: 81, y: 44 },
  { x: 84, y: 48 }, { x: 88, y: 41 }, { x: 86, y: 50 }, { x: 82, y: 46 },
  { x: 80, y: 42 }, { x: 89, y: 44 }, { x: 85, y: 39 }, { x: 87, y: 48 },
  // New York (high density - NYC)
  { x: 85, y: 34 }, { x: 89, y: 36 }, { x: 87, y: 38 }, { x: 83, y: 36 },
  { x: 86, y: 32 }, { x: 90, y: 34 }, { x: 88, y: 31 }, { x: 84, y: 38 },
  { x: 82, y: 34 }, { x: 91, y: 36 }, { x: 87, y: 29 }, { x: 89, y: 40 },
  { x: 85, y: 40 }, { x: 90, y: 32 }, { x: 86, y: 36 }, { x: 88, y: 42 },
  // New England (high density - Boston area)
  { x: 91, y: 31 }, { x: 93, y: 34 }, { x: 92, y: 37 }, { x: 94, y: 32 },
  { x: 90, y: 29 }, { x: 95, y: 35 }, { x: 93, y: 28 }, { x: 91, y: 39 },
  { x: 89, y: 33 }, { x: 94, y: 38 }, { x: 92, y: 26 }, { x: 93, y: 40 },
  { x: 90, y: 36 }, { x: 94, y: 30 }, { x: 92, y: 42 }, { x: 91, y: 35 },
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
            // Shrink the mask slightly to create padding from the border
            maskOrigin: 'content-box',
            WebkitMaskOrigin: 'content-box',
            padding: '4px',
          }}
        >
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
    </div>
  );
};

export default USAMapWithDots;
