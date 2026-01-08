const AudiencePathways = () => {
  const steps = [
    { step: 1, title: "Initial Consult", duration: "", icon: "📞" },
    { step: 2, title: "Onboarding", duration: "24-48 hours", icon: "📋" },
    { step: 3, title: "In-House Underwriting", duration: "24-48 hours", icon: "🔍" },
    { step: 4, title: "Lender Management", duration: "Terms 5-10 days", icon: "🤝" },
    { step: 5, title: "Path to Closing", duration: "1-4+ weeks", icon: "📈" },
    { step: 6, title: "Closed", duration: "", icon: "🎉" },
  ];

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
            <div key={step.step} className="flex flex-col items-center flex-1 w-full md:w-auto group">
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
                }`}
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
    </section>
  );
};

export default AudiencePathways;