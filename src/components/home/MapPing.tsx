import { motion } from "framer-motion";

interface MapPingProps {
  x: number;
  y: number;
  showRing?: boolean;
}

const MapPing = ({ x, y, showRing = true }: MapPingProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Pin dot - stays permanently */}
      <motion.div 
        className="w-2.5 h-2.5 bg-accent rounded-full relative z-10 shadow-sm shadow-accent/50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      />
      
      {/* Ping ring animation - only shows during Phase 1 */}
      {showRing && (
        <motion.div
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 4 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 border-2 border-accent rounded-full"
        />
      )}
    </motion.div>
  );
};

export default MapPing;
