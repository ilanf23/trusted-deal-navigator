import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, DollarSign, Percent, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Program {
  id: string;
  name: string;
  description: string;
  minLoan: number;
  maxLoan: number;
  interestRange: string;
  term: string;
  type: 'SBA' | 'Conventional' | 'Bridge' | 'Construction' | 'CMBS';
}

interface Lender {
  id: string;
  name: string;
  logo?: string;
  specialty: string;
  programs: Program[];
}

const lenders: Lender[] = [
  {
    id: '1',
    name: 'First National Commercial Bank',
    specialty: 'SBA & Conventional Loans',
    programs: [
      {
        id: '1a',
        name: 'SBA 7(a) Standard',
        description: 'Traditional SBA loan for working capital, equipment, and real estate. Up to 90% financing with competitive rates. Ideal for businesses with 2+ years history and $500K+ annual revenue.',
        minLoan: 150000,
        maxLoan: 5000000,
        interestRange: 'Prime + 2.25% - 2.75%',
        term: '10-25 years',
        type: 'SBA',
      },
      {
        id: '1b',
        name: 'SBA 504 Real Estate',
        description: 'Fixed-rate financing for major assets. Requires 10% down payment. Perfect for owner-occupied commercial properties valued at $1M-$15M.',
        minLoan: 500000,
        maxLoan: 15000000,
        interestRange: '5.75% - 6.50% Fixed',
        term: '20-25 years',
        type: 'SBA',
      },
      {
        id: '1c',
        name: 'Express Line of Credit',
        description: 'Revolving credit facility for businesses with $250K+ monthly deposits. Fast approval within 72 hours. Annual review required.',
        minLoan: 50000,
        maxLoan: 500000,
        interestRange: 'Prime + 3.00%',
        term: '1-3 years',
        type: 'Conventional',
      },
      {
        id: '1d',
        name: 'Equipment Finance',
        description: 'Up to 100% financing for new equipment purchases. Minimum credit score 680. Monthly payments based on 36-84 month amortization.',
        minLoan: 25000,
        maxLoan: 2500000,
        interestRange: '6.50% - 9.00%',
        term: '3-7 years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '2',
    name: 'Pacific Coast Capital',
    specialty: 'Bridge & Construction',
    programs: [
      {
        id: '2a',
        name: 'Quick Bridge',
        description: 'Short-term bridge financing for acquisitions and refinancing. Close in 14-21 days. Up to 75% LTV on stabilized assets.',
        minLoan: 1000000,
        maxLoan: 25000000,
        interestRange: '9.50% - 12.00%',
        term: '12-36 months',
        type: 'Bridge',
      },
      {
        id: '2b',
        name: 'Ground-Up Construction',
        description: 'Financing for new development projects. 65% LTC maximum. Interest reserve included. Requires 24+ months construction experience.',
        minLoan: 2000000,
        maxLoan: 50000000,
        interestRange: '10.00% - 13.50%',
        term: '18-36 months',
        type: 'Construction',
      },
      {
        id: '2c',
        name: 'Value-Add Bridge',
        description: 'Renovation financing with construction holdback. Up to 80% of stabilized value. Perfect for repositioning assets requiring $500K+ in improvements.',
        minLoan: 1500000,
        maxLoan: 35000000,
        interestRange: '10.50% - 13.00%',
        term: '24-36 months',
        type: 'Bridge',
      },
    ],
  },
  {
    id: '3',
    name: 'Meridian Commercial Funding',
    specialty: 'CMBS & Permanent Loans',
    programs: [
      {
        id: '3a',
        name: 'CMBS Fixed Rate',
        description: 'Non-recourse permanent financing for stabilized properties. 30-year amortization with 10-year term. Minimum DSCR 1.25x required.',
        minLoan: 3000000,
        maxLoan: 100000000,
        interestRange: '6.25% - 7.25% Fixed',
        term: '10 years',
        type: 'CMBS',
      },
      {
        id: '3b',
        name: 'Floating Rate CMBS',
        description: 'Flexible prepayment options with SOFR-based pricing. Interest-only periods available. Ideal for properties with 85%+ occupancy.',
        minLoan: 5000000,
        maxLoan: 75000000,
        interestRange: 'SOFR + 2.50% - 3.50%',
        term: '5-10 years',
        type: 'CMBS',
      },
      {
        id: '3c',
        name: 'Agency Multifamily',
        description: 'Fannie Mae and Freddie Mac eligible loans for apartment complexes. Best rates in market. Minimum 50 units required.',
        minLoan: 5000000,
        maxLoan: 250000000,
        interestRange: '5.50% - 6.75%',
        term: '10-30 years',
        type: 'Conventional',
      },
      {
        id: '3d',
        name: 'Mezzanine Financing',
        description: 'Subordinate debt to fill capital stack gaps. 75-85% combined LTV. Preferred equity options available for deals over $10M.',
        minLoan: 2000000,
        maxLoan: 50000000,
        interestRange: '12.00% - 16.00%',
        term: '3-7 years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '4',
    name: 'Heartland Business Lenders',
    specialty: 'Small Business Focus',
    programs: [
      {
        id: '4a',
        name: 'Micro SBA Express',
        description: 'Fast-track SBA loans for small businesses. Approval in 48-72 hours. Perfect for working capital needs under $250K.',
        minLoan: 10000,
        maxLoan: 250000,
        interestRange: 'Prime + 4.00% - 6.00%',
        term: '5-10 years',
        type: 'SBA',
      },
      {
        id: '4b',
        name: 'Franchise Financing',
        description: 'Specialized loans for franchise acquisitions. Up to 90% financing for approved brands. Covers franchise fees, build-out, and equipment.',
        minLoan: 100000,
        maxLoan: 3000000,
        interestRange: '7.50% - 9.50%',
        term: '10-15 years',
        type: 'SBA',
      },
      {
        id: '4c',
        name: 'Business Acquisition Loan',
        description: 'Financing for buying existing businesses. Includes working capital component. Target businesses with $200K+ EBITDA.',
        minLoan: 250000,
        maxLoan: 5000000,
        interestRange: '7.00% - 9.00%',
        term: '10-15 years',
        type: 'SBA',
      },
    ],
  },
  {
    id: '5',
    name: 'Metropolitan Trust',
    specialty: 'Institutional Grade Assets',
    programs: [
      {
        id: '5a',
        name: 'Core Plus',
        description: 'Premium financing for Class A office and retail. Sub-60% LTV with aggressive pricing. Minimum property value $25M.',
        minLoan: 15000000,
        maxLoan: 500000000,
        interestRange: '5.25% - 6.00%',
        term: '10-15 years',
        type: 'Conventional',
      },
      {
        id: '5b',
        name: 'Industrial Portfolio',
        description: 'Financing for warehouse and logistics facilities. Cross-collateralized options available. Minimum 100,000 SF per asset.',
        minLoan: 10000000,
        maxLoan: 300000000,
        interestRange: '5.50% - 6.50%',
        term: '7-15 years',
        type: 'Conventional',
      },
      {
        id: '5c',
        name: 'Trophy Asset Program',
        description: 'Bespoke financing for iconic properties. Relationship pricing with full recourse waiver. Properties valued at $100M+.',
        minLoan: 50000000,
        maxLoan: 1000000000,
        interestRange: '4.75% - 5.50%',
        term: '10-20 years',
        type: 'Conventional',
      },
      {
        id: '5d',
        name: 'Green Building Initiative',
        description: 'Discounted rates for LEED certified buildings. Additional 25bps reduction for Platinum certification. ESG compliance required.',
        minLoan: 20000000,
        maxLoan: 400000000,
        interestRange: '4.90% - 5.75%',
        term: '10-20 years',
        type: 'Conventional',
      },
      {
        id: '5e',
        name: 'Data Center Financing',
        description: 'Specialized loans for data center development and acquisition. Requires minimum 99.99% uptime infrastructure. Long-term tenant leases required.',
        minLoan: 25000000,
        maxLoan: 750000000,
        interestRange: '5.00% - 6.25%',
        term: '15-25 years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '6',
    name: 'Southwest Capital Partners',
    specialty: 'Hospitality & Retail',
    programs: [
      {
        id: '6a',
        name: 'Hotel Acquisition',
        description: 'Financing for flagged hotel purchases. STR data analysis required. Minimum 75 keys. Coverage ratio 1.35x DSCR.',
        minLoan: 5000000,
        maxLoan: 75000000,
        interestRange: '7.25% - 9.00%',
        term: '5-10 years',
        type: 'Conventional',
      },
      {
        id: '6b',
        name: 'Hotel PIP Financing',
        description: 'Property improvement plan loans for brand compliance. Fast 30-day closing. Up to $150K per key.',
        minLoan: 1000000,
        maxLoan: 20000000,
        interestRange: '8.50% - 11.00%',
        term: '3-7 years',
        type: 'Bridge',
      },
      {
        id: '6c',
        name: 'Retail Center Refinance',
        description: 'Permanent financing for anchored retail centers. 70% LTV maximum. National tenant credit required for 40%+ of NRA.',
        minLoan: 3000000,
        maxLoan: 50000000,
        interestRange: '6.75% - 8.25%',
        term: '10-15 years',
        type: 'CMBS',
      },
    ],
  },
  {
    id: '7',
    name: 'Urban Development Fund',
    specialty: 'Mixed-Use & Affordable Housing',
    programs: [
      {
        id: '7a',
        name: 'LIHTC Equity Bridge',
        description: 'Bridge financing for Low Income Housing Tax Credit projects. Up to 95% of tax credit value. 4% and 9% credit eligible.',
        minLoan: 2000000,
        maxLoan: 30000000,
        interestRange: '7.00% - 8.50%',
        term: '18-36 months',
        type: 'Bridge',
      },
      {
        id: '7b',
        name: 'Mixed-Use Construction',
        description: 'Ground-up financing for residential over retail projects. 70% LTC with interest reserve. Pre-leasing requirements vary by market.',
        minLoan: 5000000,
        maxLoan: 100000000,
        interestRange: '8.50% - 11.00%',
        term: '24-48 months',
        type: 'Construction',
      },
      {
        id: '7c',
        name: 'Workforce Housing Permanent',
        description: 'Long-term financing for 60-80% AMI restricted properties. Below-market rates with regulatory agreement. 35-year amortization available.',
        minLoan: 3000000,
        maxLoan: 75000000,
        interestRange: '5.00% - 6.25%',
        term: '15-30 years',
        type: 'Conventional',
      },
      {
        id: '7d',
        name: 'Opportunity Zone Fund',
        description: 'Preferred equity and debt for QOZ investments. Enhanced returns with tax benefits. Minimum 10-year hold required.',
        minLoan: 5000000,
        maxLoan: 50000000,
        interestRange: '9.00% - 14.00%',
        term: '10+ years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '8',
    name: 'Atlantic Commercial Credit',
    specialty: 'Healthcare & Senior Living',
    programs: [
      {
        id: '8a',
        name: 'Skilled Nursing Facility',
        description: 'Acquisition and refinance for SNF properties. HUD 232 and conventional options. Minimum 100 beds with 85%+ occupancy.',
        minLoan: 5000000,
        maxLoan: 100000000,
        interestRange: '6.00% - 7.75%',
        term: '10-35 years',
        type: 'Conventional',
      },
      {
        id: '8b',
        name: 'Assisted Living Development',
        description: 'Construction financing for new senior housing. Requires experienced operator with 500+ bed portfolio. 60% LTC maximum.',
        minLoan: 10000000,
        maxLoan: 75000000,
        interestRange: '9.00% - 11.50%',
        term: '24-36 months',
        type: 'Construction',
      },
      {
        id: '8c',
        name: 'Medical Office Building',
        description: 'Permanent loans for MOB properties. Strong credit tenants required. Investment grade tenant lease = best pricing.',
        minLoan: 3000000,
        maxLoan: 50000000,
        interestRange: '5.75% - 7.00%',
        term: '10-15 years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '9',
    name: 'Mountain West Credit Union',
    specialty: 'Credit Union Lending',
    programs: [
      {
        id: '9a',
        name: 'Member Business Loan',
        description: 'Competitive rates for credit union members. Relationship-based underwriting. Annual revenue under $10M preferred.',
        minLoan: 50000,
        maxLoan: 3000000,
        interestRange: '6.25% - 8.50%',
        term: '5-20 years',
        type: 'Conventional',
      },
      {
        id: '9b',
        name: 'Commercial Real Estate - Owner Occupied',
        description: 'Up to 90% financing for owner-occupied properties. No prepayment penalty after year 3. Fast 45-day closing.',
        minLoan: 250000,
        maxLoan: 7500000,
        interestRange: '5.75% - 7.25%',
        term: '10-25 years',
        type: 'Conventional',
      },
      {
        id: '9c',
        name: 'Business Vehicle Fleet',
        description: 'Financing for commercial vehicles and equipment. Up to 100% financing for new vehicles. Fleet discounts available for 5+ units.',
        minLoan: 25000,
        maxLoan: 1500000,
        interestRange: '6.00% - 8.00%',
        term: '3-7 years',
        type: 'Conventional',
      },
      {
        id: '9d',
        name: 'Green Energy Upgrade',
        description: 'Specialized financing for solar, HVAC, and energy efficiency improvements. PACE program compatible. Utility bill savings analysis included.',
        minLoan: 50000,
        maxLoan: 2000000,
        interestRange: '5.50% - 7.00%',
        term: '5-15 years',
        type: 'Conventional',
      },
    ],
  },
  {
    id: '10',
    name: 'Pinnacle Private Lending',
    specialty: 'Private & Hard Money',
    programs: [
      {
        id: '10a',
        name: 'Fix & Flip Residential',
        description: 'Short-term loans for residential investors. Close in 7-10 days. Up to 90% of purchase + 100% of rehab. Exit within 12 months.',
        minLoan: 75000,
        maxLoan: 3000000,
        interestRange: '10.00% - 14.00%',
        term: '6-18 months',
        type: 'Bridge',
      },
      {
        id: '10b',
        name: 'Commercial Bridge',
        description: 'Fast capital for time-sensitive deals. Asset-based underwriting with minimal documentation. 1-2% origination fee.',
        minLoan: 500000,
        maxLoan: 25000000,
        interestRange: '11.00% - 15.00%',
        term: '12-36 months',
        type: 'Bridge',
      },
      {
        id: '10c',
        name: 'Land Acquisition',
        description: 'Financing for entitled and unentitled land. Up to 50% LTV on raw land. Higher leverage available with entitlements in place.',
        minLoan: 250000,
        maxLoan: 15000000,
        interestRange: '12.00% - 16.00%',
        term: '12-24 months',
        type: 'Bridge',
      },
      {
        id: '10d',
        name: 'Note Purchase Program',
        description: 'Financing for performing and non-performing note acquisitions. 65% of note UPB. Quick funding for bulk purchases.',
        minLoan: 100000,
        maxLoan: 10000000,
        interestRange: '10.00% - 13.00%',
        term: '12-24 months',
        type: 'Bridge',
      },
      {
        id: '10e',
        name: 'Foreign National Program',
        description: 'Investment property loans for non-US citizens. DSCR-based qualification. 35% down payment minimum. LLC ownership required.',
        minLoan: 150000,
        maxLoan: 5000000,
        interestRange: '8.50% - 11.00%',
        term: '5-30 years',
        type: 'Conventional',
      },
    ],
  },
];

const formatCurrency = (amount: number) => {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(0)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
};

const getTypeBadgeClass = (type: Program['type']) => {
  switch (type) {
    case 'SBA':
      return 'bg-admin-blue text-white border-0';
    case 'Conventional':
      return 'bg-admin-teal text-white border-0';
    case 'Bridge':
      return 'bg-admin-orange text-white border-0';
    case 'Construction':
      return 'bg-gradient-to-r from-admin-orange to-admin-orange-dark text-white border-0';
    case 'CMBS':
      return 'bg-admin-blue-dark text-white border-0';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const LenderPrograms = () => {
  const [expandedLenders, setExpandedLenders] = useState<Record<string, boolean>>({});

  const toggleLender = (lenderId: string) => {
    setExpandedLenders((prev) => ({
      ...prev,
      [lenderId]: !prev[lenderId],
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-admin-blue-dark">Lender Programs</h1>
          <p className="text-muted-foreground mt-1">
            Browse lending programs from our network of <span className="font-semibold text-admin-orange">{lenders.length} lenders</span>
          </p>
        </div>

        <div className="grid gap-4">
          {lenders.map((lender) => (
            <Collapsible
              key={lender.id}
              open={expandedLenders[lender.id]}
              onOpenChange={() => toggleLender(lender.id)}
            >
              <Card className="overflow-hidden border-admin-blue/10 border-2 hover:border-admin-blue/30 transition-all">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-admin-blue-light/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-admin-blue to-admin-blue-dark flex items-center justify-center shadow-md">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg text-admin-blue-dark">{lender.name}</CardTitle>
                          <CardDescription>{lender.specialty}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-admin-orange text-white border-0">{lender.programs.length} Programs</Badge>
                        {expandedLenders[lender.id] ? (
                          <ChevronUp className="w-5 h-5 text-admin-blue" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-3">
                      {lender.programs.map((program) => (
                        <div
                          key={program.id}
                          className="p-4 rounded-lg border border-admin-blue/10 bg-gradient-to-r from-admin-blue-light/30 to-transparent hover:from-admin-blue-light/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-admin-blue-dark">{program.name}</h4>
                                <Badge className={`text-xs ${getTypeBadgeClass(program.type)}`}>
                                  {program.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{program.description}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-admin-blue/10">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-admin-teal-light">
                                <DollarSign className="w-4 h-4 text-admin-teal" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Loan Range</p>
                                <p className="text-sm font-medium text-admin-teal">
                                  {formatCurrency(program.minLoan)} - {formatCurrency(program.maxLoan)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-admin-blue-light">
                                <Percent className="w-4 h-4 text-admin-blue" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Interest Rate</p>
                                <p className="text-sm font-medium text-admin-blue">{program.interestRange}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-admin-orange-light">
                                <Clock className="w-4 h-4 text-admin-orange" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Term</p>
                                <p className="text-sm font-medium text-admin-orange">{program.term}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
