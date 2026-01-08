import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  Calculator,
  Clock,
  Shield,
  Users,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

const BankServices = () => {
  const services = [
    {
      icon: FileText,
      title: "Credit Memorandums",
      description:
        "Comprehensive credit analysis and memo preparation meeting your institution's standards and format requirements.",
    },
    {
      icon: Calculator,
      title: "Financial Spreading",
      description:
        "Accurate spreading of financial statements, tax returns, and interim financials with detailed ratio analysis.",
    },
    {
      icon: TrendingUp,
      title: "Stress Testing",
      description:
        "Scenario analysis and sensitivity testing to evaluate loan performance under various economic conditions.",
    },
    {
      icon: Clock,
      title: "Overflow Support",
      description:
        "Flexible capacity to handle volume spikes, special projects, or temporary staffing gaps in your credit team.",
    },
  ];

  const benefits = [
    "Experienced commercial credit analysts",
    "Quick turnaround times",
    "Consistent quality and formatting",
    "Confidential handling of sensitive data",
    "Scalable capacity as needed",
    "Direct communication with analysts",
  ];

  const testimonials = [
    {
      quote:
        "CLX has become an extension of our credit team. Their work quality matches our internal standards and they understand our credit culture.",
      author: "Chief Credit Officer",
      company: "Regional Community Bank",
    },
    {
      quote:
        "When we had a surge in loan volume, CLX helped us maintain turnaround times without sacrificing quality. Invaluable support.",
      author: "VP Commercial Lending",
      company: "Credit Union",
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
                <Shield className="w-4 h-4" />
                For Banks & Credit Unions
              </div>
              <h1 className="text-primary-foreground mb-6">
                Extend Your Credit Team Without Adding Headcount
              </h1>
              <p className="text-xl text-primary-foreground/80 leading-relaxed mb-8">
                Outsourced underwriting and credit support services that meet your 
                institution's standards. Handle volume spikes, special projects, and 
                capacity gaps with confidence.
              </p>
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Schedule a Discovery Call
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="py-24">
          <div className="section-container">
            <div className="text-center mb-16">
              <h2 className="mb-4">How We Support Your Credit Team</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comprehensive credit services delivered by experienced commercial analysts 
                who understand bank and credit union requirements.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="bg-card rounded-xl p-8 border border-border card-hover"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <service.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="mb-3">{service.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Partner */}
        <section className="py-24 bg-muted">
          <div className="section-container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="mb-6">Why Banks Partner with CLX</h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  We understand the unique requirements of community banks and credit 
                  unions. Our team delivers work that integrates seamlessly with your 
                  existing credit processes and culture.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-highlight flex-shrink-0" />
                      <span className="text-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-6">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={index}
                    className="bg-card rounded-xl p-6 border border-border"
                  >
                    <p className="text-foreground italic mb-4">
                      "{testimonial.quote}"
                    </p>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">
                        {testimonial.author}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {testimonial.company}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What to Expect */}
        <section className="py-24">
          <div className="section-container">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="mb-6">What You Can Expect</h2>
              <div className="grid sm:grid-cols-3 gap-8 mt-12">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="mb-2">Quality Deliverables</h4>
                  <p className="text-sm text-muted-foreground">
                    Work formatted to your standards
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="mb-2">Fast Turnaround</h4>
                  <p className="text-sm text-muted-foreground">
                    Typical 3-5 business day completion
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="mb-2">Direct Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Talk directly with your analyst
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 hero-gradient">
          <div className="section-container text-center">
            <h2 className="text-primary-foreground mb-6">
              Ready to Explore a Partnership?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Schedule a discovery call to discuss your institution's needs and see 
              how we can support your credit team.
            </p>
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Schedule a Discovery Call
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

export default BankServices;
