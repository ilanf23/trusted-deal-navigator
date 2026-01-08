import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dealType: "",
    amount: "",
    timing: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would submit to a backend
    toast.success("Thank you! We'll be in touch within 24 hours.");
    setFormData({
      name: "",
      email: "",
      phone: "",
      dealType: "",
      amount: "",
      timing: "",
      description: "",
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const benefits = [
    "Confidential consultation, your information is protected",
    "Thoughtful follow-up, not spam",
    "No obligation, no upfront fees",
    "Typically respond within 24 hours",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-muted">
          <div className="section-container">
            <div className="max-w-3xl">
              <h1 className="mb-6">Talk to a Financing Expert</h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Whether you have a specific deal or just exploring options, we're here to 
                help you navigate commercial financing with confidence.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="py-24">
          <div className="section-container">
            <div className="grid lg:grid-cols-3 gap-12">
              {/* Form */}
              <div className="lg:col-span-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="John Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealType">Deal Type *</Label>
                      <Select
                        value={formData.dealType}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, dealType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business-acquisition">
                            Business Acquisition
                          </SelectItem>
                          <SelectItem value="business-refinance">
                            Business Refinance
                          </SelectItem>
                          <SelectItem value="cre-acquisition">
                            Commercial Real Estate Acquisition
                          </SelectItem>
                          <SelectItem value="cre-construction">
                            Construction / Development
                          </SelectItem>
                          <SelectItem value="cre-refinance">
                            CRE Refinance
                          </SelectItem>
                          <SelectItem value="working-capital">
                            Working Capital / LOC
                          </SelectItem>
                          <SelectItem value="equipment">
                            Equipment Financing
                          </SelectItem>
                          <SelectItem value="bank-services">
                            Bank / Credit Union Services
                          </SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Estimated Amount</Label>
                      <Input
                        id="amount"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        placeholder="$2,000,000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timing">Timing</Label>
                      <Select
                        value={formData.timing}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, timing: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select timing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asap">ASAP / Urgent</SelectItem>
                          <SelectItem value="1-3months">1-3 Months</SelectItem>
                          <SelectItem value="3-6months">3-6 Months</SelectItem>
                          <SelectItem value="6plus">6+ Months</SelectItem>
                          <SelectItem value="exploring">
                            Just Exploring Options
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Tell Us About Your Deal</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Briefly describe your financing needs, the business or property, and any other relevant details..."
                      rows={5}
                    />
                  </div>

                  <Button type="submit" variant="hero" size="lg">
                    Submit Inquiry
                  </Button>
                </form>
              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                {/* What to Expect */}
                <div className="bg-card rounded-xl p-6 border border-border">
                  <h3 className="mb-4">What to Expect</h3>
                  <ul className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-highlight flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Direct Contact */}
                <div className="bg-primary rounded-xl p-6 text-primary-foreground">
                  <h3 className="mb-4">Prefer to Talk?</h3>
                  <div className="space-y-4">
                    <a
                      href="tel:+18476510319"
                      className="flex items-center gap-3 text-primary-foreground/90 hover:text-primary-foreground transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                      (847) 651-0319
                    </a>
                    <a
                      href="mailto:info@commerciallendingx.com"
                      className="flex items-center gap-3 text-primary-foreground/90 hover:text-primary-foreground transition-colors"
                    >
                      <Mail className="w-5 h-5" />
                      info@commerciallendingx.com
                    </a>
                    <div className="flex items-center gap-3 text-primary-foreground/70">
                      <Clock className="w-5 h-5" />
                      Mon to Fri 9am to 6pm EST
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
