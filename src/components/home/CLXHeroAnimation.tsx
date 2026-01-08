import { useState, useEffect, useRef } from "react";
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
  { amount: "$2.3M", type: "SBA 7(a)", industry: "Logistics", state: "TX", mapX: 45, mapY: 70 },
  { amount: "$1.8M", type: "CRE Refinance", industry: "Medical Office", state: "FL", mapX: 78, mapY: 80 },
  { amount: "$3.4M", type: "SBA 504", industry: "Manufacturing", state: "IL", mapX: 58, mapY: 40 },
  { amount: "$950K", type: "Working Capital", industry: "E-Commerce", state: "CA", mapX: 12, mapY: 45 },
  { amount: "$4.2M", type: "Construction", industry: "Multifamily", state: "AZ", mapX: 22, mapY: 60 },
  { amount: "$675K", type: "Acquisition", industry: "Dental Practice", state: "NY", mapX: 82, mapY: 32 },
  { amount: "$2.9M", type: "Bridge Loan", industry: "Industrial", state: "OH", mapX: 68, mapY: 38 },
  { amount: "$1.5M", type: "Equipment", industry: "Restaurant Group", state: "GA", mapX: 72, mapY: 62 },
  { amount: "$5.1M", type: "CRE Purchase", industry: "Retail Center", state: "NC", mapX: 76, mapY: 52 },
  { amount: "$1.2M", type: "SBA 7(a)", industry: "FedEx Routes", state: "WA", mapX: 14, mapY: 18 },
];

const CLXHeroAnimation = () => {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [visibleNotifications, setVisibleNotifications] = useState<Deal[]>([]);
  const [allPins, setAllPins] = useState<Deal[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dealIndexRef = useRef(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Phase 1: Deal burst animation sequence
  useEffect(() => {
    if (reducedMotion) {
      // Skip to phase 2 with all pins visible
      setAllPins(dealData.map((d, i) => ({ ...d, id: i })));
      setPhase(2);
      return;
    }

    if (phase !== 1) return;

    // Timing intervals - start slow, get faster (in ms)
    const timings = [700, 600, 550, 500, 450, 400, 350, 300, 250, 200];
    
    const addDeal = () => {
      const index = dealIndexRef.current;
      if (index >= dealData.length) return;

      const newDeal: Deal = {
        ...dealData[index],
        id: Date.now() + index,
      };

      // Add to pins (permanent)
      setAllPins(prev => [...prev, newDeal]);

      // Add to notifications - max 4 visible normally, allow 5 at overflow moment
      const maxVisible = index >= dealData.length - 3 ? 5 : 4;
      setVisibleNotifications(prev => {
        const updated = [newDeal, ...prev];
        return updated.slice(0, maxVisible);
      });

      dealIndexRef.current = index + 1;
    };

    const scheduleDeal = (index: number) => {
      if (index >= dealData.length) {
        // Transition to phase 2 after clearing notifications
        const transitionTimeout = setTimeout(() => {
          setVisibleNotifications([]);
          setTimeout(() => setPhase(2), 300);
        }, 800);
        timeoutsRef.current.push(transitionTimeout);
        return;
      }

      const delay = timings[Math.min(index, timings.length - 1)];
      
      const timeout = setTimeout(() => {
        addDeal();
        scheduleDeal(index + 1);
      }, delay);
      
      timeoutsRef.current.push(timeout);
    };

    // Start after initial 1s pause
    const initialTimeout = setTimeout(() => {
      addDeal(); // First deal
      scheduleDeal(1); // Schedule remaining deals
    }, 1000);
    
    timeoutsRef.current.push(initialTimeout);

    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [phase, reducedMotion]);

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
          <AnimatePresence>
            {allPins.map((pin) => (
              <MapPing
                key={pin.id}
                x={pin.mapX}
                y={pin.mapY}
                showRing={phase === 1 && !reducedMotion}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Notification stack - positioned top-right of animation area */}
      <AnimatePresence>
        {phase === 1 && !reducedMotion && visibleNotifications.length > 0 && (
          <motion.div
            className="absolute top-10 right-0 z-30 flex flex-col gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AnimatePresence mode="popLayout">
              {visibleNotifications.map((deal, index) => (
                <DealNotification
                  key={deal.id}
                  deal={deal}
                  index={index}
                />
              ))}
            </AnimatePresence>
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
          initial={{ opacity: 0.5 }}
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
