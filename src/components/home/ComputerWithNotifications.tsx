import { useEffect, useState, useMemo } from "react";

interface Notification {
  id: number;
  title: string;
  subtitle: string;
  timestamp: number;
}

interface ComputerWithNotificationsProps {
  dotCount: number;
}

const deals = [
  { title: "Closed: $2.3M SBA 7(a)", subtitle: "Logistics company · Dallas, TX" },
  { title: "Closed: $1.8M CRE Refinance", subtitle: "Medical office · Orlando, FL" },
  { title: "Closed: $3.4M SBA 504", subtitle: "Manufacturing facility · Chicago, IL" },
  { title: "Closed: $950K Working Capital Line", subtitle: "E-commerce retailer · Los Angeles, CA" },
  { title: "Closed: $4.2M Construction Loan", subtitle: "Multifamily project · Phoenix, AZ" },
  { title: "Closed: $675K Business Acquisition", subtitle: "Dental practice · Albany, NY" },
  { title: "Closed: $2.9M Bridge Loan", subtitle: "Industrial warehouse · Columbus, OH" },
  { title: "Closed: $1.6M SBA 7(a)", subtitle: "FedEx route operator · Atlanta, GA" },
  { title: "Closed: $3.1M Owner-Occupied CRE", subtitle: "HVAC contractor HQ · Charlotte, NC" },
  { title: "Closed: $820K Equipment Finance", subtitle: "Food processing plant · Des Moines, IA" },
  { title: "Closed: $5.0M HUD Refinance", subtitle: "Senior housing community · Denver, CO" },
  { title: "Closed: $1.2M SBA 504", subtitle: "Boutique hotel · Nashville, TN" },
  { title: "Closed: $2.0M CRE Acquisition", subtitle: "Retail center · Seattle, WA" },
  { title: "Closed: $740K Working Capital", subtitle: "Professional services firm · Boston, MA" },
  { title: "Closed: $3.8M Construction-to-Perm", subtitle: "Mixed-use development · Austin, TX" },
  { title: "Closed: $1.1M SBA 7(a)", subtitle: "Franchise restaurant · Kansas City, MO" },
  { title: "Closed: $2.7M CRE Refinance", subtitle: "Self-storage facility · Tampa, FL" },
  { title: "Closed: $900K Business Acquisition", subtitle: "Auto repair shop · Cincinnati, OH" },
  { title: "Closed: $1.5M Equipment Term Loan", subtitle: "Printing company · Minneapolis, MN" },
  { title: "Closed: $2.2M SBA 504", subtitle: "Manufacturing plant · Milwaukee, WI" },
  { title: "Closed: $3.6M CRE Acquisition", subtitle: "Medical office building · Salt Lake City, UT" },
  { title: "Closed: $1.0M Working Capital Line", subtitle: "IT services firm · Raleigh, NC" },
  { title: "Closed: $2.9M Construction Loan", subtitle: "Retail plaza · Las Vegas, NV" },
  { title: "Closed: $780K SBA 7(a)", subtitle: "Childcare center · Richmond, VA" },
  { title: "Closed: $1.9M CRE Refinance", subtitle: "Office condo · Hartford, CT" },
  { title: "Closed: $2.5M Bridge Loan", subtitle: "Hotel conversion · New Orleans, LA" },
  { title: "Closed: $640K Equipment Finance", subtitle: "Trucking fleet · Tulsa, OK" },
  { title: "Closed: $3.2M SBA 504", subtitle: "Food manufacturing facility · St. Louis, MO" },
  { title: "Closed: $1.4M Business Acquisition", subtitle: "Veterinary clinic · Boise, ID" },
  { title: "Closed: $2.1M Owner-Occupied CRE", subtitle: "Plumbing contractor HQ · Indianapolis, IN" },
  { title: "Closed: $4.5M Construction Loan", subtitle: "Class A multifamily · Miami, FL" },
  { title: "Closed: $860K Working Capital", subtitle: "Marketing agency · Portland, OR" },
  { title: "Closed: $1.3M SBA 7(a)", subtitle: "Landscaping company · Albuquerque, NM" },
  { title: "Closed: $2.6M CRE Refinance", subtitle: "Flex industrial · Pittsburgh, PA" },
  { title: "Closed: $975K Equipment Term Loan", subtitle: "Metal fabrication shop · Detroit, MI" },
  { title: "Closed: $3.0M SBA 504", subtitle: "Distribution center · Louisville, KY" },
  { title: "Closed: $1.7M Business Acquisition", subtitle: "Roofing contractor · Omaha, NE" },
  { title: "Closed: $2.4M Bridge Loan", subtitle: "Mixed-use building · Providence, RI" },
  { title: "Closed: $890K Working Capital Line", subtitle: "Staffing firm · Baltimore, MD" },
  { title: "Closed: $2.8M CRE Acquisition", subtitle: "Medical clinic · Fresno, CA" },
  { title: "Closed: $1.9M SBA 7(a)", subtitle: "Physical therapy practice · Jacksonville, FL" },
  { title: "Closed: $3.3M CRE Refinance", subtitle: "Industrial park · Oklahoma City, OK" },
  { title: "Closed: $1.0M Equipment Finance", subtitle: "Construction company · Spokane, WA" },
  { title: "Closed: $2.0M SBA 504", subtitle: "Cold storage facility · Grand Rapids, MI" },
  { title: "Closed: $715K Business Acquisition", subtitle: "Pharmacy · Baton Rouge, LA" },
  { title: "Closed: $1.6M Working Capital", subtitle: "Software company · San Diego, CA" },
  { title: "Closed: $2.3M Owner-Occupied CRE", subtitle: "CPA firm office · Columbus, OH" },
  { title: "Closed: $4.0M Construction Loan", subtitle: "Medical office build-to-suit · Houston, TX" },
  { title: "Closed: $930K SBA 7(a)", subtitle: "Restaurant group · Charleston, SC" },
  { title: "Closed: $2.7M CRE Refinance", subtitle: "Shopping center · Columbus, GA" },
  { title: "Closed: $1.2M Equipment Term Loan", subtitle: "Printing & packaging · Wichita, KS" },
  { title: "Closed: $3.5M SBA 504", subtitle: "Manufacturing campus · Peoria, IL" },
  { title: "Closed: $780K Business Acquisition", subtitle: "Insurance agency · Madison, WI" },
  { title: "Closed: $1.8M Bridge Loan", subtitle: "Office building · Newark, NJ" },
  { title: "Closed: $960K Working Capital Line", subtitle: "Healthcare staffing · Phoenix, AZ" },
  { title: "Closed: $2.2M CRE Acquisition", subtitle: "Industrial warehouse · Memphis, TN" },
  { title: "Closed: $1.4M SBA 7(a)", subtitle: "Plumbing & HVAC business · Tampa, FL" },
  { title: "Closed: $2.9M CRE Refinance", subtitle: "Multi-tenant retail · Sacramento, CA" },
  { title: "Closed: $1.1M Equipment Finance", subtitle: "Food distributor · Greensboro, NC" },
  { title: "Closed: $2.6M SBA 504", subtitle: "Plastics manufacturer · Akron, OH" },
  { title: "Closed: $690K Business Acquisition", subtitle: "Fitness center · Colorado Springs, CO" },
  { title: "Closed: $1.5M Working Capital", subtitle: "Engineering firm · Rochester, NY" },
  { title: "Closed: $2.4M Owner-Occupied CRE", subtitle: "Law firm office · Philadelphia, PA" },
  { title: "Closed: $3.9M Construction Loan", subtitle: "Assisted living facility · San Antonio, TX" },
  { title: "Closed: $880K SBA 7(a)", subtitle: "Auto body shop · Tulsa, OK" },
  { title: "Closed: $2.1M CRE Refinance", subtitle: "Medical office complex · Birmingham, AL" },
  { title: "Closed: $1.3M Equipment Term Loan", subtitle: "Cabinet manufacturer · Fort Wayne, IN" },
  { title: "Closed: $3.2M SBA 504", subtitle: "Aerospace components plant · Wichita, KS" },
  { title: "Closed: $740K Business Acquisition", subtitle: "Cleaning services company · Raleigh, NC" },
  { title: "Closed: $1.9M Bridge Loan", subtitle: "Office/retail mixed-use · Boise, ID" },
  { title: "Closed: $920K Working Capital Line", subtitle: "Digital marketing agency · Seattle, WA" },
  { title: "Closed: $2.5M CRE Acquisition", subtitle: "Cold storage warehouse · Kansas City, MO" },
  { title: "Closed: $1.6M SBA 7(a)", subtitle: "Specialty bakery · Portland, OR" },
  { title: "Closed: $2.8M CRE Refinance", subtitle: "Flex industrial · Indianapolis, IN" },
  { title: "Closed: $1.1M Equipment Finance", subtitle: "Concrete contractor · Orlando, FL" },
  { title: "Closed: $3.0M SBA 504", subtitle: "Metal stamping facility · Detroit, MI" },
  { title: "Closed: $800K Business Acquisition", subtitle: "Pest control company · Nashville, TN" },
  { title: "Closed: $1.7M Working Capital", subtitle: "Telecom services firm · Atlanta, GA" },
  { title: "Closed: $2.3M Owner-Occupied CRE", subtitle: "Dental group office · Denver, CO" },
  { title: "Closed: $4.1M Construction Loan", subtitle: "Suburban retail center · Chicago, IL" },
];

