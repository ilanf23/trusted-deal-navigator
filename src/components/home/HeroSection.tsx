import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, TrendingUp } from "lucide-react";

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
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
  return <section className="relative min-h-[90vh] flex items-center hero-gradient overflow-hidden">
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
              Commercial Financing Expertise{" "}
              <span className="text-accent">
                for{" "}
                <span 
                  className={`inline-block transition-all duration-300 ${
                    isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {rotatingWords[currentIndex]}
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
              {highlights.map((item, index) => <div key={index} className="flex items-center gap-2 text-primary-foreground/90">
                  <item.icon className="w-5 h-5 text-accent" />
                  <span className="font-medium">{item.text}</span>
                </div>)}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animation-delay-300">
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Talk to Brad
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/transactions">
                <Button variant="heroOutline" size="xl">
                  View Recent Deals
                </Button>
              </Link>
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
    </section>;
};
export default HeroSection;