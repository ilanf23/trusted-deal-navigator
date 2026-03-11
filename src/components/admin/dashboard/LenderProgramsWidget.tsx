import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Building2, Users, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface LenderProgramsWidgetProps {
  lenderData: {
    totalPrograms: number;
    withContact: number;
    recentContacts: { id: string; lender_name: string; contact_name: string | null; phone: string | null; last_contact: string | null }[];
  };
  isLoading: boolean;
}

export const LenderProgramsWidget = ({ lenderData, isLoading }: LenderProgramsWidgetProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Lender Programs
          </CardTitle>
          <Link to="/admin/lender-programs">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase">Programs</span>
                </div>
                <p className="text-lg font-bold">{lenderData.totalPrograms}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase">With Contacts</span>
                </div>
                <p className="text-lg font-bold">{lenderData.withContact}</p>
              </div>
            </div>
            {lenderData.recentContacts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Recent Contacts</p>
                {lenderData.recentContacts.map((lender) => (
                  <div key={lender.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">
                        {lender.lender_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{lender.lender_name}</p>
                      {lender.contact_name && (
                        <p className="text-[10px] text-muted-foreground truncate">{lender.contact_name}</p>
                      )}
                    </div>
                    {lender.phone && (
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
