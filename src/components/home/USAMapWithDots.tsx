import { useState, useEffect, useRef } from "react";
import usaMap from "@/assets/usa-map.png";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Predefined positions that roughly fall within USA boundaries (as percentages)
const dotPositions = [
  { x: 15, y: 35 }, // West Coast
  { x: 12, y: 55 }, // California
  { x: 18, y: 25 }, // Pacific Northwest
  { x: 25, y: 40 }, // Nevada area
  { x: 30, y: 55 }, // Arizona
  { x: 35, y: 30 }, // Mountain region
  { x: 40, y: 45 }, // Colorado
  { x: 45, y: 60 }, // Texas
  { x: 50, y: 35 }, // Central
  { x: 55, y: 50 }, // Oklahoma/Texas
  { x: 48, y: 25 }, // North Central
  { x: 55, y: 30 }, // Minnesota area
  { x: 60, y: 40 }, // Missouri
  { x: 65, y: 55 }, // Louisiana
  { x: 70, y: 35 }, // Illinois
  { x: 72, y: 50 }, // Tennessee
  { x: 75, y: 28 }, // Michigan
  { x: 78, y: 40 }, // Ohio
  { x: 80, y: 55 }, // Georgia
  { x: 82, y: 65 }, // Florida
  { x: 85, y: 35 }, // Pennsylvania
  { x: 88, y: 28 }, // New York
  { x: 90, y: 38 }, // New Jersey
  { x: 92, y: 25 }, // New England
  { x: 75, y: 60 }, // Alabama
  { x: 68, y: 45 }, // Kentucky
  { x: 58, y: 22 }, // Dakotas
  { x: 42, y: 20 }, // Montana
  { x: 28, y: 20 }, // Idaho
  { x: 22, y: 45 }, // Utah
  { x: 38, y: 65 }, // New Mexico
  { x: 52, y: 70 }, // South Texas
  { x: 62, y: 62 }, // Mississippi
  { x: 85, y: 48 }, // Virginia
  { x: 78, y: 22 }, // Wisconsin
  { x: 65, y: 25 }, // Iowa
  { x: 72, y: 42 }, // Indiana
  { x: 88, y: 55 }, // North Carolina
  { x: 84, y: 60 }, // South Carolina
  { x: 20, y: 60 }, // Southern California
];

const USAMapWithDots = () => {
  const [dots, setDots] = useState<Dot[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dotIndexRef = useRef(0);

  useEffect(() => {
    const addNextDot = () => {
      if (dotIndexRef.current >= dotPositions.length) {
        setIsComplete(true);
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
      {/* Completion glow effect */}
      {isComplete && (
        <div className="absolute inset-0 bg-accent/10 rounded-lg animate-fade-in" />
      )}
    </div>
  );
};

export default USAMapWithDots;
