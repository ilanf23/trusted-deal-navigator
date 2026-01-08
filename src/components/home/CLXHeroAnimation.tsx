import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import USMapSVG from "./USMapSVG";
import DealNotification from "./DealNotification";
import PhoneMockup from "./PhoneMockup";
import MapPing from "./MapPing";

interface Deal {
  id: number;
  amount: string;
  type: string;
  industry: string;
  state: string;
  mapX: number;
  mapY: number;
}

const dealData: Omit<Deal, "id">[] = [
  { amount: "$2.3M", type: "SBA 7(a)", industry: "Logistics Company", state: "TX", mapX: 45, mapY: 70 },
  { amount: "$1.8M", type: "CRE Refinance", industry: "Medical Office", state: "FL", mapX: 78, mapY: 80 },
  { amount: "$3.4M", type: "SBA 504", industry: "Manufacturing", state: "IL", mapX: 58, mapY: 40 },
  { amount: "$950K", type: "Working Capital", industry: "E-Commerce", state: "CA", mapX: 12, mapY: 45 },
  { amount: "$4.2M", type: "Construction", industry: "Multifamily", state: "AZ", mapX: 22, mapY: 60 },
  { amount: "$675K", type: "Acquisition", industry: "Dental Practice", state: "NY", mapX: 82, mapY: 32 },
  { amount: "$2.9M", type: "Bridge Loan", industry: "Industrial", state: "OH", mapX: 68, mapY: 38 },
  { amount: "$1.5M", type: "Equipment", industry: "Restaurant Group", state: "GA", mapX: 72, mapY: 62 },
  { amount: "$5.1M", type: "CRE Purchase", industry: "Retail Center", state: "NC", mapX: 76, mapY: 52 },
  { amount: "$890K", type: "SBA 7(a)", industry: "Auto Service", state: "WA", mapX: 14, mapY: 18 },
];

const CLXHeroAnimation = () => {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [activeDeals, setActiveDeals] = useState<Deal[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<Deal[]>([]);
  const [allPins, setAllPins] = useState<Deal[]>([]);
  const [dealIndex, setDealIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Phase 1: Deal burst animation
  const addDeal = useCallback(() => {
    if (dealIndex >= dealData.length) return;

    const newDeal: Deal = {
      ...dealData[dealIndex],
      id: Date.now() + dealIndex,
    };

    // Add to pins (permanent)
    setAllPins(prev => [...prev, newDeal]);

    // Add to notifications (max 4 visible)
    setVisibleNotifications(prev => {
      const updated = [newDeal, ...prev];
      return updated.slice(0, 4);
    });

    setDealIndex(prev => prev + 1);
  }, [dealIndex]);

  // Phase 1 timing sequence
  useEffect(() => {
    if (reducedMotion) {
      // Skip to phase 2 with all pins visible
      setAllPins(dealData.map((d, i) => ({ ...d, id: i })));
      setPhase(2);
      return;
    }

    if (phase !== 1) return;

    // Timing intervals - start slow, get faster
    const timings = [800, 700, 600, 500, 450, 400, 350, 300, 250, 200];
    
    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const scheduleDeal = () => {
      if (currentIndex >= dealData.length) {
        // Transition to phase 2 after a brief pause
        setTimeout(() => {
          setVisibleNotifications([]);
          setPhase(2);
        }, 800);
        return;
      }

      const delay = timings[Math.min(currentIndex, timings.length - 1)];
      
      timeoutId = setTimeout(() => {
        addDeal();
        currentIndex++;
        scheduleDeal();
      }, delay);
    };

    // Start after initial delay
    const initialTimeout = setTimeout(() => {
      scheduleDeal();
    }, 500);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, [phase, addDeal, reducedMotion]);

  return (
    <div 
      className="relative w-full h-[350px] sm:h-[400px] lg:h-[450px]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Label */}
      <div className="absolute top-0 left-0 z-20">
        <span className="text-[10px] sm:text-xs font-medium text-primary-foreground/70 bg-primary/30 backdrop-blur-sm px-2 py-1 rounded-full">
          Real CLX deals across the country
        </span>
      </div>

      {/* Map background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full h-full"
        >
          <USMapSVG className="w-full h-full text-primary-foreground/15" />
          
          {/* Map pins */}
          {allPins.map((pin, index) => (
            <MapPing
              key={pin.id}
              x={pin.mapX}
              y={pin.mapY}
              delay={reducedMotion ? 0 : 0}
            />
          ))}
        </motion.div>
      </div>

      {/* Notification stack */}
      <AnimatePresence>
        {phase === 1 && !reducedMotion && (
          <motion.div
            className="absolute top-8 right-0 z-30 space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            {visibleNotifications.map((deal, index) => (
              <DealNotification
                key={deal.id}
                deal={deal}
                index={index}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phone mockup */}
      <div className="absolute bottom-0 right-4 sm:right-8 z-20">
        <PhoneMockup 
          isActive={phase === 2} 
          isPaused={isHovering}
          reducedMotion={reducedMotion}
        />
        
        {/* Caption under phone */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 2 ? 1 : 0.5 }}
          transition={{ duration: 0.5, delay: phase === 2 ? 0.5 : 0 }}
          className="text-[9px] sm:text-[10px] text-primary-foreground/60 text-center mt-2"
        >
          Sampling of transactions closed in the last 12 months
        </motion.p>
      </div>

      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default CLXHeroAnimation;
