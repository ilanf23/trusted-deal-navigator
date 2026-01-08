import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, ArrowRight, CheckCircle2, Target } from "lucide-react";

const AudiencePathways = () => {
  const [isInitialConsultOpen, setIsInitialConsultOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isUnderwritingOpen, setIsUnderwritingOpen] = useState(false);
  const [isLenderManagementOpen, setIsLenderManagementOpen] = useState(false);
  const [isPathToClosingOpen, setIsPathToClosingOpen] = useState(false);

  const steps = [
    { step: 1, title: "Initial Consult", duration: "", icon: "📞", hasPopup: true },
    { step: 2, title: "Onboarding", duration: "24-48 hours", icon: "📋", hasPopup: true },
    { step: 3, title: "In-House Underwriting", duration: "24-48 hours", icon: "🔍", hasPopup: true },
    { step: 4, title: "Lender Management", duration: "5-10 days", icon: "🤝", hasPopup: true },
    { step: 5, title: "Path to Closing", duration: "1-4+ weeks", icon: "📈", hasPopup: true },
    { step: 6, title: "Closed", duration: "", icon: "🎉", hasPopup: false },
  ];

  const handleStepClick = (step: number) => {
    if (step === 1) {
      setIsInitialConsultOpen(true);
    } else if (step === 2) {
      setIsOnboardingOpen(true);
    } else if (step === 3) {
      setIsUnderwritingOpen(true);
    } else if (step === 4) {
      setIsLenderManagementOpen(true);
    } else if (step === 5) {
      setIsPathToClosingOpen(true);
    }
  };

  return (
    <section className="py-24 bg-gradient-to-br from-muted/20 via-background to-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-6">
            <CheckCircle2 className="w-4 h-4" />
            Our Proven Process
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
            The CLX Way
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Navigate the commercial lending journey with confidence
          </p>
        </div>

        {/* Modern Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {steps.map((step, index) => (
            <div
              key={step.step}
              onClick={() => handleStepClick(step.step)}
              className={`group relative p-6 rounded-2xl transition-all duration-500 ${
                step.hasPopup ? 'cursor-pointer' : ''
              } ${
                index === 0 
                  ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1' 
                  : index === steps.length - 1
                  ? 'bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-xl shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 hover:-translate-y-1'
                  : 'bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 backdrop-blur-sm'
              }`}
            >
              {/* Step number badge */}
              <div className={`absolute -top-3 -left-3 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg ${
                index === 0 || index === steps.length - 1
                  ? 'bg-white text-primary'
                  : 'bg-primary text-primary-foreground'
              }`}>
                {step.step}
              </div>

              {/* Content */}
              <div className="pt-4">
                <span className="text-4xl mb-4 block">{step.icon}</span>
                <h3 className={`text-xl font-bold mb-2 ${
                  index === 0 || index === steps.length - 1 
                    ? '' 
                    : 'text-foreground'
                }`}>
                  {step.title}
                </h3>
                {step.duration && (
                  <p className={`text-sm ${
                    index === 0 || index === steps.length - 1 
                      ? 'opacity-80' 
                      : 'text-muted-foreground'
                  }`}>
                    Timeline: {step.duration}
                  </p>
                )}
                
                {/* Click indicator for popup */}
                {step.hasPopup && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium opacity-90 group-hover:opacity-100">
                    <Play className="w-4 h-4" />
                    Watch video
                  </div>
                )}
              </div>

              {/* Hover arrow for non-last items */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <ArrowRight className={`w-6 h-6 ${
                    index === 0 ? 'text-primary' : 'text-muted-foreground/50'
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div className="hidden md:flex items-center justify-center gap-2 mb-12">
          {steps.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${
                index === 0 ? 'bg-primary' : index === steps.length - 1 ? 'bg-accent' : 'bg-muted-foreground/30'
              }`} />
              {index < steps.length - 1 && (
                <div className="w-12 h-0.5 bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/10" />
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <button 
            onClick={() => {
              // @ts-ignore
              window.Calendly?.initPopupWidget({
                url: 'https://calendly.com/adam-fridman/30min'
              });
            }}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            Talk to Brad
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Initial Consult Popup */}
      <Dialog open={isInitialConsultOpen} onOpenChange={setIsInitialConsultOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
                  <span className="text-3xl">📞</span>
                  Step 1: Initial Consult
                </DialogTitle>
              </DialogHeader>
              
              {/* 1. Video */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mt-6">
                <iframe 
                  src="https://www.youtube.com/embed/ZnUo6vRzvOU?si=OyhhS0qyrMMRLvhN" 
                  title="Initial Consult - The CLX Way" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen 
                  className="absolute inset-0 w-full h-full" 
                />
              </div>
              
              {/* 2. Goals */}
              <div className="mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  Goals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["Are we a fit", "Outline the Process", "Needs List"].map((goal, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 3. Description */}
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">About This Step</h3>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  Welcome to Commercial Lending X and Step 1 of The CLX Way, the Initial Consult. We will assess if we're the right fit for your lending needs and educate you on the commercial lending landscape. This step focuses on your proactive engagement, inviting feedback and questions as we outline the tailored roadmap ahead. We'll also provide a clear list of initial requirements to kickstart your lending journey, ensuring a seamless and informed partnership towards financial success.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="flex justify-center mt-10 pb-4">
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
                  Talk to Brad
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Onboarding Popup */}
      <Dialog open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
                  <span className="text-3xl">📋</span>
                  Step 2: Onboarding
                </DialogTitle>
              </DialogHeader>
              
              {/* 1. Video */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mt-6">
                <iframe 
                  src="https://www.youtube.com/embed/8Os00M78vjs" 
                  title="Onboarding - The CLX Way" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen 
                  className="absolute inset-0 w-full h-full" 
                />
              </div>
              
              {/* 2. Goals */}
              <div className="mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  Goals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["Document Review", "Deal Structure", "Pre-Qualification"].map((goal, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 3. Description */}
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">About This Step</h3>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  Welcome to Step 2 of The CLX Way: Onboarding. In this stage, we review your documentation to ensure completeness and accuracy, while crafting a tailored deal structure to match your unique objectives. Through this process, we assess your pre-qualification status, laying the groundwork for our next phase of rigorous in-house underwriting. This step is all about setting the stage for success, ensuring every detail is finely tuned for your financial journey with us.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="flex justify-center mt-10 pb-4">
                <button 
                  onClick={() => {
                    setIsOnboardingOpen(false);
                    // @ts-ignore
                    window.Calendly?.initPopupWidget({
                      url: 'https://calendly.com/adam-fridman/30min'
                    });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg"
                >
                  Talk to Brad
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* In-House Underwriting Popup */}
      <Dialog open={isUnderwritingOpen} onOpenChange={setIsUnderwritingOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
                  <span className="text-3xl">🔍</span>
                  Step 3: In-House Underwriting
                </DialogTitle>
              </DialogHeader>
              
              {/* 1. Video */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mt-6">
                <iframe 
                  src="https://www.youtube.com/embed/vGI61GN9AJ8" 
                  title="In-House Underwriting - The CLX Way" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen 
                  className="absolute inset-0 w-full h-full" 
                />
              </div>
              
              {/* 2. Goals */}
              <div className="mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  Goals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["Underwriting", "Mitigate Concerns", "Loan Packaging"].map((goal, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 3. Description */}
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">About This Step</h3>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  Welcome to Step 3 of The CLX Way: In-House Underwriting. This pivotal stage is where we delve into the heart of your loan request, conducting a thorough internal underwriting process. Our expert team works diligently to mitigate any potential concerns that may arise with lenders, ensuring a seamless and successful application process. During this phase, we carefully package your loan proposal, tailoring it to match the specific requirements of lenders who are the best fit for your request so that we secure the ideal lending solution for you as we navigate the complexities of the lending landscape together.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="flex justify-center mt-10 pb-4">
                <button 
                  onClick={() => {
                    setIsUnderwritingOpen(false);
                    // @ts-ignore
                    window.Calendly?.initPopupWidget({
                      url: 'https://calendly.com/adam-fridman/30min'
                    });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg"
                >
                  Talk to Brad
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Lender Management Popup */}
      <Dialog open={isLenderManagementOpen} onOpenChange={setIsLenderManagementOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
                  <span className="text-3xl">🤝</span>
                  Step 4: Lender Management
                </DialogTitle>
              </DialogHeader>
              
              {/* 1. Video */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mt-6">
                <iframe 
                  src="https://www.youtube.com/embed/n9RQSPsZWD8" 
                  title="Lender Management - The CLX Way" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen 
                  className="absolute inset-0 w-full h-full" 
                />
              </div>
              
              {/* 2. Goals */}
              <div className="mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  Goals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["Terms", "Underwriting", "Commitment"].map((goal, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 3. Description */}
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">About This Step</h3>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  Welcome to Step 4 of The CLX Way: Lender Management. In this video we will guide you through our lender management process that begins with thorough lender sourcing, identifying those best suited to your unique needs. We then work tirelessly to obtain term sheets, carefully navigating the intricacies of lender underwriting. Finally, we guide you through the process of securing a lender commitment, ensuring every step is optimized for your success. Join us as we navigate the path to your ideal lending solution, driven by The CLX Way.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="flex justify-center mt-10 pb-4">
                <button 
                  onClick={() => {
                    setIsLenderManagementOpen(false);
                    // @ts-ignore
                    window.Calendly?.initPopupWidget({
                      url: 'https://calendly.com/adam-fridman/30min'
                    });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg"
                >
                  Talk to Brad
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Path to Closing Popup */}
      <Dialog open={isPathToClosingOpen} onOpenChange={setIsPathToClosingOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-3xl flex items-center gap-3">
                  <span className="text-3xl">📈</span>
                  Step 5: Path to Closing
                </DialogTitle>
              </DialogHeader>
              
              {/* 1. Video */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mt-6">
                <iframe 
                  src="https://www.youtube.com/embed/VmtnExaPjls" 
                  title="Path to Closing - The CLX Way" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen 
                  className="absolute inset-0 w-full h-full" 
                />
              </div>
              
              {/* 2. Goals */}
              <div className="mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  Goals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["Expectations", "Checklist", "Third Party Reports"].map((goal, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 3. Description */}
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">About This Step</h3>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  Welcome to Step 5 of The CLX Way: Path to Close. In this video we'll explore in depth how we get to closing, including setting clear expectations for the final stretch of your lending journey. Our focus turns to the completion of the closing checklist, ensuring every detail is in place as we navigate the sometimes bumpy path to close. Additionally, we guide you through the process of obtaining necessary third-party reports, providing transparency and clarity every step of the way.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="flex justify-center mt-10 pb-4">
                <button 
                  onClick={() => {
                    setIsPathToClosingOpen(false);
                    // @ts-ignore
                    window.Calendly?.initPopupWidget({
                      url: 'https://calendly.com/adam-fridman/30min'
                    });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all duration-300 shadow-lg"
                >
                  Talk to Brad
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AudiencePathways;