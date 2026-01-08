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
  { id: 1, city: "Dallas", state: "TX", amount: "$2.4M", type: "SBA Loan", days: 21, x: 48, y: 72 },
  { id: 2, city: "Phoenix", state: "AZ", amount: "$1.8M", type: "Industrial Refinance", days: 28, x: 22, y: 62 },
  { id: 3, city: "Chicago", state: "IL", amount: "$3.2M", type: "Commercial Real Estate", days: 35, x: 58, y: 38 },
  { id: 4, city: "Atlanta", state: "GA", amount: "$2.1M", type: "Business Acquisition", days: 24, x: 68, y: 60 },
  { id: 5, city: "Denver", state: "CO", amount: "$1.5M", type: "Equipment Financing", days: 18, x: 35, y: 48 },
  { id: 6, city: "Seattle", state: "WA", amount: "$4.1M", type: "SBA 504 Loan", days: 32, x: 15, y: 22 },
  { id: 7, city: "Miami", state: "FL", amount: "$2.8M", type: "Working Capital", days: 14, x: 78, y: 85 },
  { id: 8, city: "Boston", state: "MA", amount: "$1.9M", type: "Commercial Mortgage", days: 26, x: 88, y: 30 },
  { id: 9, city: "Los Angeles", state: "CA", amount: "$5.2M", type: "Mixed-Use Property", days: 42, x: 12, y: 58 },
  { id: 10, city: "New York", state: "NY", amount: "$3.7M", type: "Office Building", days: 38, x: 82, y: 35 },
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
      {/* USA Map SVG - Continental United States */}
      <svg
        viewBox="0 0 1000 600"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Continental US outline */}
        <path
          d="M60,200 C60,190 70,175 85,165 C100,155 120,145 145,140 L150,130 L160,125 L175,122 L195,120 L220,118 L250,115 L280,112 L310,110 L340,108 L375,106 L410,105 L445,104 L480,103 L515,102 L550,100 L580,98 L610,96 L640,95 L670,96 L700,100 L725,108 L745,118 L760,130 L772,145 L782,162 L790,180 L795,200 L798,220 L800,240 L800,260 L798,280 L795,298 L790,315 L782,330 L772,342 L760,352 L745,360 L728,368 L712,378 L700,390 L692,405 L688,422 L690,440 L698,458 L710,475 L720,490 L725,505 L722,518 L712,528 L695,535 L675,540 L652,542 L628,540 L605,535 L585,528 L568,518 L555,505 L545,490 L538,472 L532,455 L525,440 L515,428 L502,418 L485,412 L465,410 L442,412 L420,418 L400,428 L382,440 L368,455 L358,472 L352,490 L350,508 L352,525 L358,540 L368,552 L380,562 L392,568 L402,572 L408,578 L410,588 L405,598 L395,605 L380,608 L362,605 L345,598 L330,588 L318,575 L308,560 L300,542 L292,525 L282,510 L268,498 L250,490 L228,485 L205,482 L180,480 L155,478 L132,475 L112,470 L95,462 L82,450 L72,435 L65,418 L60,400 L58,380 L58,360 L60,340 L62,320 L62,300 L60,280 L55,260 L50,240 L48,220 L52,205 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-primary-foreground/40"
        />
        {/* Florida peninsula */}
        <path
          d="M690,440 L698,458 L710,475 L720,490 L725,505 L728,520 L732,538 L738,555 L748,568 L760,575 L772,575 L782,568 L788,555 L790,540 L788,522 L782,505 L772,490 L758,478 L742,468 L725,460 L710,455 L698,452"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-primary-foreground/40"
        />
        {/* Michigan upper peninsula hint */}
        <path
          d="M560,180 C575,175 590,178 598,188 C602,198 598,210 588,218 C578,222 565,220 558,210 C552,200 552,188 560,180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary-foreground/30"
        />
        {/* Great Lakes indication */}
        <ellipse cx="595" cy="195" rx="30" ry="22" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary-foreground/20" />
        <ellipse cx="555" cy="210" rx="22" ry="15" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary-foreground/20" />
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
