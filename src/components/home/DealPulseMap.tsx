import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import usaOutline from "@/assets/usa-outline.png";

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
  { id: 1, city: "Dallas", state: "TX", amount: "$2.4M", type: "SBA Loan", days: 21, x: 52, y: 62 },
  { id: 2, city: "Phoenix", state: "AZ", amount: "$1.8M", type: "Industrial Refinance", days: 28, x: 28, y: 58 },
  { id: 3, city: "Chicago", state: "IL", amount: "$3.2M", type: "Commercial Real Estate", days: 35, x: 60, y: 35 },
  { id: 4, city: "Atlanta", state: "GA", amount: "$2.1M", type: "Business Acquisition", days: 24, x: 70, y: 52 },
  { id: 5, city: "Denver", state: "CO", amount: "$1.5M", type: "Equipment Financing", days: 18, x: 38, y: 42 },
  { id: 6, city: "Seattle", state: "WA", amount: "$4.1M", type: "SBA 504 Loan", days: 32, x: 22, y: 22 },
  { id: 7, city: "Miami", state: "FL", amount: "$2.8M", type: "Working Capital", days: 14, x: 71, y: 82 },
  { id: 8, city: "Boston", state: "MA", amount: "$1.9M", type: "Commercial Mortgage", days: 26, x: 85, y: 34 },
  { id: 9, city: "Los Angeles", state: "CA", amount: "$5.2M", type: "Mixed-Use Property", days: 42, x: 20, y: 52 },
  { id: 10, city: "New York", state: "NY", amount: "$3.7M", type: "Office Building", days: 38, x: 82, y: 38 },
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
      
      // Show deal notification after pulse starts
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
      {/* USA Map Image */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <img 
          src={usaOutline} 
          alt="USA Map" 
          className="object-contain"
          style={{ 
            filter: 'invert(1) opacity(0.6)',
            width: '140%',
            height: '140%',
            maxWidth: 'none'
          }}
        />
      </div>
      
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
