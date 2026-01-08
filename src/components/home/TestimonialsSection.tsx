import { Quote } from "lucide-react";

const TestimonialsSection = () => {
  const testimonials = [
    {
      quote:
        "CLX navigated a complex acquisition financing that three other brokers couldn't close. Their lender relationships and persistence made all the difference.",
      author: "Michael Chen",
      role: "CEO, Chen Manufacturing Group",
      type: "Borrower",
    },
    {
      quote:
        "As a CPA, I've referred dozens of clients to CLX. They make me look good by closing deals others can't and treating my clients with the care they deserve.",
      author: "Sarah Martinez",
      role: "CPA, Martinez & Associates",
      type: "Referral Partner",
    },
    {
      quote:
        "Their underwriting support has been invaluable during peak season. Quality work, clear communication, and they understand our credit culture.",
      author: "James Wilson",
      role: "Chief Credit Officer, Regional Bank",
      type: "Bank Partner",
    },
  ];

  return (
    <section className="py-24 bg-muted">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="mb-4">What Our Clients Say</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From business owners to bank partners—hear why they trust Commercial Lending X.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-8 border border-border relative"
            >
              {/* Quote Icon */}
              <div className="absolute top-6 right-6">
                <Quote className="w-8 h-8 text-primary/20" />
              </div>

              {/* Type Badge */}
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-6">
                {testimonial.type}
              </span>

              {/* Quote */}
              <p className="text-foreground mb-6 leading-relaxed italic">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="border-t border-border pt-6">
                <div className="font-semibold text-foreground">{testimonial.author}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
