import { useState, useEffect, useRef, useMemo } from "react";

interface Dot {
  id: number;
  x: number;
  y: number;
}

// Generate a dense grid of dots
const generateDenseGrid = (): { x: number; y: number }[] => {
  const dots: { x: number; y: number }[] = [];
  const spacing = 2.2;
  
  for (let x = 5; x <= 95; x += spacing) {
    for (let y = 5; y <= 95; y += spacing) {
      const jitterX = (Math.random() - 0.5) * 1.2;
      const jitterY = (Math.random() - 0.5) * 1.2;
      dots.push({ x: x + jitterX, y: y + jitterY });
    }
  }
  return dots;
};

const dotPositions = generateDenseGrid();

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

// Simplified continental USA path (recognizable shape)
const USA_PATH = `
  M 8 35 L 10 28 L 13 22 L 18 18 L 25 16 L 33 15 L 42 14 L 52 14 L 60 16 L 67 18 L 73 21 L 78 25 L 82 30
  L 86 28 L 90 30 L 93 35 L 94 42 L 92 48
  L 94 52 L 95 58 L 93 64 L 89 62 L 86 58 L 82 56 L 79 60
  L 82 68 L 86 76 L 88 84 L 84 88 L 78 86 L 72 80
  L 68 78 L 64 82 L 58 80 L 54 76 L 50 80 L 46 86 L 42 90 L 38 86 L 35 78
  L 32 74 L 28 72 L 22 70 L 16 66 L 12 60 L 9 52 L 7 44 L 8 35 Z
`;

const USAMapWithDots = ({ onDotAdded }: USAMapWithDotsProps) => {
  const [dots, setDots] = useState<Dot[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dotIndexRef = useRef(0);
  
  const shuffledPositions = useMemo(() => shuffleArray(dotPositions), []);

  useEffect(() => {
    const addNextDot = () => {
      if (dotIndexRef.current >= shuffledPositions.length) return;

      const position = shuffledPositions[dotIndexRef.current];
      setDots((prev) => [...prev, { id: dotIndexRef.current, x: position.x, y: position.y }]);
      dotIndexRef.current += 1;
      onDotAdded?.(dotIndexRef.current);

      const delays = [400, 200, 100, 50, 25, 12];
      const delay = dotIndexRef.current <= delays.length ? delays[dotIndexRef.current - 1] : 4;
      timeoutRef.current = setTimeout(addNextDot, delay);
    };

    timeoutRef.current = setTimeout(addNextDot, 400);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [shuffledPositions, onDotAdded]);

  return (
    <div className="relative w-[26rem] xl:w-[31rem]">
      <svg viewBox="0 0 100 100" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="usa-fill-clip">
            <path d={USA_PATH} />
          </clipPath>
        </defs>
        
        {/* USA outline removed */}
        
        {/* Dots clipped to USA shape */}
        <g clipPath="url(#usa-fill-clip)">
          {dots.map((dot) => (
            <circle key={dot.id} cx={dot.x} cy={dot.y} r="1.3" fill="hsl(var(--accent))" className="animate-scale-in" />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default USAMapWithDots;
