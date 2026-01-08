import { useState, useEffect, useRef } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Predefined positions that fit within USA boundaries (as percentages)
const dotPositions = [
  // West Coast
  { x: 12, y: 28 }, { x: 10, y: 38 }, { x: 8, y: 48 }, { x: 12, y: 55 },
  { x: 15, y: 35 }, { x: 14, y: 45 }, { x: 18, y: 30 }, { x: 16, y: 52 },
  // Pacific Northwest
  { x: 18, y: 22 }, { x: 22, y: 25 }, { x: 20, y: 18 },
  // Mountain West
  { x: 22, y: 35 }, { x: 25, y: 28 }, { x: 28, y: 32 }, { x: 24, y: 42 },
  { x: 26, y: 48 }, { x: 30, y: 25 }, { x: 32, y: 35 }, { x: 28, y: 55 },
  // Southwest
  { x: 22, y: 52 }, { x: 30, y: 58 }, { x: 35, y: 55 }, { x: 32, y: 48 },
  { x: 38, y: 60 }, { x: 25, y: 58 },
  // Central/Mountain
  { x: 35, y: 28 }, { x: 38, y: 35 }, { x: 40, y: 42 }, { x: 42, y: 32 },
  { x: 36, y: 45 }, { x: 44, y: 38 }, { x: 40, y: 25 },
  // Texas
  { x: 42, y: 55 }, { x: 45, y: 60 }, { x: 48, y: 55 }, { x: 50, y: 62 },
  { x: 44, y: 65 }, { x: 52, y: 58 }, { x: 46, y: 52 }, { x: 40, y: 62 },
  // Great Plains
  { x: 48, y: 28 }, { x: 52, y: 32 }, { x: 50, y: 22 }, { x: 55, y: 25 },
  { x: 54, y: 35 }, { x: 48, y: 40 }, { x: 52, y: 45 },
  // Midwest
  { x: 58, y: 30 }, { x: 62, y: 35 }, { x: 60, y: 25 }, { x: 56, y: 40 },
  { x: 64, y: 28 }, { x: 66, y: 35 }, { x: 60, y: 42 }, { x: 58, y: 48 },
  // South Central
  { x: 55, y: 52 }, { x: 60, y: 55 }, { x: 64, y: 50 }, { x: 58, y: 58 },
  { x: 62, y: 60 }, { x: 56, y: 55 },
  // Southeast
  { x: 68, y: 52 }, { x: 72, y: 48 }, { x: 70, y: 55 }, { x: 74, y: 52 },
  { x: 76, y: 58 }, { x: 78, y: 62 }, { x: 80, y: 68 }, { x: 75, y: 65 },
  // Great Lakes
  { x: 68, y: 28 }, { x: 72, y: 32 }, { x: 70, y: 25 }, { x: 74, y: 28 },
  { x: 76, y: 35 }, { x: 68, y: 38 }, { x: 72, y: 42 },
  // East Central
  { x: 78, y: 42 }, { x: 80, y: 38 }, { x: 76, y: 45 }, { x: 82, y: 48 },
  // Northeast
  { x: 84, y: 35 }, { x: 86, y: 30 }, { x: 88, y: 28 }, { x: 90, y: 32 },
  { x: 85, y: 40 }, { x: 88, y: 38 }, { x: 82, y: 32 },
  // Atlantic Coast
  { x: 84, y: 52 }, { x: 86, y: 48 }, { x: 88, y: 55 }, { x: 82, y: 58 },
];

const USAMapWithDots = () => {
  const [dots, setDots] = useState<Dot[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dotIndexRef = useRef(0);

  useEffect(() => {
    const addNextDot = () => {
      if (dotIndexRef.current >= dotPositions.length) {
        return;
      }

      const position = dotPositions[dotIndexRef.current];
      const newDot: Dot = {
        id: dotIndexRef.current,
        x: position.x + (Math.random() * 4 - 2), // Small random offset
        y: position.y + (Math.random() * 4 - 2),
      };

      setDots((prev) => [...prev, newDot]);
      dotIndexRef.current += 1;

      // Calculate delay - starts at 400ms and decreases to 30ms
      const progress = dotIndexRef.current / dotPositions.length;
      const delay = Math.max(30, 400 * (1 - progress * 0.95));

      timeoutRef.current = setTimeout(addNextDot, delay);
    };

    // Start animation after a short delay
    timeoutRef.current = setTimeout(addNextDot, 800);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
            className="absolute w-2.5 h-2.5 rounded-full bg-accent animate-scale-in"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              boxShadow: "0 0 8px hsl(var(--accent) / 0.6)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default USAMapWithDots;
