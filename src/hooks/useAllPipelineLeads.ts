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

/** Fetch all companies from the companies table */
export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Company[];
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
  const companies: DerivedCompany[] = (companiesQuery.data ?? []).map(c => ({
    id: c.id,
    company_name: c.company_name,
    contact_name: null,
    phone: null,
    website: c.website,
    email_domain: null,
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
    deals_count: 0,
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
