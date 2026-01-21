import { Badge } from '@/components/ui/badge';
import { 
  Building2,
  CircleDollarSign,
  MapPin,
  Globe,
  Phone,
  Mail,
  User,
  FileText,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

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
  call_status: string | null;
  location: string | null;
  looking_for: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  lender_type: string | null;
  loan_types: string | null;
  states: string | null;
  loan_size_text: string | null;
}

interface LeadContext {
  name?: string;
  loanAmount?: number;
  loanType?: string;
  state?: string;
  propertyType?: string;
}

interface LenderProgramCardProps {
  program: Program;
  leadContext?: LeadContext | null;
}

// Parse loan types into array
const parseLoanTypes = (loanTypes: string | null): string[] => {
  if (!loanTypes) return [];
  return loanTypes.split(',').map(t => t.trim()).filter(Boolean);
};

// Simple fit check based on lead context
const checkFit = (program: Program, leadContext?: LeadContext | null): {
  score: 'good' | 'caution' | 'unknown';
  reasons: string[];
  warnings: string[];
} => {
  if (!leadContext) return { score: 'unknown', reasons: [], warnings: [] };
  
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  // Check loan types match
  const dealTypes = parseLoanTypes(program.loan_types);
  if (leadContext.loanType && dealTypes.length > 0) {
    const leadType = leadContext.loanType.toUpperCase();
    const hasMatch = dealTypes.some(t => 
      leadType.includes(t.toUpperCase()) || t.toUpperCase().includes(leadType)
    );
    if (hasMatch) {
      reasons.push(`Handles ${leadContext.loanType} deals`);
    }
  }
  
  // Check state coverage
  if (leadContext.state && program.states) {
    const statesUpper = program.states.toUpperCase();
    if (statesUpper.includes(leadContext.state.toUpperCase()) || statesUpper.includes('NATIONWIDE') || statesUpper.includes('ALL')) {
      reasons.push(`Active in ${leadContext.state}`);
    } else {
      warnings.push(`May not cover ${leadContext.state}`);
    }
  }
  
  const score = warnings.length > 0 ? 'caution' : reasons.length > 0 ? 'good' : 'unknown';
  
  return { score, reasons, warnings };
};

export const LenderProgramCard = ({ program, leadContext }: LenderProgramCardProps) => {
  const dealTypes = parseLoanTypes(program.loan_types);
  const fit = checkFit(program, leadContext);
  
  return (
    <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4.5 h-4.5 text-slate-600" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900 text-sm leading-tight">
                {program.lender_name}
              </h4>
              {program.lender_type && (
                <p className="text-xs text-slate-500 mt-0.5">{program.lender_type}</p>
              )}
            </div>
          </div>
          
          {/* Fit Indicator */}
          {fit.score !== 'unknown' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
              fit.score === 'good' 
                ? 'bg-slate-100 text-slate-700' 
                : 'bg-orange-50 text-orange-700'
            }`}>
              {fit.score === 'good' ? (
                <><CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Match</>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Review</>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Loan Range */}
        {program.loan_size_text && (
          <div className="flex items-center gap-3">
            <CircleDollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Loan Range</p>
              <p className="text-sm font-semibold text-slate-900">{program.loan_size_text}</p>
            </div>
          </div>
        )}
        
        {/* Deal Types */}
        {dealTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dealTypes.map((type) => (
              <Badge 
                key={type} 
                variant="outline"
                className="text-xs font-medium px-2 py-0.5 bg-white border-slate-200 text-slate-600 rounded"
              >
                {type}
              </Badge>
            ))}
          </div>
        )}
        
        {/* What They Want */}
        {(program.looking_for || program.description) && (
          <div className="flex gap-3">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm text-slate-600 leading-relaxed">
              {program.looking_for || program.description}
            </p>
          </div>
        )}
        
        {/* Location & States */}
        {(program.location || program.states) && (
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            {program.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Location</p>
                  <p className="text-sm text-slate-700">{program.location}</p>
                </div>
              </div>
            )}
            {program.states && (
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Markets</p>
                  <p className="text-sm text-slate-700">{program.states}</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Fit Reasons/Warnings */}
        {leadContext && (fit.reasons.length > 0 || fit.warnings.length > 0) && (
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            {fit.reasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                <span>{reason}</span>
              </div>
            ))}
            {fit.warnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-orange-600">
                <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Contact */}
        {(program.contact_name || program.phone || program.email) && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
              {program.contact_name && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {program.contact_name}
                </span>
              )}
              {program.phone && (
                <a href={`tel:${program.phone}`} className="flex items-center gap-1.5 hover:text-slate-700">
                  <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {program.phone}
                </a>
              )}
              {program.email && (
                <a href={`mailto:${program.email}`} className="flex items-center gap-1.5 hover:text-slate-700 truncate max-w-[200px]">
                  <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {program.email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
