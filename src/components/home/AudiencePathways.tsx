import { Link } from "react-router-dom";
import { ArrowRight, Building2, Briefcase, Building } from "lucide-react";

const AudiencePathways = () => {
  const pathways = [
    {
      icon: Briefcase,
      title: "Business Owners",
      description:
        "Buying, refinancing, or expanding your business? Get access to SBA loans, conventional financing, and creative capital solutions.",
      link: "/solutions/business-acquisition",
      linkText: "Explore Business Financing",
      color: "from-primary to-primary/80",
    },
    {
      icon: Building2,
      title: "Real Estate Investors",
      description:
        "Financing acquisition, construction, or refinancing of commercial properties? We navigate complex CRE deals with precision.",
      link: "/solutions/commercial-real-estate",
      linkText: "Explore CRE Financing",
      color: "from-highlight to-highlight/80",
    },
    {
      icon: Building,
      title: "Banks & Partners",
      description:
        "Need outsourced underwriting or credit support? Partner with us for overflow capacity and specialized credit services.",
      link: "/bank-services",
      linkText: "Partner With CLX",
      color: "from-accent to-accent/80",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="mb-4">How Can We Help You?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're acquiring a business, investing in real estate, or need 
            credit support—we have the expertise to guide you.
          </p>
        </div>

        {/* Pathway Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {pathways.map((pathway, index) => (
            <Link
              key={index}
              to={pathway.link}
              className="group relative bg-card rounded-2xl p-8 card-hover border border-border overflow-hidden"
            >
              {/* Gradient Accent */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${pathway.color}`}
              />

              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${pathway.color} flex items-center justify-center mb-6`}
              >
                <pathway.icon className="w-7 h-7 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                {pathway.title}
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {pathway.description}
              </p>

              {/* Link */}
              <div className="flex items-center gap-2 text-primary font-medium">
                <span>{pathway.linkText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudiencePathways;
