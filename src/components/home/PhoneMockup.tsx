import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface Transaction {
  amount: string;
  type: string;
  industry: string;
  state: string;
}

const allTransactions: Transaction[] = [
  { amount: "$2.3M", type: "SBA 7(a)", industry: "Logistics", state: "TX" },
  { amount: "$1.8M", type: "CRE Refinance", industry: "Medical Office", state: "FL" },
  { amount: "$3.4M", type: "SBA 504", industry: "Manufacturing", state: "IL" },
  { amount: "$950K", type: "Working Capital", industry: "E-Commerce", state: "CA" },
  { amount: "$4.2M", type: "Construction", industry: "Multifamily", state: "AZ" },
  { amount: "$675K", type: "Acquisition", industry: "Dental Practice", state: "NY" },
  { amount: "$2.9M", type: "Bridge Loan", industry: "Industrial", state: "OH" },
  { amount: "$1.5M", type: "Equipment", industry: "Restaurant Group", state: "GA" },
  { amount: "$5.1M", type: "CRE Purchase", industry: "Retail Center", state: "NC" },
  { amount: "$890K", type: "SBA 7(a)", industry: "Auto Service", state: "WA" },
  { amount: "$2.1M", type: "Refinance", industry: "Hotel", state: "NV" },
  { amount: "$1.2M", type: "Working Capital", industry: "Tech Startup", state: "CO" },
];

interface PhoneMockupProps {
  isActive: boolean;
  isPaused: boolean;
  reducedMotion: boolean;
}

const PhoneMockup = ({ isActive, isPaused, reducedMotion }: PhoneMockupProps) => {
  const [visibleTransactions, setVisibleTransactions] = useState<Transaction[]>(
    allTransactions.slice(0, 5)
  );
  const [currentIndex, setCurrentIndex] = useState(5);

  useEffect(() => {
    if (!isActive || isPaused || reducedMotion) return;

    const interval = setInterval(() => {
      setVisibleTransactions(prev => {
        const newTransactions = [...prev.slice(1)];
        newTransactions.push(allTransactions[currentIndex % allTransactions.length]);
        return newTransactions;
      });
      setCurrentIndex(prev => prev + 1);
    }, 3500);

    return () => clearInterval(interval);
  }, [isActive, isPaused, currentIndex, reducedMotion]);

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0.8 }}
      animate={{ 
        scale: isActive ? 1.03 : 0.95, 
        opacity: 1 
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative"
    >
      {/* Phone frame */}
      <div className="relative w-[200px] sm:w-[240px] bg-card/90 backdrop-blur-md rounded-[24px] border-2 border-border/60 shadow-2xl overflow-hidden">
        {/* Phone notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-muted rounded-full" />
        
        {/* Screen content */}
        <div className="pt-8 pb-4 px-2">
          {/* Header */}
          <div className="text-center mb-3 px-2">
            <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">
              CLX Transactions
            </p>
            <p className="text-[8px] text-muted-foreground">Last 12 months</p>
          </div>

          {/* Transaction list */}
          <div className="space-y-1.5 overflow-hidden h-[180px] sm:h-[200px]">
            <AnimatePresence mode="popLayout">
              {visibleTransactions.map((tx, index) => (
                <motion.div
                  key={`${tx.amount}-${tx.industry}-${currentIndex - 5 + index}`}
                  initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? {} : { opacity: 0, y: -20 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="bg-muted/50 rounded-lg p-2 border border-border/30"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-accent">{tx.amount}</span>
                    <span className="text-[9px] text-muted-foreground">{tx.state}</span>
                  </div>
                  <p className="text-[9px] text-foreground truncate">{tx.type}</p>
                  <p className="text-[8px] text-muted-foreground truncate">{tx.industry}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-20 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
    </motion.div>
  );
};

export default PhoneMockup;
