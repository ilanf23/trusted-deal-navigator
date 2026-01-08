import { useState, useEffect, useRef } from "react";
import { TrendingUp, Handshake, Calendar, DollarSign } from "lucide-react";
import bankBackground from "@/assets/bank-background.jpg";

const useCountUp = (end: number, duration: number = 2000, startCounting: boolean = false) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!startCounting) return;
    
    let startTime: number | null = null;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, startCounting]);
  
  return count;
};

const AnimatedStat = ({ 
  icon: Icon, 
  value, 
  label, 
  description, 
  index 
}: { 
  icon: React.ElementType; 
  value: string; 
  label: string; 
  description: string; 
  index: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  // Parse the value to extract number and format
  const parseValue = (val: string) => {
    const hasPlus = val.includes('+');
    const hasDollar = val.includes('$');
    const hasM = val.includes('M');
    const numericValue = parseFloat(val.replace(/[$M+,]/g, ''));
    return { numericValue, hasPlus, hasDollar, hasM };
  };
  
  const { numericValue, hasPlus, hasDollar, hasM } = parseValue(value);
  const animatedValue = useCountUp(numericValue, 2000, isVisible);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  const formatValue = () => {
    let result = '';
    if (hasDollar) result += '$';
    result += animatedValue;
    if (hasM) result += 'M';
    if (hasPlus) result += '+';
    return result;
  };
  
  return (
    <div
      ref={ref}
      className="text-center animate-fade-in-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
        {formatValue()}
      </div>
      <div className="font-semibold text-foreground mb-1">{label}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  );
};

const StatsSection = () => {
  const stats = [
    {
      icon: DollarSign,
      value: "$500M+",
      label: "Total Funded",
      description: "In commercial loans facilitated",
    },
    {
      icon: Handshake,
      value: "300+",
      label: "Lending Partners",
      description: "Banks, SBA & alternative lenders",
    },
    {
      icon: Calendar,
      value: "15+",
      label: "Years Experience",
      description: "In commercial lending",
    },
    {
      icon: TrendingUp,
      value: "$2M+",
      label: "Referral Fees Paid",
      description: "To our partner network",
    },
  ];

  return (
    <section 
      className="py-20 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bankBackground})` }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-primary/75" />
      <div className="section-container relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <AnimatedStat
              key={index}
              icon={stat.icon}
              value={stat.value}
              label={stat.label}
              description={stat.description}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