const ComputerWithNotifications = ({ dotCount }: ComputerWithNotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Shuffle deals once on mount
  const shuffledDeals = useMemo(() => {
    const shuffled = [...deals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  useEffect(() => {
    if (dotCount > 0) {
      const deal = shuffledDeals[(dotCount - 1) % shuffledDeals.length];
      const newNotification: Notification = {
        id: dotCount,
        title: deal.title,
        subtitle: deal.subtitle,
        timestamp: Date.now(),
      };
      
      setNotifications((prev) => {
        const updated = [...prev, newNotification].slice(-3);
        return updated;
      });

      const timeout = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== dotCount));
      }, 2500);

      return () => clearTimeout(timeout);
    }
  }, [dotCount, shuffledDeals]);

  return (
    <div className="relative">
      {/* Laptop/Computer Outline */}
      <svg 
        width="220" 
        height="160" 
        viewBox="0 0 220 160" 
        fill="none" 
        className="opacity-80"
      >
        {/* Screen */}
        <rect 
          x="10" 
          y="4" 
          width="200" 
          height="120" 
          rx="8" 
          stroke="currentColor" 
          strokeWidth="3" 
          className="text-primary-foreground"
        />
        {/* Screen bezel top (camera) */}
        <circle 
          cx="110" 
          cy="12" 
          r="3" 
          fill="currentColor" 
          className="text-primary-foreground/50"
        />
        {/* Keyboard base */}
        <path 
          d="M0 134 L10 124 L210 124 L220 134 L220 148 C220 152 216 156 212 156 L8 156 C4 156 0 152 0 148 L0 134Z" 
          stroke="currentColor" 
          strokeWidth="3" 
          fill="none"
          className="text-primary-foreground"
        />
        {/* Trackpad */}
        <rect 
          x="85" 
          y="138" 
          width="50" 
          height="10" 
          rx="2" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          className="text-primary-foreground/50"
        />
      </svg>

      {/* Notifications Container */}
      <div className="absolute top-6 left-6 right-6 flex flex-col gap-2 overflow-hidden">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="bg-primary-foreground/15 backdrop-blur-sm rounded-lg px-3 py-2 animate-fade-in border border-primary-foreground/10"
            style={{
              opacity: 1 - index * 0.2,
            }}
          >
            <p className="text-primary-foreground text-[10px] font-semibold leading-tight">
              {notification.title}
            </p>
            <p className="text-primary-foreground/70 text-[8px] leading-tight mt-0.5">
              {notification.subtitle}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComputerWithNotifications;
