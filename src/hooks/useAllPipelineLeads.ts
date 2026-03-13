import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface PipelineLeadJoin {
  id: string;
  pipeline_id: string;
  lead_id: string;
  stage_id: string;
  added_at: string;
  updated_at: string;
  lead: Lead;
  stage: { id: string; name: string; position: number; color: string | null; pipeline_id: string };
  pipeline: { id: string; name: string };
}

export interface PipelinePerson extends Lead {
  _pipelineName: string;
  _stageName: string;
  _stageId: string;
  _pipelineId: string;
  _pipelineLeadId: string;
}

export interface DerivedCompany {
  id: string; // first lead's ID (used as companyId for routing)
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
  created_at: string;
  updated_at: string;
  deals_count: number;
}

export const useAllPipelineLeads = () => {
  const query = useQuery({
    queryKey: ['all-pipeline-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_leads')
        .select('*, lead:leads(*), stage:pipeline_stages(*), pipeline:pipelines(id, name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PipelineLeadJoin[];
    },
  });

  // Deduplicated people: one row per lead_id, keeping most recent pipeline_lead
  const people = useMemo<PipelinePerson[]>(() => {
    if (!query.data) return [];
    const seen = new Map<string, PipelineLeadJoin>();
    for (const pl of query.data) {
      if (!pl.lead) continue;
      const existing = seen.get(pl.lead_id);
      if (!existing || new Date(pl.updated_at) > new Date(existing.updated_at)) {
        seen.set(pl.lead_id, pl);
      }
    }
    return Array.from(seen.values()).map(pl => ({
      ...pl.lead,
      _pipelineName: pl.pipeline?.name ?? '',
      _stageName: pl.stage?.name ?? '',
      _stageId: pl.stage_id,
      _pipelineId: pl.pipeline_id,
      _pipelineLeadId: pl.id,
    }));
  }, [query.data]);

  // Companies: aggregated by company_name
  const companies = useMemo<DerivedCompany[]>(() => {
    if (people.length === 0) return [];
    const grouped = new Map<string, PipelinePerson[]>();
    for (const p of people) {
      const cn = p.company_name?.trim();
      if (!cn) continue;
      const arr = grouped.get(cn) || [];
      arr.push(p);
      grouped.set(cn, arr);
    }

    return Array.from(grouped.entries()).map(([companyName, leads]) => {
      // Primary lead = first lead (most recently updated due to sort)
      const primary = leads[0];

      // Extract email domain from first lead that has an email
      let emailDomain: string | null = null;
      for (const l of leads) {
        if (l.email) {
          const parts = l.email.split('@');
          if (parts.length === 2) {
            emailDomain = parts[1];
            break;
          }
        }
      }

      // Most common contact_type
      const typeCounts = new Map<string, number>();
      for (const l of leads) {
        const t = l.contact_type ?? 'Other';
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
      let mostCommonType = 'Other';
      let maxCount = 0;
      for (const [t, c] of typeCounts) {
        if (c > maxCount) { mostCommonType = t; maxCount = c; }
      }

      // Union of tags
      const tagSet = new Set<string>();
      for (const l of leads) {
        if (l.tags) for (const t of l.tags) tagSet.add(t);
      }

      // Max last_activity_at
      let maxActivity: string | null = null;
      for (const l of leads) {
        if (l.last_activity_at && (!maxActivity || l.last_activity_at > maxActivity)) {
          maxActivity = l.last_activity_at;
        }
      }

      return {
        id: primary.id,
        company_name: companyName,
        contact_name: primary.name,
        phone: primary.phone,
        website: primary.website,
        email_domain: emailDomain,
        contact_type: mostCommonType,
        tags: tagSet.size > 0 ? Array.from(tagSet) : null,
        assigned_to: primary.assigned_to,
        notes: primary.notes,
        source: primary.source,
        last_activity_at: maxActivity,
        created_at: primary.created_at,
        updated_at: primary.updated_at,
        deals_count: leads.length,
      };
    });
  }, [people]);

  return { ...query, people, companies };
};
