import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Briefcase,
  Building,
  DollarSign,
  FileText,
} from "lucide-react";

const BusinessAcquisition = () => {
  const isThisYou = [
    "Buying an existing business and need acquisition financing",
    "Looking to refinance your current business loan for better terms",
    "Need capital for partner buyout or ownership transition",
    "Want to expand through acquisition of a competitor",
    "First time buyer searching for the right financing structure",
  ];

  const products = [
    {
      title: "SBA 7(a) Loans",
      description:
        "The most versatile SBA program. Ideal for business acquisitions up to $5M with as little as 10% down.",
      highlights: ["Up to $5M", "10 to 25 year terms", "10% minimum down"],
    },
    {
      title: "SBA 504 Loans",
      description:
        "Best for deals with significant real estate or equipment. Lower down payment and fixed rates.",
      highlights: ["Fixed rates", "As low as 10% down", "Real estate + equipment"],
    },
    {
      title: "Conventional Bank Loans",
      description:
        "For stronger credits or larger deals. Often faster process with more flexible terms.",
      highlights: ["Larger amounts", "Flexible structure", "Relationship pricing"],
    },
    {
      title: "Seller Financing",
      description:
        "Often combined with bank financing to reduce equity requirements and bridge gaps.",
      highlights: ["Reduces cash needed", "Shows seller confidence", "Flexible terms"],
    },
  ];

  const caseStudies = [
    {
      amount: "$4.2M",
      type: "SBA 7(a)",
      industry: "Manufacturing",
      summary:
        "First time buyer acquired established metal fabrication company. Structured 10% injection with working capital for immediate equipment upgrades.",
    },
    {
      amount: "$2.8M",
      type: "SBA 7(a) + Seller Note",
      industry: "Professional Services",
      summary:
        "Management buyout of accounting practice. Combined SBA financing with seller note to minimize buyer's cash at close.",
    },
    {
      amount: "$1.5M",
      type: "Conventional",
      industry: "Distribution",
      summary:
        "Acquisition of regional distributor. Quick close conventional financing due to strong buyer credit profile.",
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
                <Briefcase className="w-4 h-4" />
                Business Acquisition & SBA Loans
              </div>
              <h1 className="text-primary-foreground mb-6">
                Finance Your Business Acquisition with Confidence
              </h1>
              <p className="text-xl text-primary-foreground/80 leading-relaxed mb-8">
                Whether you're a first time buyer or serial entrepreneur, we navigate 
                the complexities of acquisition financing to find the right structure 
                for your deal.
              </p>
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Discuss Your Deal
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
                    <DollarSign className="w-5 h-5 text-accent" />
                    Minimize cash at close
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent" />
                    Navigate SBA requirements
                  </li>
                  <li className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-accent" />
                    Include working capital in your deal
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
                We match your deal with the right financing structure from our network 
                of 300+ lending partners.
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
            <h2 className="text-center mb-12">Recent Acquisitions We've Financed</h2>
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
              See If Your Deal Fits
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Share your acquisition details and we'll provide a preliminary assessment 
              of financing options and next steps.
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

export default BusinessAcquisition;
