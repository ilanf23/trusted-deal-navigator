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
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-0 overflow-x-auto pb-4">
          {steps.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center">
              {/* Step Label */}
              <span className="text-sm font-semibold text-primary mb-3">
                Step {step.step}
              </span>
              
              {/* Arrow Shape with SVG */}
              <div className="relative h-24 md:h-28">
                <svg 
                  viewBox="0 0 180 80" 
                  className="h-full w-auto"
                  style={{ minWidth: '150px' }}
                >
                  {/* First step - solid fill, arrow end only */}
                  {index === 0 && (
                    <path
                      d="M0 0 L155 0 L180 40 L155 80 L0 80 Z"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Middle steps - outline with arrow on both sides */}
                  {index > 0 && index < steps.length - 1 && (
                    <path
                      d="M25 0 L155 0 L180 40 L155 80 L25 80 L0 40 Z"
                      fill="white"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Last step - solid fill, arrow start only */}
                  {index === steps.length - 1 && (
                    <path
                      d="M25 0 L180 0 L180 80 L25 80 L0 40 Z"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Text */}
                  <text
                    x="90"
                    y={step.duration ? "35" : "42"}
                    textAnchor="middle"
                    className="text-sm font-semibold"
                    fill={index === 0 || index === steps.length - 1 ? "white" : "hsl(var(--primary))"}
                    style={{ fontSize: '13px', fontWeight: 600 }}
                  >
                    {step.title}
                  </text>
                  {step.duration && (
                    <text
                      x="90"
                      y="55"
                      textAnchor="middle"
                      fill={index === 0 || index === steps.length - 1 ? "rgba(255,255,255,0.7)" : "hsl(var(--muted-foreground))"}
                      style={{ fontSize: '11px' }}
                    >
                      {step.duration}
                    </text>
                  )}
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudiencePathways;