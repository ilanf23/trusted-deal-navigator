import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Wallet,
  Truck,
  CreditCard,
  RefreshCw,
} from "lucide-react";

const WorkingCapital = () => {
  const isThisYou = [
    "Need cash flow to fund growth or seasonal inventory",
    "Looking for a revolving line of credit",
    "Financing equipment purchases or fleet expansion",
    "Managing receivables and payables timing gaps",
    "Building working capital reserves for opportunities",
  ];

  const products = [
    {
      title: "Business Lines of Credit",
      description:
        "Revolving credit facilities that give you flexibility to draw funds as needed and repay over time.",
      highlights: ["Revolving", "Pay only for what you use", "Quick access"],
    },
    {
      title: "Equipment Financing",
      description:
        "Finance equipment purchases with terms matched to useful life. Keep cash for operations.",
      highlights: ["Up to 100% financing", "Fixed payments", "Preserve cash"],
    },
    {
      title: "Asset Based Lending",
      description:
        "Leverage your receivables, inventory, or equipment to access larger credit facilities.",
      highlights: ["Higher availability", "Grow with sales", "Flexible structure"],
    },
    {
      title: "Term Loans",
      description:
        "Fixed term financing for specific purposes with predictable payment schedules.",
      highlights: ["Predictable payments", "Various terms", "Multiple uses"],
    },
  ];

  const caseStudies = [
    {
      amount: "$3.5M",
      type: "Asset Based",
      industry: "Logistics",
      summary:
        "Fleet expansion financing secured by trucks and receivables. Closed in 90 days to meet contract deadline for major new customer.",
    },
    {
      amount: "$1.2M",
      type: "Equipment Finance",
      industry: "Manufacturing",
      summary:
        "CNC equipment upgrade financing. 7 year term with seasonal payment structure to match business cash flow patterns.",
    },
    {
      amount: "$2.0M",
      type: "Business LOC",
      industry: "Wholesale Distribution",
      summary:
        "Revolving credit facility for inventory and receivables management. Formula based availability grows with sales.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 hero-gradient">
          <div className="section-container">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full text-primary-foreground/90 text-sm font-medium mb-6">
                <Wallet className="w-4 h-4" />
                Working Capital, LOC & Equipment
              </div>
              <h1 className="text-primary-foreground mb-6">
                Fuel Growth with the Right Working Capital
              </h1>
              <p className="text-xl text-primary-foreground/80 leading-relaxed mb-8">
                From lines of credit to equipment financing—we help you access the 
                capital you need to run and grow your business.
              </p>
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Discuss Your Needs
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Is This You? */}
        <section className="py-24">
          <div className="section-container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="mb-6">Is This You?</h2>
                <ul className="space-y-4">
                  {isThisYou.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-highlight flex-shrink-0 mt-1" />
                      <span className="text-lg text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted rounded-2xl p-8">
                <h3 className="mb-4">We Help You:</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-accent" />
                    Match facility to your cash flow
                  </li>
                  <li className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-accent" />
                    Finance equipment strategically
                  </li>
                  <li className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-accent" />
                    Build sustainable credit capacity
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-24 bg-muted">
          <div className="section-container">
            <div className="text-center mb-16">
              <h2 className="mb-4">Financing Options</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We structure working capital solutions that match your business model 
                and growth trajectory.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {products.map((product, index) => (
                <div
                  key={index}
                  className="bg-card rounded-xl p-8 border border-border"
                >
                  <h3 className="mb-3">{product.title}</h3>
                  <p className="text-muted-foreground mb-6">{product.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {product.highlights.map((highlight, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section className="py-24">
          <div className="section-container">
            <h2 className="text-center mb-12">Recent Working Capital Solutions</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {caseStudies.map((study, index) => (
                <div
                  key={index}
                  className="bg-card rounded-xl p-6 border border-border card-hover"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-foreground">
                      {study.amount}
                    </span>
                    <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
                      {study.type}
                    </span>
                  </div>
                  <p className="text-sm text-highlight font-medium mb-3">
                    {study.industry}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {study.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 hero-gradient">
          <div className="section-container text-center">
            <h2 className="text-primary-foreground mb-6">
              Let's Discuss Your Capital Needs
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Share your working capital requirements and we'll help you find the 
              right solution.
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

export default WorkingCapital;
