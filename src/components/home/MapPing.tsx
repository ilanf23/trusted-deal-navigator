import { motion } from "framer-motion";

interface MapPingProps {
  x: number;
  y: number;
  delay?: number;
}

const MapPing = ({ x, y, delay = 0 }: MapPingProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay, ease: "easeOut" }}
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Pin dot */}
      <div className="w-2 h-2 bg-accent rounded-full relative z-10" />
      
      {/* Ping ring animation */}
      <motion.div
        initial={{ opacity: 0.6, scale: 1 }}
        animate={{ opacity: 0, scale: 3 }}
        transition={{ duration: 0.8, delay: delay + 0.1, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border-2 border-accent rounded-full"
      />
    </motion.div>
  );
};

export default MapPing;
