import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Factory, ShoppingBag, Utensils, Truck, Hospital } from "lucide-react";

const RecentDeals = () => {
  const deals = [
    {
      icon: Factory,
      amount: "$4.2M",
      type: "SBA 7(a)",
      industry: "Manufacturing",
      highlight: "10% down, working capital included",
    },
    {
      icon: Building2,
      amount: "$8.5M",
      type: "Commercial Real Estate",
      industry: "Mixed-Use Development",
      highlight: "Bridge to perm, 18-month term",
    },
    {
      icon: ShoppingBag,
      amount: "$2.1M",
      type: "Acquisition",
      industry: "Retail Franchise",
      highlight: "Multi-unit expansion financing",
    },
    {
      icon: Utensils,
      amount: "$1.8M",
      type: "SBA 504",
      industry: "Restaurant Group",
      highlight: "Equipment + real estate combo",
    },
    {
      icon: Truck,
      amount: "$3.5M",
      type: "Asset-Based",
      industry: "Logistics",
      highlight: "Fleet expansion, 90-day close",
    },
    {
      icon: Hospital,
      amount: "$5.0M",
      type: "Conventional",
      industry: "Healthcare",
      highlight: "Practice acquisition + working capital",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="section-container">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="mb-3">Recent Transactions</h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Real deals, real results. See how we've helped businesses and investors 
              secure the right financing.
            </p>
          </div>
          <Link to="/transactions">
            <Button variant="outline" className="group">
              View All Deals
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Deals Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((deal, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-6 border border-border card-hover"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <deal.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{deal.amount}</span>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded">
                    {deal.type}
                  </span>
                  <span className="text-sm text-muted-foreground">{deal.industry}</span>
                </div>
                <p className="text-sm text-highlight font-medium">{deal.highlight}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecentDeals;
