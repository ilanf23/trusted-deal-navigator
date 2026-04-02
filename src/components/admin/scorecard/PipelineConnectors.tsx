import { useState, useEffect, useCallback, type RefObject } from 'react';
import { motion } from 'framer-motion';

// ── Types ──

interface CardRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerY: number;
}

interface PipelineConnectorsProps {
  containerRef: RefObject<HTMLDivElement | null>;
  metrics: {
    activeLeads: number;
    newLeads: number;
    closedWon: number;
    closedLost: number;
  };
}

// ── Helpers ──

function safePercent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function useIsXl() {
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXl(mql.matches);
    mql.addEventListener('change', onChange);
    setIsXl(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isXl;
}

// Quadratic bezier point at t
function bezierPoint(
  sx: number, sy: number,
  cx: number, cy: number,
  ex: number, ey: number,
  t: number,
) {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cx + t * t * ex,
    y: mt * mt * sy + 2 * mt * t * cy + t * t * ey,
  };
}

// ── Component ──

export function PipelineConnectors({ containerRef, metrics }: PipelineConnectorsProps) {
  const isXl = useIsXl();
  const [cards, setCards] = useState<CardRect[]>([]);

  const measure = useCallback(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    // The grid is the first child div inside the relative wrapper
    const grid = wrapper.querySelector('div');
    if (!grid) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const children = Array.from(grid.children);
    if (children.length < 6) return;

    const rects: CardRect[] = children.slice(0, 7).map((child) => {
      const r = child.getBoundingClientRect();
      return {
        left: r.left - wrapperRect.left,
        right: r.right - wrapperRect.left,
        top: r.top - wrapperRect.top,
        bottom: r.bottom - wrapperRect.top,
        centerY: (r.top + r.bottom) / 2 - wrapperRect.top,
      };
    });
    setCards(rects);
  }, [containerRef]);

  // Measure after mount and on resize
  useEffect(() => {
    if (!isXl) return;

    // Delay initial measurement to let cards render
    const timer = setTimeout(measure, 100);

    const container = containerRef.current;
    if (!container) return () => clearTimeout(timer);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(container);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [isXl, containerRef, measure]);

  // Don't render below xl or before we have positions
  // Card order: 0=New Leads, 1=Active, 2=Stage Moves, 3=Follow-ups, 4=Closed Won, 5=Closed Lost, 6=Rate Watch
  if (!isXl || cards.length < 6) return null;

  // Build connectors — adjacent meaningful pairs only
  const connectorDefs = [
    {
      fromIndex: 0,  // New Leads
      toIndex: 1,    // Active
      label: 'of pipeline',
      color: 'hsl(var(--foreground))',
      value: safePercent(metrics.newLeads, metrics.activeLeads),
    },
    {
      fromIndex: 4,  // Closed Won
      toIndex: 5,    // Closed Lost
      label: 'win rate',
      color: 'hsl(var(--foreground))',
      value: metrics.closedWon + metrics.closedLost > 0
        ? safePercent(metrics.closedWon, metrics.closedWon + metrics.closedLost)
        : null,
    },
  ];

  // Generate paths — anchored at top center of each card, arcing upward
  const rendered = connectorDefs.map((conn) => {
    const from = cards[conn.fromIndex];
    const to = cards[conn.toIndex];

    // Anchor at top center of each card
    const startX = (from.left + from.right) / 2;
    const startY = from.top;
    const endX = (to.left + to.right) / 2;
    const endY = to.top;

    const dist = Math.abs(endX - startX);
    const arcHeight = Math.max(50, dist * 0.35);

    const midX = (startX + endX) / 2;
    const controlY = startY - arcHeight;

    const pathD = `M ${startX},${startY} Q ${midX},${controlY} ${endX},${endY}`;
    const labelPos = bezierPoint(startX, startY, midX, controlY, endX, endY, 0.5);

    const displayValue = conn.value !== null ? `${conn.value}%` : '--';
    const labelText = `${displayValue} ${conn.label}`;

    return { ...conn, pathD, labelPos, labelText, startX, startY, endX, endY };
  });

  const pillH = 18;
  const charW = 5.5;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible', zIndex: 10 }}
    >
      {rendered.map((conn, i) => {
        const pillW = Math.max(40, conn.labelText.length * charW + 16);
        return (
          <g key={`${conn.fromIndex}-${conn.toIndex}`}>
            {/* Arc line */}
            <motion.path
              d={conn.pathD}
              fill="none"
              stroke={conn.color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.45 }}
              transition={{ duration: 0.8, delay: 0.6 + i * 0.15, ease: 'easeInOut' }}
            />

            {/* Dots at endpoints */}
            <motion.circle
              cx={conn.startX}
              cy={conn.startY}
              r={2.5}
              fill={conn.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.3, delay: 0.6 + i * 0.15 }}
            />
            <motion.circle
              cx={conn.endX}
              cy={conn.endY}
              r={2.5}
              fill={conn.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.3, delay: 0.8 + i * 0.15 }}
            />

            {/* Label pill */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.0 + i * 0.15 }}
            >
              <rect
                x={conn.labelPos.x - pillW / 2}
                y={conn.labelPos.y - pillH / 2}
                width={pillW}
                height={pillH}
                rx={9}
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <text
                x={conn.labelPos.x}
                y={conn.labelPos.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={conn.color}
                fontSize={10}
                fontWeight={600}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {conn.labelText}
              </text>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}
