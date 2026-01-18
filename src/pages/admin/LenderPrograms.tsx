import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, DollarSign, Percent, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

interface Program {
  id: string;
  lender_name: string;
  lender_specialty: string | null;
  program_name: string;
  program_type: string;
  description: string | null;
  min_loan: number | null;
  max_loan: number | null;
  interest_range: string | null;
  term: string | null;
}

interface GroupedLender {
  name: string;
  specialty: string;
  programs: Program[];
}

const formatCurrency = (amount: number | null) => {
  if (!amount) return 'N/A';
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(0)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
};

const getTypeBadgeClass = (type: string) => {
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
  const [lenders, setLenders] = useState<GroupedLender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('lender_name', { ascending: true })
        .order('program_name', { ascending: true });

      if (error) throw error;

      // Group by lender
      const grouped = (data || []).reduce((acc: Record<string, GroupedLender>, program) => {
        if (!acc[program.lender_name]) {
          acc[program.lender_name] = {
            name: program.lender_name,
            specialty: program.lender_specialty || '',
            programs: [],
          };
        }
        acc[program.lender_name].programs.push(program);
        return acc;
      }, {});

      setLenders(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLender = (lenderName: string) => {
    setExpandedLenders((prev) => ({
      ...prev,
      [lenderName]: !prev[lenderName],
    }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-admin-blue-dark">Lender Programs</h1>
          <p className="text-muted-foreground mt-1">
            Browse lending programs from our network of <span className="font-semibold text-admin-orange">{lenders.length} lenders</span>
          </p>
        </div>

        <div className="space-y-5">
          {lenders.map((lender) => (
            <Collapsible
              key={lender.name}
              open={expandedLenders[lender.name]}
              onOpenChange={() => toggleLender(lender.name)}
            >
              <Card className="overflow-hidden border-admin-blue/10 border-2 hover:border-admin-blue/30 transition-all">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-admin-blue-light/30 transition-colors py-5">
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
                        {expandedLenders[lender.name] ? (
                          <ChevronUp className="w-5 h-5 text-admin-blue" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-5">
                    <div className="space-y-4">
                      {lender.programs.map((program) => (
                        <div
                          key={program.id}
                          className="p-5 rounded-xl border border-admin-blue/10 bg-gradient-to-r from-admin-blue-light/30 to-transparent hover:from-admin-blue-light/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-admin-blue-dark text-base">{program.program_name}</h4>
                                <Badge className={`text-xs ${getTypeBadgeClass(program.program_type)}`}>
                                  {program.program_type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{program.description}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-admin-blue/10">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-admin-teal-light">
                                <DollarSign className="w-4 h-4 text-admin-teal" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Loan Range</p>
                                <p className="text-sm font-medium text-admin-teal">
                                  {formatCurrency(program.min_loan)} - {formatCurrency(program.max_loan)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-admin-blue-light">
                                <Percent className="w-4 h-4 text-admin-blue" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Interest Rate</p>
                                <p className="text-sm font-medium text-admin-blue">{program.interest_range || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-admin-orange-light">
                                <Clock className="w-4 h-4 text-admin-orange" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Term</p>
                                <p className="text-sm font-medium text-admin-orange">{program.term || 'N/A'}</p>
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
