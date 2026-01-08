import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";

interface Deal {
  id: number;
  city: string;
  state: string;
  amount: string;
  type: string;
  days: number;
  x: number; // percentage position
  y: number; // percentage position
}

const deals: Deal[] = [
  { id: 1, city: "Dallas", state: "TX", amount: "$2.4M", type: "SBA Loan", days: 21, x: 45, y: 62 },
  { id: 2, city: "Phoenix", state: "AZ", amount: "$1.8M", type: "Industrial Refinance", days: 28, x: 22, y: 55 },
  { id: 3, city: "Chicago", state: "IL", amount: "$3.2M", type: "Commercial Real Estate", days: 35, x: 58, y: 35 },
  { id: 4, city: "Atlanta", state: "GA", amount: "$2.1M", type: "Business Acquisition", days: 24, x: 68, y: 58 },
  { id: 5, city: "Denver", state: "CO", amount: "$1.5M", type: "Equipment Financing", days: 18, x: 32, y: 42 },
  { id: 6, city: "Seattle", state: "WA", amount: "$4.1M", type: "SBA 504 Loan", days: 32, x: 15, y: 18 },
  { id: 7, city: "Miami", state: "FL", amount: "$2.8M", type: "Working Capital", days: 14, x: 78, y: 78 },
  { id: 8, city: "Boston", state: "MA", amount: "$1.9M", type: "Commercial Mortgage", days: 26, x: 88, y: 28 },
  { id: 9, city: "Los Angeles", state: "CA", amount: "$5.2M", type: "Mixed-Use Property", days: 42, x: 12, y: 52 },
  { id: 10, city: "New York", state: "NY", amount: "$3.7M", type: "Office Building", days: 38, x: 85, y: 32 },
];

const DealPulseMap = () => {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [pulsingDeals, setPulsingDeals] = useState<number[]>([]);

  useEffect(() => {
    let dealIndex = 0;
    
    const showNextDeal = () => {
      const deal = deals[dealIndex];
      
      // Add pulse
      setPulsingDeals(prev => [...prev, deal.id]);
      
      // Show notification after pulse starts
      setTimeout(() => {
        setActiveDeal(deal);
      }, 500);
      
      // Hide notification
      setTimeout(() => {
        setActiveDeal(null);
      }, 4000);
      
      // Remove pulse
      setTimeout(() => {
        setPulsingDeals(prev => prev.filter(id => id !== deal.id));
      }, 5000);
      
      dealIndex = (dealIndex + 1) % deals.length;
    };
    
    // Start first deal
    showNextDeal();
    
    // Continue cycling
    const interval = setInterval(showNextDeal, 6000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-primary-foreground/5 rounded-2xl backdrop-blur-sm border border-primary-foreground/10 overflow-hidden">
      {/* Simplified US Map SVG */}
      <svg
        viewBox="0 0 100 70"
        className="w-full h-full opacity-30"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Simplified continental US outline */}
        <path
          d="M10,20 L15,15 L25,12 L35,14 L45,12 L55,10 L65,12 L75,15 L85,18 L90,25 L88,35 L85,40 L80,45 L75,50 L78,60 L75,65 L70,60 L65,58 L60,62 L55,60 L50,62 L45,65 L40,62 L35,58 L30,55 L25,52 L20,48 L15,45 L12,40 L10,35 L8,28 Z"
          fill="currentColor"
          className="text-primary-foreground/20"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
      
      {/* Deal Pulses */}
      {deals.map((deal) => (
        <div
          key={deal.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${deal.x}%`, top: `${deal.y}%` }}
        >
          {/* Static dot */}
          <div className="w-2 h-2 rounded-full bg-accent/60" />
          
          {/* Pulsing ring */}
          {pulsingDeals.includes(deal.id) && (
            <>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-accent animate-ping" />
              <div 
                className="absolute -inset-2 w-6 h-6 rounded-full border-2 border-accent/50 animate-pulse"
                style={{ animation: 'pulse 1.5s ease-out infinite' }}
              />
              <div 
                className="absolute -inset-4 w-10 h-10 rounded-full border border-accent/30"
                style={{ animation: 'ping 2s ease-out infinite' }}
              />
            </>
          )}
        </div>
      ))}
      
      {/* Deal Notification Card */}
      <div
        className={`absolute bottom-4 left-4 right-4 transition-all duration-700 ease-out ${
          activeDeal 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-card/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-border/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">
                {activeDeal?.amount} {activeDeal?.type} Closed
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {activeDeal?.type} • {activeDeal?.city}, {activeDeal?.state}
              </p>
              <p className="text-accent text-xs font-medium mt-1">
                Closed in {activeDeal?.days} Days
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Subtle label */}
      <div className="absolute top-4 left-4">
        <p className="text-primary-foreground/40 text-xs font-medium uppercase tracking-wider">
          Live Deal Activity
        </p>
      </div>
    </div>
  );
};

export default DealPulseMap;
