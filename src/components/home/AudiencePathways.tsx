import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X } from "lucide-react";

const AudiencePathways = () => {
  const [isInitialConsultOpen, setIsInitialConsultOpen] = useState(false);

  const steps = [
    { step: 1, title: "Initial Consult", duration: "", icon: "📞", hasPopup: true },
    { step: 2, title: "Onboarding", duration: "24-48 hours", icon: "📋", hasPopup: false },
    { step: 3, title: "In-House Underwriting", duration: "24-48 hours", icon: "🔍", hasPopup: false },
    { step: 4, title: "Lender Management", duration: "Terms 5-10 days", icon: "🤝", hasPopup: false },
    { step: 5, title: "Path to Closing", duration: "1-4+ weeks", icon: "📈", hasPopup: false },
    { step: 6, title: "Closed", duration: "", icon: "🎉", hasPopup: false },
  ];

  const handleStepClick = (step: number) => {
    if (step === 1) {
      setIsInitialConsultOpen(true);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30">
      {/* Section Header with Blue Background */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/90 p-12 md:p-20 text-center mb-16">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-40 h-40 bg-accent/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-60 h-60 bg-primary-foreground/5 rounded-full translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-accent/5 rounded-full" />
        
        <div className="relative z-10">
          <span className="inline-block px-4 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium mb-4">
            Our Process
          </span>
          <h2 className="text-primary-foreground mb-4 text-4xl md:text-5xl lg:text-6xl">The CLX Way</h2>
          <p className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed">
            Proven Process To Navigate The Commercial Lending Journey
          </p>
        </div>
      </div>

      {/* Process Steps */}
      <div className="w-full px-4 md:px-8 lg:px-16 xl:px-24">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-0 w-full max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={step.step} 
              className={`flex flex-col items-center flex-1 w-full md:w-auto group ${step.hasPopup ? 'cursor-pointer' : ''}`}
              onClick={() => handleStepClick(step.step)}
            >
              {/* Step Label */}
              <span className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                Step {step.step}
              </span>
              
              {/* Arrow Card */}
              <div 
                className={`relative w-full md:min-w-[140px] lg:min-w-[180px] h-24 md:h-28 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:z-10 ${
                  index === 0 || index === steps.length - 1 
                    ? 'bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20' 
                    : 'bg-card border-2 border-primary/20 hover:border-primary/40 shadow-md hover:shadow-lg'
                } ${step.hasPopup ? 'ring-2 ring-accent/50 ring-offset-2' : ''}`}
                style={{
                  clipPath: index === 0 
                    ? 'polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 0 100%)'
                    : index === steps.length - 1
                    ? 'polygon(20px 0, 100% 0, 100% 100%, 20px 100%, 0 50%)'
                    : 'polygon(20px 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 20px 100%, 0 50%)'
                }}
              >
                <div className="text-center px-6">
                  <span className="text-2xl mb-1 block">{step.icon}</span>
                  <p className={`font-semibold text-sm md:text-base leading-tight ${
                    index === 0 || index === steps.length - 1 
                      ? 'text-primary-foreground' 
                      : 'text-foreground'
                  }`}>
                    {step.title}
                  </p>
                  {step.duration && (
                    <p className={`text-xs mt-1 ${
                      index === 0 || index === steps.length - 1 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {step.duration}
                    </p>
                  )}
                  {step.hasPopup && (
                    <span className="text-xs text-accent mt-1 block">Click to learn more</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Ready to start your journey?</p>
          <button 
            onClick={() => {
              // @ts-ignore
              window.Calendly?.initPopupWidget({
                url: 'https://calendly.com/adam-fridman/30min'
              });
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
          >
            Start With Step 1
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Initial Consult Popup */}
      <Dialog open={isInitialConsultOpen} onOpenChange={setIsInitialConsultOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
              <span className="text-3xl">📞</span>
              Step 1: Initial Consult
            </DialogTitle>
          </DialogHeader>
          
          {/* Video */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg my-4">
            <iframe 
              src="https://www.youtube.com/embed/ZnUo6vRzvOU?si=OyhhS0qyrMMRLvhN" 
              title="Initial Consult - The CLX Way" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen 
              className="absolute inset-0 w-full h-full" 
            />
          </div>
          
          {/* Description */}
          <DialogDescription className="text-base md:text-lg leading-relaxed text-foreground/80">
            Welcome to Commercial Lending X and Step 1 of The CLX Way, the Initial Consult. We will assess if we're the right fit for your lending needs and educate you on the commercial lending landscape. This step focuses on your proactive engagement, inviting feedback and questions as we outline the tailored roadmap ahead. We'll also provide a clear list of initial requirements to kickstart your lending journey, ensuring a seamless and informed partnership towards financial success.
          </DialogDescription>
          
          {/* CTA Button */}
          <div className="flex justify-center mt-6">
            <button 
              onClick={() => {
                setIsInitialConsultOpen(false);
                // @ts-ignore
                window.Calendly?.initPopupWidget({
                  url: 'https://calendly.com/adam-fridman/30min'
                });
              }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg"
            >
              Schedule Your Initial Consult
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AudiencePathways;