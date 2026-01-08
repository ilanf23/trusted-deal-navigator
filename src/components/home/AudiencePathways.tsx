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
      {/* Section Header with Blue Background - Full Width */}
      <div className="bg-primary p-12 md:p-16 text-center mb-16">
        <h2 className="text-primary-foreground mb-4">The CLX Way</h2>
        <p className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto">
          Proven Process To Navigate The Commercial Lending Journey
        </p>
      </div>

      {/* Process Steps - Full Width */}
      <div className="w-full px-4 md:px-8 lg:px-12">
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-0 w-full">
          {steps.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center flex-1">
              {/* Step Label */}
              <span className="text-sm font-semibold text-primary mb-3">
                Step {step.step}
              </span>
              
              {/* Arrow Shape with SVG */}
              <div className="relative h-20 md:h-24 w-full">
                <svg 
                  viewBox="0 0 160 70" 
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  {/* First step - solid fill */}
                  {index === 0 && (
                    <path
                      d="M0 0 L135 0 L160 35 L135 70 L0 70 Z"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Middle steps - outline, rectangle with arrow right */}
                  {index > 0 && index < steps.length - 1 && (
                    <path
                      d="M0 0 L135 0 L160 35 L135 70 L0 70 Z"
                      fill="white"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Last step - solid fill */}
                  {index === steps.length - 1 && (
                    <path
                      d="M0 0 L135 0 L160 35 L135 70 L0 70 Z"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Text */}
                  <text
                    x="70"
                    y={step.duration ? "28" : "38"}
                    textAnchor="middle"
                    className="text-sm font-semibold"
                    fill={index === 0 || index === steps.length - 1 ? "white" : "hsl(var(--primary))"}
                    style={{ fontSize: '11px', fontWeight: 600 }}
                  >
                    {step.title}
                  </text>
                  {step.duration && (
                    <text
                      x="70"
                      y="48"
                      textAnchor="middle"
                      fill={index === 0 || index === steps.length - 1 ? "rgba(255,255,255,0.7)" : "hsl(var(--muted-foreground))"}
                      style={{ fontSize: '9px' }}
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