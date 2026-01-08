import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, TrendingUp, Briefcase, Rocket, PiggyBank, Store, Home, Flame } from "lucide-react";

const rotatingItems = [
  { word: "Business Owners", icon: Briefcase, animation: "animate-briefcase", isRealEstate: false, isRocket: false },
  { word: "Entrepreneurs", icon: Rocket, animation: "animate-rocket", isRealEstate: false, isRocket: true },
  { word: "Investors", icon: PiggyBank, animation: "animate-piggybank", isRealEstate: false, isRocket: false },
  { word: "Franchisees", icon: Store, animation: "animate-store", isRealEstate: false, isRocket: false },
  { word: "Real Estate Buyers", icon: Home, animation: "animate-building", isRealEstate: true, isRocket: false },
];

const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [iconPhase, setIconPhase] = useState<"enter" | "active" | "exit">("enter");
  const [housesVisible, setHousesVisible] = useState(0);
  const [rocketPhase, setRocketPhase] = useState<"appear" | "ignite" | "liftoff" | "idle">("idle");

  const isRealEstate = rotatingItems[currentIndex].isRealEstate;
  const isRocket = rotatingItems[currentIndex].isRocket;

  // Real Estate houses animation
  useEffect(() => {
    let houseInterval: NodeJS.Timeout | null = null;
    
    if (isRealEstate && iconPhase === "active") {
      setHousesVisible(1);
      let count = 1;
      houseInterval = setInterval(() => {
        count++;
        if (count <= 3) {
          setHousesVisible(count);
        }
      }, 800);
    } else {
      setHousesVisible(0);
    }

    return () => {
      if (houseInterval) clearInterval(houseInterval);
    };
  }, [isRealEstate, iconPhase]);

  // Rocket animation sequence
  useEffect(() => {
    if (isRocket && iconPhase === "enter") {
      setRocketPhase("appear");
    } else if (isRocket && iconPhase === "active") {
      // Phase 1: Appear (already done)
      setRocketPhase("appear");
      
      // Phase 2: Ignite flames after 800ms
      const igniteTimeout = setTimeout(() => {
        setRocketPhase("ignite");
      }, 800);
      
      // Phase 3: Liftoff after 2.5s
      const liftoffTimeout = setTimeout(() => {
        setRocketPhase("liftoff");
      }, 2500);
      
      return () => {
        clearTimeout(igniteTimeout);
        clearTimeout(liftoffTimeout);
      };
    } else if (!isRocket) {
      setRocketPhase("idle");
    }
  }, [isRocket, iconPhase]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Start exit animation
      setIconPhase("exit");
      setIsAnimating(true);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % rotatingItems.length);
        setIsAnimating(false);
        setIconPhase("enter");
        
        // Transition to active phase
        setTimeout(() => {
          setIconPhase("active");
        }, 500);
      }, 600);
    }, 5000);
    
    // Initial active phase
    const initialTimeout = setTimeout(() => {
      setIconPhase("active");
    }, 500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []);

  const CurrentIcon = rotatingItems[currentIndex].icon;
  const currentAnimation = rotatingItems[currentIndex].animation;

  const getIconAnimationClass = () => {
    if (iconPhase === "enter") {
      return "opacity-0 scale-50";
    }
    if (iconPhase === "exit") {
      // Each icon has unique exit animation
      switch (currentAnimation) {
        case "animate-rocket":
          return "opacity-0 -translate-y-32 translate-x-16 rotate-45 scale-75";
        case "animate-briefcase":
          return "opacity-0 rotate-12 scale-50";
        case "animate-piggybank":
          return "opacity-0 translate-y-8 scale-125";
        case "animate-store":
          return "opacity-0 scale-0 rotate-180";
        case "animate-building":
          return "opacity-0 translate-y-4 scale-90";
        default:
          return "opacity-0 scale-75";
      }
    }
    // Active state with subtle animations
    switch (currentAnimation) {
      case "animate-rocket":
        return "opacity-100 scale-100 animate-pulse hover:-translate-y-2";
      case "animate-briefcase":
        return "opacity-100 scale-100 hover:rotate-6";
      case "animate-piggybank":
        return "opacity-100 scale-100 hover:scale-110";
      case "animate-store":
        return "opacity-100 scale-100 hover:scale-105";
      case "animate-building":
        return "opacity-100 scale-100 hover:translate-y-[-4px]";
      default:
        return "opacity-100 scale-100";
    }
  };

  const highlights = [{
    icon: Users,
    text: "300+ Lending Partners"
  }, {
    icon: Shield,
    text: "No Upfront Fees"
  }, {
    icon: TrendingUp,
    text: "Success-Based Model"
  }];

  return (
    <section className="relative min-h-[90vh] flex items-center hero-gradient overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-foreground/20 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="section-container relative z-10 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full text-primary-foreground/90 text-sm font-medium mb-8 animate-fade-in">
              <Shield className="w-4 h-4" />
              Trusted by 500+ Business Owners & Investors
            </div>

            {/* Main Headline */}
            <h1 className="text-primary-foreground mb-6 animate-fade-in-up">
              Commercial Financing
              <br />
              <span className="text-accent">
                for{" "}
                <span 
                  className={`inline-block transition-all duration-500 underline decoration-accent underline-offset-4 ${
                    isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {rotatingItems[currentIndex].word}
                </span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8 max-w-2xl leading-relaxed animate-fade-in-up animation-delay-100">
              Navigate complex commercial financing with confidence. Access hundreds of 
              lending partners including banks, SBA, and alternative lenders with our success-based 
              fee model.
            </p>

            {/* Highlights */}
            <div className="flex flex-wrap gap-6 mb-10 animate-fade-in-up animation-delay-200">
              {highlights.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-primary-foreground/90">
                  <item.icon className="w-5 h-5 text-accent" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="animate-fade-in-up animation-delay-300">
              <Button 
                variant="hero" 
                size="xl" 
                className="group"
                onClick={() => {
                  // @ts-ignore - Calendly is loaded via script
                  window.Calendly?.initPopupWidget({
                    url: 'https://calendly.com/adam-fridman/30min'
                  });
                }}
              >
                Talk to Brad
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          {/* Large Icon Display */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative">
              {/* Glow effect behind icon */}
              <div className={`absolute inset-0 bg-accent/20 rounded-full blur-3xl transition-all duration-700 ${
                iconPhase === "active" ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`} />
              
              {/* Real Estate - Multiple Houses */}
              {isRealEstate ? (
                <div className={`flex items-end gap-4 transition-all duration-700 ${
                  iconPhase === "exit" ? "opacity-0 translate-y-8" : ""
                }`}>
                  <Home 
                    className={`w-32 h-32 md:w-40 md:h-40 text-accent transition-all duration-500 ${
                      housesVisible >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    strokeWidth={1}
                  />
                  <Home 
                    className={`w-40 h-40 md:w-52 md:h-52 text-accent transition-all duration-500 delay-100 ${
                      housesVisible >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    strokeWidth={1}
                  />
                  <Home 
                    className={`w-36 h-36 md:w-44 md:h-44 text-accent transition-all duration-500 delay-200 ${
                      housesVisible >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    strokeWidth={1}
                  />
                </div>
              ) : isRocket ? (
                /* Rocket with flames animation */
                <div className={`relative transition-all duration-1000 ease-out ${
                  rocketPhase === "liftoff" 
                    ? "translate-x-[200%] -translate-y-32 rotate-45 opacity-0" 
                    : rocketPhase === "appear" || rocketPhase === "ignite"
                    ? "opacity-100 translate-x-0 translate-y-0"
                    : "opacity-0 scale-50"
                }`}>
                  {/* Rocket */}
                  <Rocket 
                    className={`w-48 h-48 md:w-64 md:h-64 xl:w-80 xl:h-80 text-accent transition-all duration-500 rotate-90 ${
                      rocketPhase === "ignite" || rocketPhase === "liftoff" ? "animate-[wiggle_0.1s_ease-in-out_infinite]" : ""
                    }`}
                    strokeWidth={1}
                  />
                  
                  {/* Flames */}
                  <div className={`absolute -left-8 md:-left-12 top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 ${
                    rocketPhase === "ignite" || rocketPhase === "liftoff" ? "opacity-100 scale-100" : "opacity-0 scale-0"
                  }`}>
                    <Flame 
                      className="w-16 h-16 md:w-24 md:h-24 text-orange-500 animate-pulse" 
                      strokeWidth={1.5}
                      fill="currentColor"
                    />
                    <Flame 
                      className="w-12 h-12 md:w-20 md:h-20 text-yellow-400 -mt-8 md:-mt-12 animate-pulse animation-delay-100" 
                      strokeWidth={1.5}
                      fill="currentColor"
                    />
                    <Flame 
                      className="w-10 h-10 md:w-16 md:h-16 text-red-500 -mt-6 md:-mt-10 animate-pulse animation-delay-200" 
                      strokeWidth={1.5}
                      fill="currentColor"
                    />
                  </div>
                </div>
              ) : (
                /* Main Icon for other types */
                <CurrentIcon 
                  className={`w-48 h-48 md:w-64 md:h-64 xl:w-80 xl:h-80 text-accent transition-all duration-700 ease-out ${getIconAnimationClass()}`}
                  strokeWidth={1}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-primary-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 rounded-full bg-primary-foreground/50 animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;