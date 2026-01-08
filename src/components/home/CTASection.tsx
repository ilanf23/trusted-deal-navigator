import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 hero-gradient relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-primary-foreground/20 blur-3xl" />
      </div>

      <div className="section-container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-primary-foreground mb-6">
            Ready to Discuss Your Financing Needs?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-10 leading-relaxed">
            Whether you're acquiring a business, investing in commercial real estate, 
            or need credit support—let's find the right solution together. 
            No upfront fees, no pressure.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Talk to a Financing Expert
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="tel:+15551234567">
              <Button variant="heroOutline" size="xl" className="group">
                <Phone className="w-5 h-5" />
                (555) 123-4567
              </Button>
            </a>
          </div>

          <p className="text-primary-foreground/60 text-sm mt-8">
            Typically respond within 24 hours • Confidential consultation
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
