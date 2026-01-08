import { TrendingUp, Handshake, Calendar, DollarSign } from "lucide-react";

const StatsSection = () => {
  const stats = [
    {
      icon: DollarSign,
      value: "$500M+",
      label: "Total Funded",
      description: "In commercial loans facilitated",
    },
    {
      icon: Handshake,
      value: "300+",
      label: "Lending Partners",
      description: "Banks, SBA & alternative lenders",
    },
    {
      icon: Calendar,
      value: "15+",
      label: "Years Experience",
      description: "In commercial lending",
    },
    {
      icon: TrendingUp,
      value: "$2M+",
      label: "Referral Fees Paid",
      description: "To our partner network",
    },
  ];

  return (
    <section className="py-20 bg-muted">
      <div className="section-container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                {stat.value}
              </div>
              <div className="font-semibold text-foreground mb-1">{stat.label}</div>
              <div className="text-sm text-muted-foreground">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
