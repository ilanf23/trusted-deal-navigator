import { useState, useEffect, useRef, useMemo } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Dot positions based on major US cities (percentages relative to map container)
const dotPositions = [
  // Seattle, WA area
  { x: 18, y: 24 }, { x: 20, y: 26 }, { x: 17, y: 28 }, { x: 21, y: 25 },
  // Portland, OR area
  { x: 16, y: 32 }, { x: 18, y: 34 }, { x: 15, y: 35 }, { x: 19, y: 33 },
  // San Francisco Bay Area
  { x: 14, y: 48 }, { x: 16, y: 50 }, { x: 13, y: 52 }, { x: 17, y: 49 },
  // Los Angeles area
  { x: 18, y: 62 }, { x: 20, y: 64 }, { x: 17, y: 66 }, { x: 21, y: 63 }, { x: 19, y: 65 },
  // San Diego area
  { x: 20, y: 68 }, { x: 22, y: 70 }, { x: 19, y: 69 },
  // Phoenix, AZ area
  { x: 28, y: 66 }, { x: 30, y: 68 }, { x: 27, y: 67 }, { x: 31, y: 65 },
  // Las Vegas, NV area
  { x: 24, y: 56 }, { x: 26, y: 58 }, { x: 23, y: 57 },
  // Salt Lake City, UT area
  { x: 28, y: 44 }, { x: 30, y: 46 }, { x: 27, y: 45 }, { x: 31, y: 43 },
  // Denver, CO area
  { x: 38, y: 48 }, { x: 40, y: 50 }, { x: 37, y: 49 }, { x: 41, y: 47 }, { x: 39, y: 51 },
  // Albuquerque, NM area
  { x: 34, y: 62 }, { x: 36, y: 64 }, { x: 33, y: 63 },
  // Boise, ID area
  { x: 24, y: 36 }, { x: 26, y: 38 }, { x: 23, y: 37 },
  // Billings, MT area
  { x: 34, y: 30 }, { x: 36, y: 32 }, { x: 33, y: 31 },
  // Minneapolis, MN area
  { x: 56, y: 32 }, { x: 58, y: 34 }, { x: 55, y: 33 }, { x: 59, y: 31 },
  // Chicago, IL area
  { x: 68, y: 44 }, { x: 70, y: 46 }, { x: 67, y: 45 }, { x: 71, y: 43 }, { x: 69, y: 47 },
  // Detroit, MI area
  { x: 74, y: 40 }, { x: 76, y: 42 }, { x: 73, y: 41 }, { x: 75, y: 39 },
  // Milwaukee, WI area
  { x: 66, y: 38 }, { x: 68, y: 40 }, { x: 65, y: 39 },
  // St. Louis, MO area
  { x: 62, y: 54 }, { x: 64, y: 56 }, { x: 61, y: 55 }, { x: 63, y: 53 },
  // Kansas City, MO area
  { x: 54, y: 52 }, { x: 56, y: 54 }, { x: 53, y: 53 }, { x: 55, y: 51 },
  // Omaha, NE area
  { x: 52, y: 44 }, { x: 54, y: 46 }, { x: 51, y: 45 },
  // Indianapolis, IN area
  { x: 72, y: 50 }, { x: 74, y: 52 }, { x: 71, y: 51 }, { x: 73, y: 49 },
  // Columbus, OH area
  { x: 76, y: 48 }, { x: 78, y: 50 }, { x: 75, y: 49 },
  // Cleveland, OH area
  { x: 78, y: 44 }, { x: 80, y: 46 }, { x: 77, y: 45 },
  // Dallas-Fort Worth, TX area
  { x: 50, y: 68 }, { x: 52, y: 70 }, { x: 49, y: 69 }, { x: 53, y: 67 }, { x: 51, y: 71 },
  // Houston, TX area
  { x: 54, y: 76 }, { x: 56, y: 78 }, { x: 53, y: 77 }, { x: 57, y: 75 }, { x: 55, y: 79 },
  // San Antonio, TX area
  { x: 48, y: 74 }, { x: 50, y: 76 }, { x: 47, y: 75 }, { x: 49, y: 73 },
  // Austin, TX area
  { x: 50, y: 72 }, { x: 52, y: 74 }, { x: 49, y: 73 },
  // Oklahoma City, OK area
  { x: 50, y: 60 }, { x: 52, y: 62 }, { x: 49, y: 61 }, { x: 51, y: 59 },
  // New Orleans, LA area
  { x: 64, y: 76 }, { x: 66, y: 78 }, { x: 63, y: 77 },
  // Memphis, TN area
  { x: 66, y: 62 }, { x: 68, y: 64 }, { x: 65, y: 63 },
  // Nashville, TN area
  { x: 72, y: 60 }, { x: 74, y: 62 }, { x: 71, y: 61 }, { x: 73, y: 59 },
  // Atlanta, GA area
  { x: 76, y: 66 }, { x: 78, y: 68 }, { x: 75, y: 67 }, { x: 77, y: 65 }, { x: 79, y: 69 },
  // Miami, FL area
  { x: 82, y: 86 }, { x: 84, y: 88 }, { x: 81, y: 87 }, { x: 83, y: 85 },
  // Tampa, FL area
  { x: 80, y: 80 }, { x: 82, y: 82 }, { x: 79, y: 81 },
  // Orlando, FL area
  { x: 82, y: 78 }, { x: 84, y: 80 }, { x: 81, y: 79 },
  // Jacksonville, FL area
  { x: 80, y: 74 }, { x: 82, y: 76 }, { x: 79, y: 75 },
  // Charlotte, NC area
  { x: 80, y: 60 }, { x: 82, y: 62 }, { x: 79, y: 61 }, { x: 81, y: 59 },
  // Raleigh, NC area
  { x: 84, y: 58 }, { x: 86, y: 60 }, { x: 83, y: 59 },
  // New York City area
  { x: 88, y: 44 }, { x: 90, y: 46 }, { x: 87, y: 45 }, { x: 89, y: 43 }, { x: 91, y: 47 },
  // Boston, MA area
  { x: 92, y: 40 }, { x: 94, y: 42 }, { x: 91, y: 41 }, { x: 93, y: 39 },
  // Philadelphia, PA area
  { x: 86, y: 48 }, { x: 88, y: 50 }, { x: 85, y: 49 }, { x: 87, y: 47 },
  // Washington, DC area
  { x: 86, y: 52 }, { x: 88, y: 54 }, { x: 85, y: 53 }, { x: 87, y: 51 },
  // Baltimore, MD area
  { x: 86, y: 50 }, { x: 88, y: 52 }, { x: 85, y: 51 },
  // Pittsburgh, PA area
  { x: 80, y: 48 }, { x: 82, y: 50 }, { x: 79, y: 49 },
  // Buffalo, NY area
  { x: 82, y: 40 }, { x: 84, y: 42 }, { x: 81, y: 41 },
  // Cincinnati, OH area
  { x: 74, y: 54 }, { x: 76, y: 56 }, { x: 73, y: 55 },
  // Louisville, KY area
  { x: 72, y: 56 }, { x: 74, y: 58 }, { x: 71, y: 57 },
  // Birmingham, AL area
  { x: 72, y: 68 }, { x: 74, y: 70 }, { x: 71, y: 69 },
  // Richmond, VA area
  { x: 84, y: 56 }, { x: 86, y: 58 }, { x: 83, y: 57 },
  // Sacramento, CA area
  { x: 16, y: 46 }, { x: 18, y: 48 }, { x: 15, y: 47 },
  // Tucson, AZ area
  { x: 30, y: 70 }, { x: 32, y: 72 }, { x: 29, y: 71 },
  // El Paso, TX area
  { x: 36, y: 68 }, { x: 38, y: 70 }, { x: 35, y: 69 },
  // Wichita, KS area
  { x: 52, y: 56 }, { x: 54, y: 58 }, { x: 51, y: 57 },
  // Tulsa, OK area
  { x: 54, y: 60 }, { x: 56, y: 62 }, { x: 53, y: 61 },
  // Little Rock, AR area
  { x: 60, y: 64 }, { x: 62, y: 66 }, { x: 59, y: 65 },
  // Jackson, MS area
  { x: 66, y: 70 }, { x: 68, y: 72 }, { x: 65, y: 71 },
  // Knoxville, TN area
  { x: 76, y: 58 }, { x: 78, y: 60 }, { x: 75, y: 59 },
  // Charleston, SC area
  { x: 82, y: 68 }, { x: 84, y: 70 }, { x: 81, y: 69 },
  // Savannah, GA area
  { x: 80, y: 72 }, { x: 82, y: 74 }, { x: 79, y: 73 },
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
