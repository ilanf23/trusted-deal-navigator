import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

interface DealNotificationProps {
  deal: {
    amount: string;
    type: string;
    industry: string;
    state: string;
  };
  index: number;
  isExiting?: boolean;
}

const DealNotification = ({ deal, index, isExiting }: DealNotificationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50, y: -10 }}
      animate={{ 
        opacity: isExiting ? 0 : 1, 
        x: isExiting ? 50 : 0, 
        y: 0 
      }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ 
        duration: 0.25, 
        ease: "easeOut",
        delay: index * 0.05 
      }}
      className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg min-w-[200px] max-w-[240px]"
    >
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            Closed: {deal.amount} {deal.type}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {deal.industry} · {deal.state}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default DealNotification;
