import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  MapPin, 
  Phone, 
  Mail, 
  User,
  Zap,
  Target,
  CheckCircle2,
  AlertTriangle,
  Building2
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

// Get deal type badge color
const getDealTypeBadgeClass = (type: string): string => {
  const typeUpper = type.toUpperCase();
  if (typeUpper.includes('SBA')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (typeUpper.includes('ACQUISITION') || typeUpper.includes('ACQ')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (typeUpper.includes('REFI') || typeUpper.includes('REFINANCE')) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (typeUpper.includes('CONSTRUCTION')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (typeUpper.includes('BRIDGE')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (typeUpper.includes('OO') || typeUpper.includes('OWNER')) return 'bg-teal-100 text-teal-800 border-teal-200';
  if (typeUpper.includes('INVESTMENT') || typeUpper.includes('INV')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (typeUpper.includes('CRE') || typeUpper.includes('COMMERCIAL')) return 'bg-slate-100 text-slate-800 border-slate-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

// Simple fit check based on lead context
const checkFit = (program: Program, leadContext?: LeadContext | null): {
  score: 'good' | 'maybe' | 'unknown';
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
  
  const score = warnings.length > 0 ? 'maybe' : reasons.length > 0 ? 'good' : 'unknown';
  
  return { score, reasons, warnings };
};

export const LenderProgramCard = ({ program, leadContext }: LenderProgramCardProps) => {
  const dealTypes = parseLoanTypes(program.loan_types);
  const fit = checkFit(program, leadContext);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
      {/* Header with Lender Name & Fit Indicator */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                {program.lender_name}
              </h4>
              {program.lender_type && (
                <p className="text-xs text-slate-500 truncate">{program.lender_type}</p>
              )}
            </div>
          </div>
          
          {/* Fit Indicator */}
          {fit.score !== 'unknown' && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
              fit.score === 'good' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {fit.score === 'good' ? (
                <><CheckCircle2 className="w-3 h-3" /> Good Fit</>
              ) : (
                <><AlertTriangle className="w-3 h-3" /> Check Fit</>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Key Metrics Row - Scannable in 3 seconds */}
        <div className="grid grid-cols-2 gap-3">
          {/* Loan Range - Primary metric */}
          {program.loan_size_text && (
            <div className="col-span-2 bg-emerald-50 rounded-lg p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Loan Range</p>
                <p className="text-base font-bold text-emerald-900">{program.loan_size_text}</p>
              </div>
            </div>
          )}
          
          {/* Location */}
          {program.location && (
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Location</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{program.location}</p>
            </div>
          )}
          
          {/* States */}
          {program.states && (
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Markets</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{program.states}</p>
            </div>
          )}
        </div>
        
        {/* Deal Types - What they do */}
        {dealTypes.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Deal Types</p>
            <div className="flex flex-wrap gap-1.5">
              {dealTypes.map((type) => (
                <Badge 
                  key={type} 
                  variant="outline"
                  className={`text-xs font-medium px-2.5 py-1 ${getDealTypeBadgeClass(type)}`}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Looking For / Sweet Spot */}
        {(program.looking_for || program.description) && (
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">What They Want</p>
            </div>
            <p className="text-sm text-blue-900 leading-relaxed">
              {program.looking_for || program.description}
            </p>
          </div>
        )}
        
        {/* Fit Reasons/Warnings for current lead */}
        {leadContext && (fit.reasons.length > 0 || fit.warnings.length > 0) && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            {fit.reasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
            {fit.warnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Contact - Compact */}
        {(program.contact_name || program.phone || program.email) && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm">
              {program.contact_name && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium">{program.contact_name}</span>
                </div>
              )}
              {program.phone && (
                <a href={`tel:${program.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{program.phone}</span>
                </a>
              )}
              {program.email && (
                <a href={`mailto:${program.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[180px]">{program.email}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
