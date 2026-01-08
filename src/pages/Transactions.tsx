import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Building2,
  Factory,
  ShoppingBag,
  Utensils,
  Truck,
  Hospital,
  Hotel,
  Warehouse,
  ArrowRight,
} from "lucide-react";

const Transactions = () => {
  const [activeFilter, setActiveFilter] = useState("all");

  const filters = [
    { id: "all", label: "All Deals" },
    { id: "sba", label: "SBA Loans" },
    { id: "cre", label: "Commercial Real Estate" },
    { id: "acquisition", label: "Acquisitions" },
    { id: "working-capital", label: "Working Capital" },
  ];

  const transactions = [
    {
      icon: Factory,
      amount: "$4.2M",
      type: "SBA 7(a)",
      category: "sba",
      industry: "Manufacturing",
      highlight: "10% down, working capital included",
      description:
        "Acquisition of established metal fabrication company. Structured to include working capital for immediate equipment upgrades.",
    },
    {
      icon: Building2,
      amount: "$8.5M",
      type: "Bridge Loan",
      category: "cre",
      industry: "Mixed Use Development",
      highlight: "Bridge to perm, 18 month term",
      description:
        "Acquisition and repositioning of downtown mixed use property. Bridge financing with permanent takeout commitment.",
    },
    {
      icon: ShoppingBag,
      amount: "$2.1M",
      type: "Acquisition",
      category: "acquisition",
      industry: "Retail Franchise",
      highlight: "Multi unit expansion financing",
      description:
        "Acquisition of 5-unit franchise territory. Structured with seller note and SBA financing for optimal leverage.",
    },
    {
      icon: Utensils,
      amount: "$1.8M",
      type: "SBA 504",
      category: "sba",
      industry: "Restaurant Group",
      highlight: "Equipment + real estate combo",
      description:
        "Purchase of restaurant property with extensive equipment package. 504 structure minimized down payment requirements.",
    },
    {
      icon: Truck,
      amount: "$3.5M",
      type: "Asset Based",
      category: "working-capital",
      industry: "Logistics",
      highlight: "Fleet expansion, 90 day close",
      description:
        "Asset-based facility secured by fleet and receivables. Provided growth capital for major contract expansion.",
    },
    {
      icon: Hospital,
      amount: "$5.0M",
      type: "Conventional",
      category: "acquisition",
      industry: "Healthcare",
      highlight: "Practice acquisition + working capital",
      description:
        "Medical practice acquisition with real estate. Conventional bank financing with SBA backup for optimal terms.",
    },
    {
      icon: Hotel,
      amount: "$12.8M",
      type: "CMBS",
      category: "cre",
      industry: "Hospitality",
      highlight: "Limited service hotel refinance",
      description:
        "Refinance of 120 room limited service hotel. CMBS execution provided best terms for stabilized asset.",
    },
    {
      icon: Warehouse,
      amount: "$6.2M",
      type: "SBA 504",
      category: "sba",
      industry: "Distribution",
      highlight: "Owner occupied industrial",
      description:
        "Purchase of distribution warehouse with cold storage. 504 financing maximized leverage for owner-occupant.",
    },
  ];

  const filteredTransactions =
    activeFilter === "all"
      ? transactions
      : transactions.filter((t) => t.category === activeFilter);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-muted">
          <div className="section-container">
            <div className="max-w-3xl">
              <h1 className="mb-6">Our Transactions</h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Real deals, real results. Browse our recent transactions to see the
                types of financing we structure and the outcomes we deliver.
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="py-8 border-b border-border sticky top-16 md:top-20 bg-background z-40">
          <div className="section-container">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === filter.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Transactions Grid */}
        <section className="py-16">
          <div className="section-container">
            <div className="grid md:grid-cols-2 gap-8">
              {filteredTransactions.map((deal, index) => (
                <div
                  key={index}
                  className="bg-card rounded-xl p-8 border border-border card-hover"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <deal.icon className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-3xl font-bold text-foreground">
                      {deal.amount}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                      {deal.type}
                    </span>
                    <span className="text-muted-foreground">{deal.industry}</span>
                  </div>

                  {/* Highlight */}
                  <p className="text-highlight font-semibold mb-4">{deal.highlight}</p>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {deal.description}
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
              Have a Deal That Needs Financing?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Let's discuss your specific situation and find the right financing solution.
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

export default Transactions;
