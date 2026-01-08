import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  MessageSquare, 
  Search, 
  Phone, 
  FileCheck, 
  HandshakeIcon, 
  RefreshCw,
  CheckCircle2,
  Shield
} from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      icon: MessageSquare,
      title: "Share Your Deal",
      description:
        "Tell us about your financing needs—whether it's an acquisition, real estate project, or working capital. We'll gather the key details to understand your objectives.",
      details: [
        "Quick intake form or phone call",
        "Understand your timeline and goals",
        "Review preliminary financials",
      ],
    },
    {
      number: "02",
      icon: Search,
      title: "Analyze Your Options",
      description:
        "We leverage our network of 300+ lenders to identify the best financing options for your specific situation. Banks, SBA, private, and alternative lenders—all considered.",
      details: [
        "Match your deal to the right lenders",
        "Compare terms and structures",
        "Identify potential challenges early",
      ],
    },
    {
      number: "03",
      icon: Phone,
      title: "Strategy Call",
      description:
        "We walk you through the options, explain the tradeoffs, and help you choose the best path forward. No jargon, just clear advice.",
      details: [
        "Review financing options together",
        "Discuss pros and cons",
        "Create an action plan",
      ],
    },
    {
      number: "04",
      icon: FileCheck,
      title: "Underwriting & Packaging",
      description:
        "Our team prepares a comprehensive loan package that presents your deal in the best light. We handle lender communication and negotiations.",
      details: [
        "Professional credit memorandum",
        "Complete document preparation",
        "Proactive lender management",
      ],
    },
    {
      number: "05",
      icon: HandshakeIcon,
      title: "Closing Support",
      description:
        "We stay engaged through closing, coordinating with lenders, attorneys, and all parties to ensure a smooth transaction.",
      details: [
        "Manage closing timeline",
        "Resolve last minute issues",
        "Celebrate your success",
      ],
    },
    {
      number: "06",
      icon: RefreshCw,
      title: "Ongoing Partnership",
      description:
        "Your relationship with CLX doesn't end at closing. We monitor rates, refinancing opportunities, and are here for your next deal.",
      details: [
        "RateWatch Concierge monitoring",
        "Future financing planning",
        "Referral partner program",
      ],
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: "No Upfront Fees",
      description: "We only get paid when your loan closes. Our interests are fully aligned with yours.",
    },
    {
      icon: CheckCircle2,
      title: "Lender Agnostic Advice",
      description: "We're not tied to any single lender. Our job is to find the best solution for you.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-muted">
          <div className="section-container">
            <div className="max-w-3xl">
              <h1 className="mb-6">The CLX Way</h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Complex commercial financing, made simple. Our proven process guides you from 
                initial conversation to successful closing and beyond.
              </p>
            </div>
          </div>
        </section>

        {/* Process Steps */}
        <section className="py-24">
          <div className="section-container">
            <div className="space-y-16">
              {steps.map((step, index) => (
                <div 
                  key={index}
                  className="grid lg:grid-cols-12 gap-8 items-start"
                >
                  {/* Step Number */}
                  <div className="lg:col-span-2">
                    <span className="text-6xl font-bold text-primary/10">{step.number}</span>
                  </div>
                  
                  {/* Content */}
                  <div className="lg:col-span-10 grid md:grid-cols-2 gap-8">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                          <step.icon className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <h3>{step.title}</h3>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                    <div className="bg-card rounded-xl p-6 border border-border">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        What to Expect
                      </h4>
                      <ul className="space-y-3">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-highlight flex-shrink-0 mt-0.5" />
                            <span className="text-foreground">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-muted">
          <div className="section-container">
            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-card rounded-xl p-8 border border-border">
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-6">
                    <benefit.icon className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <h3 className="mb-3">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 hero-gradient">
          <div className="section-container text-center">
            <h2 className="text-primary-foreground mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Let's discuss your financing needs and find the right path forward.
            </p>
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Talk to Brad
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;
