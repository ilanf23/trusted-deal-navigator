import { useEffect, useState, useMemo, useRef } from "react";
import { Mail } from "lucide-react";

interface EmailNotificationsProps {
  dotCount: number;
}

interface Notification {
  id: number;
  title: string;
  subtitle: string;
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
];

const VISIBLE_COUNT = 4;
const TOTAL_DOTS = 1100; // Dense grid creates ~1100 dots for solid fill

const EmailNotifications = ({ dotCount }: EmailNotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [animationComplete, setAnimationComplete] = useState(false);
  const notificationIdRef = useRef(0);
  const cycleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Shuffle deals once on mount
  const shuffledDeals = useMemo(() => {
    const shuffled = [...deals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Handle initial animation (synced with dots)
  useEffect(() => {
    if (dotCount > 0 && !animationComplete) {
      const deal = shuffledDeals[(dotCount - 1) % shuffledDeals.length];
      const newNotification: Notification = {
        id: notificationIdRef.current++,
        title: deal.title,
        subtitle: deal.subtitle,
      };
      
      setNotifications((prev) => {
        const updated = [newNotification, ...prev].slice(0, VISIBLE_COUNT);
        return updated;
      });
      
      // Check if animation is complete
      if (dotCount >= TOTAL_DOTS) {
        setAnimationComplete(true);
      }
    }
  }, [dotCount, shuffledDeals, animationComplete]);

  // After animation completes, cycle through deals every 1.5 seconds
  useEffect(() => {
    if (animationComplete) {
      cycleIntervalRef.current = setInterval(() => {
        const dealIndex = notificationIdRef.current % shuffledDeals.length;
        const deal = shuffledDeals[dealIndex];
        const newNotification: Notification = {
          id: notificationIdRef.current++,
          title: deal.title,
          subtitle: deal.subtitle,
        };
        
        setNotifications((prev) => {
          const updated = [newNotification, ...prev].slice(0, VISIBLE_COUNT);
          return updated;
        });
      }, 1500);

      return () => {
        if (cycleIntervalRef.current) {
          clearInterval(cycleIntervalRef.current);
        }
      };
    }
  }, [animationComplete, shuffledDeals]);

  if (notifications.length === 0) return null;

  return (
    <div className="w-72 relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Mail className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-primary-foreground text-xs font-medium">Deal Notifications</p>
          <p className="text-primary-foreground/50 text-[10px]">Real-time updates</p>
        </div>
      </div>
      
      {/* Notifications stack */}
      <div className="relative space-y-2 overflow-hidden" style={{ maxHeight: '280px' }}>
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="bg-primary-foreground/10 backdrop-blur-md rounded-lg px-3 py-2.5 border border-primary-foreground/15 transition-all duration-500 ease-out"
            style={{
              opacity: 1 - index * 0.2,
              transform: `translateY(0)`,
              animation: index === 0 ? 'slideDown 0.4s ease-out' : undefined,
            }}
          >
            <p className="text-primary-foreground text-xs font-semibold leading-tight">
              {notification.title}
            </p>
            <p className="text-primary-foreground/60 text-[10px] leading-tight mt-0.5">
              {notification.subtitle}
            </p>
          </div>
        ))}
        
        {/* Fade out gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-primary/80 to-transparent pointer-events-none" />
      </div>
      
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default EmailNotifications;
