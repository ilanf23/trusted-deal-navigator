import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, TrendingUp } from "lucide-react";

const HeroSection = () => {
  const highlights = [
    {
      icon: Users,
      text: "300+ Lending Partners",
    },
    {
      icon: Shield,
      text: "No Upfront Fees",
    },
    {
      icon: TrendingUp,
      text: "Success-Based Model",
    },
  ];

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
              Commercial Financing Expertise{" "}
              <span className="text-accent">for Real-World Deals</span>
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
                <div
                  key={index}
                  className="flex items-center gap-2 text-primary-foreground/90"
                >
                  <item.icon className="w-5 h-5 text-accent" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
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

          {/* USA Map Icon */}
          <div className="hidden lg:flex justify-center items-center animate-fade-in-up animation-delay-200">
            <svg
              viewBox="0 0 959 593"
              className="w-80 h-auto xl:w-96"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="3"
            >
              <path
                d="M158.4,494.5l-0.8,4.4l-6.2,5.5l-3.4,-0.3l-1.9,2l-3.6,-2.3l-1.6,0.8l-0.3,3.1l-4.7,1.8l-0.5,3.7l4.2,3.7l2.6,-1.6l1.8,1.8l-1.8,4.7l3.4,5.2l5.2,3.4l-0.8,5.7l3.9,2.9l-1,1.8l4.4,3.6l6.8,1.6l3.4,4.2l8.1,2.1l10.4,5.7l-1,5.2l8.6,1.3l4.2,4.2l3.4,0.5l0.8,3.1l4.7,-0.5l0.5,-2.1l3.4,-0.8l-0.5,2.9l3.9,-0.3l7.8,5.7l1.6,-2.9l6,-1.8l0.8,2.9l6.2,-0.3l4.9,-3.6l7,-0.3l-3.6,-6.2l1.8,-3.1l-1.3,-5.2l1,-1.6l-1.6,-3.6l-0.3,-8.3l4.9,-6.8l-1,-4.9l-5.2,-2.9l1.3,-4.2l-2.6,-2.6l0.5,-2.9l-2.1,-3.4l0.3,-3.1l3.4,-2.1l-0.5,-3.4l-3.6,-1l-0.5,-2.6l-2.9,-0.5l-1,-2.9l-3.6,-0.8l-1.8,1l-1.8,-2.6l-5.7,-1l-0.5,1.6l-3.9,-1.8l0.3,-2.1l-3.6,-3.4l-5.5,-0.3l-4.4,-3.6l-5.2,-0.3l-3.4,-2.1l-5.7,3.1l-1.6,-1.8l-1,-4.4l-2.1,-0.8l-4.4,0.5l-1.8,-2.9l-3.9,0.3l-2.6,1.8l-0.3,3.9l-6.5,1l-5.2,3.1l-0.5,3.4l-2.6,0.3l-0.3,3.1Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M833.8,327.1l-1.6,7l-8.1,11.9l-1.8,8.3l2.6,6l-0.3,10.1l-5.5,5.7l-0.3,5.7l1.6,2.1l-0.3,7l-6.2,17.6l-7,10.6l-6,4.9l-1.8,3.4l-10.1,5.5l-4.7,5.2l-1.3,7l-5.2,9.3l0.8,5.7l-3.4,6.5l1.8,5.5l-3.6,6l-5.7,2.6l-1.3,4.7l-7.3,5.2l-2.9,6.2l3.6,1l2.9,5.7l9.1,2.9l5.7,0.3l7.3,4.4l4.9,-0.3l3.9,2.1l6,-2.6l3.6,0.5l3.4,2.1l0.8,2.9l3.9,0.3l-0.3,2.9l3.6,-0.5l0.8,2.1l2.9,-1.6l2.1,1l2.1,-2.9l5.5,0.8l1,-2.9l3.9,1l2.1,-1l0.5,-3.4l6,-1.8l0.5,-2.9l3.1,0.8l0.8,-2.9l-2.6,-1.8l2.9,-2.9l-0.8,-2.1l2.6,-1l-1.6,-3.1l3.4,0.3l2.1,-4.7l-1,-3.6l2.6,-0.5l-0.3,-3.9l-3.1,-1.6l-0.3,-3.4l2.6,-1.3l-2.6,-4.4l2.9,-4.4l-2.1,-3.6l1.3,-3.9l3.6,-1.6l-1.3,-3.9l3.6,-6.2l-2.6,-2.6l3.4,-5.5l-1.6,-4.4l1,-3.9l-2.9,-3.9l1.6,-5.2l-3.4,-2.1l1,-3.9l-1.8,-2.1l-0.3,-6l2.9,-7l-2.9,-5.2l1.8,-2.6l-2.1,-7.3l-4.4,-2.9l-1.3,-4.4l1.8,-2.1l-1.8,-5.2l1.3,-7.6l-1,-2.9l-6,0.3l-2.9,-2.1l-7.8,0.5l-3.4,1.8Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M465.5,140.5l2.9,4.9l4.7,-0.8l3.4,4.2l4.2,-0.3l1.8,1.8l5.7,-0.8l3.6,1.6l4.4,-2.6l3.9,0.3l3.9,-3.6l2.9,1l0.5,-3.4l4.4,-2.9l-1,-4.2l2.9,-2.9l-0.5,-3.9l6,-5.5l0.3,-4.2l3.4,-1.8l-0.5,-4.4l-3.4,-0.8l0.3,-3.6l-4.2,0.8l-1.8,-3.1l-3.4,1.8l-2.6,-0.5l-0.5,-2.6l-3.4,1.3l-0.8,-3.4l-7.6,2.6l-1.6,3.1l-3.9,-0.5l-1,2.1l-6.2,0.5l-2.1,4.2l-3.1,-1l-2.6,2.6l0.3,3.6l-3.1,3.1l1,4.2l-4.9,2.1l-0.5,3.1l-4.4,1.8l1.3,4.9l4.4,-0.3l1.3,2.6l-3.1,2.6Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M581.4,168.1l5.5,-0.5l3.6,2.6l4.7,-1.8l3.4,0.8l-0.3,3.4l5.2,1.6l3.6,-2.1l2.1,2.9l4.2,-1.3l0.5,4.7l5.5,1.8l2.1,-2.6l4.4,1.6l1.3,-3.4l5.7,0.8l2.9,-2.9l4.7,1l1.8,-2.6l4.9,1l2.6,-3.4l0.3,-4.4l5.7,-2.1l1,-3.6l-2.1,-4.2l1.6,-4.4l-3.4,-3.1l0.8,-4.2l-3.9,-2.6l0.5,-3.6l-3.9,0.3l-1,-5.2l-3.6,1l-2.1,-2.1l-6.5,3.4l-1.3,-3.4l-4.7,2.6l-2.9,-1.8l-3.4,3.9l-3.6,-0.8l-1.6,3.4l-5.5,-1.3l-1,3.9l-3.9,-0.3l-2.1,3.6l-4.7,-0.8l-1.3,3.9l-3.4,-0.8l-1.6,4.2l-4.4,-0.5l-2.1,4.2l3.4,2.6l-2.9,4.2l-3.9,-0.5l0.3,5.2l-4.2,3.1l1.6,3.6Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M695.2,177.2l3.9,1.3l3.6,-2.9l5.5,1.3l3.4,-2.1l2.6,2.9l3.4,-1l2.9,3.4l5.2,-1.3l2.1,3.6l3.4,-0.5l1.6,2.6l-1.6,4.4l2.6,2.9l-0.5,4.7l3.9,2.1l-1.6,3.9l3.9,3.4l-1.8,3.1l3.6,3.6l3.4,-1.6l1.6,2.9l4.7,-0.5l0.5,-3.9l4.2,1.3l1,-4.4l-2.6,-2.6l3.6,-2.9l-0.8,-4.2l-3.4,-1.6l1.3,-3.6l-2.6,-3.6l2.1,-4.9l-3.9,-2.1l1,-4.2l-2.6,-2.6l0.8,-5.2l-4.4,-1.6l0.3,-3.9l-3.6,-2.6l1.6,-4.4l-5.2,-1l0.5,-3.9l-4.7,-2.9l-3.6,1.6l-1.3,-4.7l-5.7,2.1l-2.6,-2.1l-4.2,3.1l-3.4,-1.6l-3.1,3.9l-4.4,-0.3l-1.6,5.5l-4.2,1.3l-0.3,4.7l-4.9,0.5l-0.8,4.4l3.1,2.6l-2.6,4.4l2.9,3.4l-2.1,4.7l4.4,1.3Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M388.9,224.1l6.5,1l4.2,-2.6l5.5,0.5l1.8,-3.6l4.9,0.3l3.6,-3.4l0.3,-5.2l4.4,-1.3l1.6,-4.2l3.4,0.8l2.6,-3.1l-1.3,-4.9l3.4,-3.1l-2.9,-3.9l4.2,-3.1l-1.8,-4.4l3.1,-3.6l-3.4,-2.1l2.1,-4.2l-2.9,-2.6l0.5,-5.2l-3.9,-1.8l0.5,-3.9l-4.2,0.5l-2.9,-3.4l-4.7,2.1l-1.6,-3.4l-4.2,1.8l-3.1,-2.6l-3.9,3.1l-4.2,-1.3l-1.8,4.2l-5.2,-0.3l-2.1,3.6l-4.4,-0.8l-1.6,4.4l-4.7,-0.5l-0.3,4.7l-4.9,0.8l0.8,5.2l-3.4,2.1l2.1,4.4l-2.9,3.4l1.6,3.6l-3.9,2.1l1,4.2l-4.2,1.3l1.3,3.9l-3.4,2.6l0.8,5.5l-3.9,1l0.5,4.4l-4.4,1.6l2.6,3.4l-1.8,3.9l3.1,2.6l-0.5,4.4l4.4,-0.3l2.9,2.9l4.7,-1.6l3.4,2.1l3.9,-2.1l5.2,0.5Z"
                fill="hsl(var(--accent) / 0.1)"
              />
              <path
                d="M507.1,228.6l5.7,0.5l4.2,-3.1l4.9,1l3.1,-2.9l4.2,1.8l4.4,-2.1l2.1,3.6l4.7,-1.3l3.4,2.6l5.2,-2.1l2.6,3.1l4.9,-1.8l2.9,2.9l3.9,-2.6l3.4,1.8l0.3,-5.2l4.4,-1l-1,-4.4l3.9,-1.6l-2.1,-3.9l3.4,-2.9l-0.8,-4.7l-3.4,-1.3l1.3,-3.9l-3.6,-2.6l1.6,-4.2l-4.4,-1l0.3,-4.2l-3.6,-2.1l0.8,-3.9l-4.9,-1.6l-1,-4.4l-3.4,0.5l-2.9,-3.4l-4.4,1.8l-2.1,-2.9l-4.9,2.6l-3.4,-1.6l-3.4,3.4l-5.2,-0.8l-2.1,4.2l-4.7,-0.5l-0.8,4.4l-4.4,0.3l-1.3,3.9l-4.2,0.5l-1.6,4.4l-3.6,-0.5l-2.6,4.2l3.4,3.4l-2.1,3.9l3.1,2.6l-1.8,4.4l2.9,3.4l-3.4,2.9l2.1,3.6l-3.1,3.4l3.9,2.1l-1.6,4.2l4.4,1.3Z"
                fill="hsl(var(--accent) / 0.1)"
              />
            </svg>
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
