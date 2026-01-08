const AudiencePathways = () => {
  const steps = [
    { step: 1, title: "Initial Consult", duration: "" },
    { step: 2, title: "Onboarding", duration: "24-48 hours" },
    { step: 3, title: "In-House Underwriting", duration: "24-48 hours" },
    { step: 4, title: "Lender Management", duration: "Terms 5-10 days" },
    { step: 5, title: "Path to Closing", duration: "1-4+ weeks" },
    { step: 6, title: "Closed", duration: "" },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="section-container">
        {/* Section Header with Blue Background */}
        <div className="bg-primary rounded-2xl p-12 md:p-16 text-center mb-16">
          <h2 className="text-primary-foreground mb-4">The CLX Way</h2>
          <p className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto">
            Proven Process To Navigate The Commercial Lending Journey
          </p>
        </div>

        {/* Process Steps */}
        <div className="flex flex-col md:flex-row items-stretch justify-center overflow-x-auto pb-4">
          {steps.map((step, index) => (
            <div key={step.step} className="flex items-center">
              {/* Step Card */}
              <div className="relative flex flex-col items-center min-w-[140px] md:min-w-[160px]">
                {/* Step Label */}
                <span className="text-sm font-semibold text-primary mb-3">
                  Step {step.step}
                </span>
                
                {/* Arrow Shape */}
                <div 
                  className={`relative flex items-center justify-center px-6 py-6 bg-primary text-primary-foreground min-h-[100px] w-full ${
                    index === 0 
                      ? "rounded-l-lg" 
                      : index === steps.length - 1 
                      ? "clip-path-arrow-end" 
                      : "clip-path-arrow-middle"
                  }`}
                  style={{
                    clipPath: index === 0 
                      ? "polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%)"
                      : index === steps.length - 1 
                      ? "polygon(15px 0, 100% 0, 100% 100%, 15px 100%, 0 50%)"
                      : "polygon(15px 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 15px 100%, 0 50%)"
                  }}
                >
                  <div className="text-center px-2">
                    <p className="font-semibold text-sm md:text-base leading-tight">
                      {step.title}
                    </p>
                    {step.duration && (
                      <p className="text-xs text-primary-foreground/70 mt-1">
                        {step.duration}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudiencePathways;