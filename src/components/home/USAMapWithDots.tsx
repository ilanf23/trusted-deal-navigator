import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Population-weighted dot positions matching US city lights distribution
const dotPositions = [
  // === NORTHEAST CORRIDOR (heaviest concentration) ===
  // NYC Metro (dense cluster)
  { x: 88, y: 42 }, { x: 89, y: 43 }, { x: 87, y: 44 }, { x: 90, y: 42 }, { x: 88, y: 45 },
  { x: 89, y: 44 }, { x: 87, y: 43 }, { x: 90, y: 45 }, { x: 88, y: 41 }, { x: 89, y: 46 },
  { x: 86, y: 44 }, { x: 91, y: 43 }, { x: 88, y: 47 }, { x: 87, y: 42 },
  // Boston Metro
  { x: 92, y: 38 }, { x: 93, y: 39 }, { x: 91, y: 40 }, { x: 94, y: 38 }, { x: 92, y: 41 },
  { x: 93, y: 40 }, { x: 91, y: 39 }, { x: 94, y: 41 },
  // Philadelphia
  { x: 86, y: 46 }, { x: 87, y: 47 }, { x: 85, y: 48 }, { x: 88, y: 47 }, { x: 86, y: 49 },
  // Washington DC / Baltimore
  { x: 84, y: 50 }, { x: 85, y: 51 }, { x: 83, y: 52 }, { x: 86, y: 50 }, { x: 84, y: 53 },
  { x: 85, y: 52 }, { x: 83, y: 51 }, { x: 86, y: 53 },
  // Connecticut corridor
  { x: 90, y: 40 }, { x: 89, y: 41 }, { x: 91, y: 42 },
  // New Jersey
  { x: 87, y: 45 }, { x: 88, y: 46 }, { x: 86, y: 47 },

  // === CALIFORNIA (second heaviest) ===
  // LA Metro (dense)
  { x: 16, y: 60 }, { x: 17, y: 61 }, { x: 15, y: 62 }, { x: 18, y: 60 }, { x: 16, y: 63 },
  { x: 17, y: 62 }, { x: 15, y: 61 }, { x: 18, y: 63 }, { x: 14, y: 62 }, { x: 19, y: 61 },
  { x: 16, y: 64 }, { x: 17, y: 59 },
  // San Francisco Bay
  { x: 12, y: 46 }, { x: 13, y: 47 }, { x: 11, y: 48 }, { x: 14, y: 46 }, { x: 12, y: 49 },
  { x: 13, y: 48 }, { x: 11, y: 47 }, { x: 14, y: 49 },
  // San Diego
  { x: 18, y: 66 }, { x: 19, y: 67 }, { x: 17, y: 68 }, { x: 20, y: 66 },
  // Sacramento
  { x: 14, y: 44 }, { x: 15, y: 45 }, { x: 13, y: 46 },
  // Inland Empire / Riverside
  { x: 20, y: 62 }, { x: 21, y: 63 }, { x: 19, y: 64 },

  // === FLORIDA ===
  // Miami
  { x: 82, y: 84 }, { x: 83, y: 85 }, { x: 81, y: 86 }, { x: 84, y: 84 }, { x: 82, y: 87 },
  { x: 83, y: 86 }, { x: 81, y: 85 },
  // Tampa / St Pete
  { x: 78, y: 78 }, { x: 79, y: 79 }, { x: 77, y: 80 }, { x: 80, y: 78 },
  // Orlando
  { x: 80, y: 76 }, { x: 81, y: 77 }, { x: 79, y: 78 }, { x: 82, y: 76 },
  // Jacksonville
  { x: 80, y: 72 }, { x: 81, y: 73 }, { x: 79, y: 74 },

  // === TEXAS ===
  // Houston
  { x: 52, y: 74 }, { x: 53, y: 75 }, { x: 51, y: 76 }, { x: 54, y: 74 }, { x: 52, y: 77 },
  { x: 53, y: 76 }, { x: 51, y: 75 },
  // Dallas-Fort Worth
  { x: 48, y: 64 }, { x: 49, y: 65 }, { x: 47, y: 66 }, { x: 50, y: 64 }, { x: 48, y: 67 },
  { x: 49, y: 66 }, { x: 47, y: 65 },
  // San Antonio
  { x: 46, y: 72 }, { x: 47, y: 73 }, { x: 45, y: 74 }, { x: 48, y: 72 },
  // Austin
  { x: 48, y: 70 }, { x: 49, y: 71 }, { x: 47, y: 72 }, { x: 50, y: 70 },

  // === MIDWEST ===
  // Chicago (dense)
  { x: 66, y: 42 }, { x: 67, y: 43 }, { x: 65, y: 44 }, { x: 68, y: 42 }, { x: 66, y: 45 },
  { x: 67, y: 44 }, { x: 65, y: 43 }, { x: 68, y: 45 },
  // Detroit
  { x: 74, y: 38 }, { x: 75, y: 39 }, { x: 73, y: 40 }, { x: 76, y: 38 }, { x: 74, y: 41 },
  // Minneapolis
  { x: 54, y: 30 }, { x: 55, y: 31 }, { x: 53, y: 32 }, { x: 56, y: 30 },
  // St. Louis
  { x: 60, y: 52 }, { x: 61, y: 53 }, { x: 59, y: 54 }, { x: 62, y: 52 },
  // Kansas City
  { x: 52, y: 50 }, { x: 53, y: 51 }, { x: 51, y: 52 },
  // Indianapolis
  { x: 70, y: 48 }, { x: 71, y: 49 }, { x: 69, y: 50 },
  // Columbus
  { x: 76, y: 46 }, { x: 77, y: 47 }, { x: 75, y: 48 },
  // Cleveland
  { x: 78, y: 42 }, { x: 79, y: 43 }, { x: 77, y: 44 },
  // Cincinnati
  { x: 74, y: 52 }, { x: 75, y: 53 }, { x: 73, y: 54 },
  // Milwaukee
  { x: 64, y: 38 }, { x: 65, y: 39 }, { x: 63, y: 40 },

  // === SOUTH ===
  // Atlanta
  { x: 76, y: 64 }, { x: 77, y: 65 }, { x: 75, y: 66 }, { x: 78, y: 64 }, { x: 76, y: 67 },
  // Charlotte
  { x: 80, y: 58 }, { x: 81, y: 59 }, { x: 79, y: 60 }, { x: 82, y: 58 },
  // Nashville
  { x: 72, y: 58 }, { x: 73, y: 59 }, { x: 71, y: 60 },
  // Memphis
  { x: 64, y: 60 }, { x: 65, y: 61 }, { x: 63, y: 62 },
  // New Orleans
  { x: 62, y: 74 }, { x: 63, y: 75 }, { x: 61, y: 76 },
  // Raleigh
  { x: 82, y: 56 }, { x: 83, y: 57 }, { x: 81, y: 58 },

  // === PACIFIC NORTHWEST ===
  // Seattle
  { x: 16, y: 22 }, { x: 17, y: 23 }, { x: 15, y: 24 }, { x: 18, y: 22 }, { x: 16, y: 25 },
  // Portland
  { x: 14, y: 30 }, { x: 15, y: 31 }, { x: 13, y: 32 }, { x: 16, y: 30 },

  // === MOUNTAIN WEST (sparse) ===
  // Denver
  { x: 36, y: 46 }, { x: 37, y: 47 }, { x: 35, y: 48 }, { x: 38, y: 46 },
  // Phoenix
  { x: 26, y: 64 }, { x: 27, y: 65 }, { x: 25, y: 66 }, { x: 28, y: 64 },
  // Las Vegas
  { x: 22, y: 54 }, { x: 23, y: 55 }, { x: 21, y: 56 },
  // Salt Lake City
  { x: 26, y: 42 }, { x: 27, y: 43 }, { x: 25, y: 44 },
  // Albuquerque
  { x: 32, y: 60 }, { x: 33, y: 61 }, { x: 31, y: 62 },
  // Tucson
  { x: 28, y: 68 }, { x: 29, y: 69 },
  // Boise
  { x: 22, y: 34 }, { x: 23, y: 35 },

  // === SCATTERED SMALLER CITIES ===
  // Pittsburgh
  { x: 80, y: 46 }, { x: 81, y: 47 },
  // Buffalo
  { x: 82, y: 38 }, { x: 83, y: 39 },
  // Louisville
  { x: 72, y: 54 }, { x: 73, y: 55 },
  // Oklahoma City
  { x: 48, y: 58 }, { x: 49, y: 59 },
  // Tulsa
  { x: 52, y: 58 }, { x: 53, y: 59 },
  // Omaha
  { x: 50, y: 42 }, { x: 51, y: 43 },
  // Richmond
  { x: 84, y: 54 }, { x: 85, y: 55 },
  // Birmingham
  { x: 72, y: 66 }, { x: 73, y: 67 },
  // El Paso
  { x: 34, y: 66 }, { x: 35, y: 67 },
  // Wichita
  { x: 50, y: 54 }, { x: 51, y: 55 },
  // Little Rock
  { x: 58, y: 62 }, { x: 59, y: 63 },
  // Knoxville
  { x: 76, y: 56 }, { x: 77, y: 57 },
  // Charleston SC
  { x: 82, y: 66 }, { x: 83, y: 67 },
  // Savannah
  { x: 80, y: 70 }, { x: 81, y: 71 },
  // Des Moines
  { x: 56, y: 44 }, { x: 57, y: 45 },
  // Madison
  { x: 62, y: 40 }, { x: 63, y: 41 },
  // Grand Rapids
  { x: 72, y: 40 }, { x: 73, y: 41 },
  // Spokane
  { x: 20, y: 24 }, { x: 21, y: 25 },
  // Reno
  { x: 18, y: 44 }, { x: 19, y: 45 },
  // Fresno
  { x: 16, y: 54 }, { x: 17, y: 55 },
  // Bakersfield
  { x: 18, y: 58 }, { x: 19, y: 59 },
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
