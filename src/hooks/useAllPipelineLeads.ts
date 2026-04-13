import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Person, Company } from '@/integrations/supabase/types';

// Re-export types for backward compatibility
export type PipelinePerson = Person & {
  _pipelineName: string;
  _stageName: string;
  _stageId: string;
  _pipelineId: string;
  _pipelineLeadId: string;
};

export interface DerivedCompany {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  website: string | null;
  email_domain: string | null;
  contact_type: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  source: string | null;
  last_activity_at: string | null;
  known_as: string | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
  created_at: string;
  updated_at: string;
  deals_count: number;
}

/** Fetch all people from the people table */
export const usePeople = () => {
  return useQuery({
    queryKey: ['people'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Person[];
    },
  });
};

/** Fetch all companies from the companies table, joined with phones/emails/primary contact/deals count */
export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      // Companies + joined company_people (real FK) in one query
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          *,
          company_people ( person_id, role, people:person_id ( name, email, phone, title ) )
        `)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      // Polymorphic lookups (no FK) — fetched in parallel
      const [phonesRes, emailsRes, dealsRes] = await Promise.all([
        supabase
          .from('entity_phones')
          .select('entity_id, phone_number, is_primary')
          .eq('entity_type', 'companies'),
        supabase
          .from('entity_emails')
          .select('entity_id, email, is_primary')
          .eq('entity_type', 'companies'),
        supabase.from('potential').select('company_name'),
      ]);

      const phoneByCompany = new Map<string, { phone_number: string; is_primary: boolean | null }[]>();
      (phonesRes.data ?? []).forEach((r: any) => {
        const arr = phoneByCompany.get(r.entity_id) ?? [];
        arr.push({ phone_number: r.phone_number, is_primary: r.is_primary });
        phoneByCompany.set(r.entity_id, arr);
      });

      const emailByCompany = new Map<string, { email: string; is_primary: boolean | null }[]>();
      (emailsRes.data ?? []).forEach((r: any) => {
        const arr = emailByCompany.get(r.entity_id) ?? [];
        arr.push({ email: r.email, is_primary: r.is_primary });
        emailByCompany.set(r.entity_id, arr);
      });

      const dealCountByName = new Map<string, number>();
      (dealsRes.data ?? []).forEach((r: any) => {
        if (!r.company_name) return;
        dealCountByName.set(r.company_name, (dealCountByName.get(r.company_name) ?? 0) + 1);
      });

      return (companies ?? []).map((c: any) => {
        const phones = phoneByCompany.get(c.id) ?? [];
        const emails = emailByCompany.get(c.id) ?? [];
        const primaryPhone =
          phones.find((p) => p.is_primary)?.phone_number ?? phones[0]?.phone_number ?? null;
        const primaryEmail =
          emails.find((e) => e.is_primary)?.email ?? emails[0]?.email ?? null;
        const emailDomain = primaryEmail ? primaryEmail.split('@')[1] ?? null : null;

        const primaryContact =
          (c.company_people ?? []).find((cp: any) => cp.role === 'Primary Contact') ??
          (c.company_people ?? [])[0];
        const contactName = primaryContact?.people?.name ?? null;

        return {
          ...c,
          phone: primaryPhone,
          email_domain: emailDomain,
          contact_name: contactName,
          deals_count: dealCountByName.get(c.company_name) ?? 0,
        } as Company & {
          phone: string | null;
          email_domain: string | null;
          contact_name: string | null;
          deals_count: number;
        };
      });
    },
  });
};

/**
 * Backward-compatible hook that returns people and companies.
 * People are returned with empty pipeline metadata since they're now standalone.
 * Companies are mapped to the DerivedCompany shape.
 */
export const useAllPipelineLeads = () => {
  const peopleQuery = usePeople();
  const companiesQuery = useCompanies();

  const isLoading = peopleQuery.isLoading || companiesQuery.isLoading;
  const error = peopleQuery.error || companiesQuery.error;

  // Map people to PipelinePerson shape for backward compat
  const people: PipelinePerson[] = (peopleQuery.data ?? []).map(p => ({
    ...p,
    _pipelineName: '',
    _stageName: '',
    _stageId: '',
    _pipelineId: '',
    _pipelineLeadId: p.id,
  }));

  // Map companies to DerivedCompany shape for backward compat
  const companies: DerivedCompany[] = (companiesQuery.data ?? []).map((c: any) => ({
    id: c.id,
    company_name: c.company_name,
    contact_name: c.contact_name ?? null,
    phone: c.phone ?? null,
    website: c.website,
    email_domain: c.email_domain ?? null,
    contact_type: c.contact_type,
    tags: c.tags,
    assigned_to: c.assigned_to,
    notes: c.notes,
    source: c.source,
    last_activity_at: c.last_activity_at,
    known_as: null,
    clx_file_name: null,
    bank_relationships: null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    deals_count: c.deals_count ?? 0,
  }));

  return {
    isLoading,
    error,
    data: null,
    people,
    companies,
    refetch: () => {
      peopleQuery.refetch();
      companiesQuery.refetch();
    },
  };
};
