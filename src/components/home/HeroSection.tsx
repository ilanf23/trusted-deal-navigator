import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import DealPulseMap from "./DealPulseMap";
const rotatingWords = ["Business Owners", "Entrepreneurs", "Investors", "Franchisees", "Real Estate Buyers"];
const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % rotatingWords.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return <section className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Floating orbs */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-foreground/10 blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-accent/15 blur-3xl animate-[float_10s_ease-in-out_infinite_reverse]" />
        
        {/* Moving gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary-foreground/5 to-transparent animate-[shimmer_15s_ease-in-out_infinite]" />
        
        {/* Subtle animated grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        animation: 'pulse 4s ease-in-out infinite'
      }} />
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-accent/30 animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full bg-primary-foreground/20 animate-[float_8s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 rounded-full bg-accent/40 animate-[float_7s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 right-1/3 w-2 h-2 rounded-full bg-primary-foreground/15 animate-[float_9s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-1/4 right-1/5 w-1.5 h-1.5 rounded-full bg-accent/25 animate-[float_5s_ease-in-out_infinite]" />
        <div className="absolute top-2/3 left-1/5 w-1 h-1 rounded-full bg-primary-foreground/25 animate-[float_10s_ease-in-out_infinite_reverse]" />
      </div>



      <div className="section-container relative z-10 py-24 md:py-32">
        <div className="flex flex-col items-center text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full text-primary-foreground/90 text-sm font-medium mb-8 animate-fade-in">
            Trusted by 500+ Business Owners & Investors
          </div>

          {/* Main Headline */}
          <h1 className="text-primary-foreground mb-10 animate-fade-in-up text-5xl md:text-6xl lg:text-7xl">
            <span className="block">Commercial Financing</span>
            <span className="text-primary-foreground">
              for{" "}
              <span className={`inline-block transition-all duration-500 text-accent underline decoration-accent underline-offset-8 ${isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                {rotatingWords[currentIndex]}
              </span>
            </span>
          </h1>

          {/* Video + Map Grid */}
          <div className="w-full max-w-7xl mb-12 animate-fade-in-up animation-delay-100">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Video */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/20">
                <iframe src="https://www.youtube.com/embed/z11ValptvRA?start=1" title="Commercial Lending X Overview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 w-full h-full" />
              </div>
              
              {/* Deal Pulse Map */}
              <div className="hidden lg:block aspect-video">
                <DealPulseMap />
              </div>
            </div>
          </div>

          {/* Subheadline */}
          <p className="text-2xl md:text-3xl text-primary-foreground/80 mb-10 max-w-3xl leading-relaxed animate-fade-in-up animation-delay-100">
            Navigate complex commercial financing with confidence. Access hundreds of 
            lending partners including banks, SBA, and alternative lenders with our success-based 
            fee model.
          </p>

          {/* Highlights */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-10">
            <div className="flex items-center gap-2 text-primary-foreground/90 opacity-0 animate-fade-in-up animation-delay-200 px-4 py-2 bg-primary-foreground/5 rounded-full">
              <span className="font-medium">300+ Lending Partners</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/90 opacity-0 animate-fade-in-up animation-delay-300 px-4 py-2 bg-primary-foreground/5 rounded-full">
              <span className="font-medium">No Upfront Fees</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/90 opacity-0 animate-fade-in-up animation-delay-400 px-4 py-2 bg-primary-foreground/5 rounded-full">
              <span className="font-medium">Success-Based Model</span>
            </div>
          </div>

          {/* CTA */}
          <div className="animate-fade-in-up animation-delay-300">
            <Button variant="hero" size="xl" className="group" onClick={() => {
            // @ts-ignore - Calendly is loaded via script
            window.Calendly?.initPopupWidget({
              url: 'https://calendly.com/adam-fridman/30min'
            });
          }}>
              Talk to Brad
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-primary-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 rounded-full bg-primary-foreground/50 animate-pulse" />
        </div>
      </div>
    </section>;
};
export default HeroSection;