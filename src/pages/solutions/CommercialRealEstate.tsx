import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  Hammer,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const CommercialRealEstate = () => {
  const isThisYou = [
    "Acquiring income producing commercial property",
    "Developing or constructing a new commercial project",
    "Refinancing existing CRE debt for better terms",
    "Bridge financing for transitional properties",
    "Owner occupied real estate for your business",
  ];

  const products = [
    {
      title: "Conventional CRE Loans",
      description:
        "Traditional bank financing for stabilized properties with competitive rates and flexible terms.",
      highlights: ["Competitive rates", "Various terms", "Full amortization"],
    },
    {
      title: "SBA 504 Loans",
      description:
        "Ideal for owner occupied properties. Low down payment, long terms, and fixed rates on the CDC portion.",
      highlights: ["10% down", "25 year terms", "Fixed rates"],
    },
    {
      title: "Bridge & Construction",
      description:
        "Short term financing for acquisition, renovation, or ground up construction projects.",
      highlights: ["Quick close", "Interest only", "Flexible terms"],
    },
    {
      title: "CMBS & Life Company",
      description:
        "Non recourse options for larger stabilized properties with predictable cash flows.",
      highlights: ["Non recourse", "Larger amounts", "Long terms"],
    },
  ];

  const caseStudies = [
    {
      amount: "$8.5M",
      type: "Bridge Loan",
      property: "Mixed Use Development",
      summary:
        "Acquisition and repositioning of downtown mixed use property. 18 month bridge with permanent takeout commitment from regional bank.",
    },
    {
      amount: "$12.8M",
      type: "CMBS",
      property: "Limited Service Hotel",
      summary:
        "Refinance of 120 room hotel. CMBS execution provided best terms for stabilized asset with non recourse structure.",
    },
    {
      amount: "$6.2M",
      type: "SBA 504",
      property: "Industrial Distribution",
      summary:
        "Owner user acquisition of distribution warehouse with cold storage. 504 structure maximized leverage with 10% down.",
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
                <Building2 className="w-4 h-4" />
                Commercial Real Estate & Construction
              </div>
              <h1 className="text-primary-foreground mb-6">
                Navigate Complex CRE Financing with Precision
              </h1>
              <p className="text-xl text-primary-foreground/80 leading-relaxed mb-8">
                From acquisition to construction to refinance—we structure commercial 
                real estate financing that aligns with your investment strategy and 
                timeline.
              </p>
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Discuss Your Property
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
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Optimize leverage and returns
                  </li>
                  <li className="flex items-center gap-2">
                    <Hammer className="w-5 h-5 text-accent" />
                    Structure construction draws
                  </li>
                  <li className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-accent" />
                    Plan exit strategies
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
                We match your property with the right capital from banks, credit unions, 
                CMBS, life companies, and private lenders.
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
            <h2 className="text-center mb-12">Recent CRE Deals</h2>
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
                    {study.property}
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
              Let's Discuss Your Property
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Share your CRE project details and we'll provide a preliminary assessment 
              of financing options and structure.
            </p>
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Start the Conversation
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

export default CommercialRealEstate;
