import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const rotatingWords = [
  "Business Owners",
  "Entrepreneurs",
  "Investors",
  "Franchisees",
  "Real Estate Buyers",
];

const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-foreground/20 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-accent/20 blur-3xl" />
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
            <span className="text-accent">
              for{" "}
              <span 
                className={`inline-block transition-all duration-500 underline decoration-accent underline-offset-8 ${
                  isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
              >
                {rotatingWords[currentIndex]}
              </span>
            </span>
          </h1>

          {/* Video */}
          <div className="w-full max-w-7xl mb-12 animate-fade-in-up animation-delay-100">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/20">
              <iframe 
                src="https://www.youtube.com/embed/z11ValptvRA?start=1" 
                title="Commercial Lending X Overview" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen 
                className="absolute inset-0 w-full h-full" 
              />
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