import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GmailEmail, extractEmailAddress, extractSenderName } from '@/components/gmail/gmailHelpers';

export interface Person {
  id: string;
  name: string;
  email: string;
  contact_type: string | null;
  company_name: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  linkedin: string | null;
  source: string | null;
  created_at: string;
  last_activity_at: string | null;
}

export interface CRMContext {
  type: 'lead' | 'person' | 'internal' | 'unknown';
  lead?: any;
  stageName?: string;
  stageColor?: string;
  pipelineName?: string;
  person?: Person;
}

interface UseGmailPeopleSyncOptions {
  allEmails: GmailEmail[];
  allLeads: any[];
  findLeadForEmail: (email: GmailEmail) => any;
}

export function useGmailPeopleSync({ allEmails, allLeads, findLeadForEmail }: UseGmailPeopleSyncOptions) {
  const queryClient = useQueryClient();
  const processedRef = useRef<Set<string>>(new Set());
  const pipelineSyncedRef = useRef<Set<string>>(new Set());

  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ['gmail-people'],
    queryFn: async () => {
      const { data } = await supabase
        .from('people')
        .select('id, name, email, contact_type, company_name, phone, title, notes, tags, linkedin, source, created_at, last_activity_at');
      return (data as Person[]) || [];
    },
  });

  const findPersonForEmail = useCallback((email: string): Person | undefined => {
    const lower = email.toLowerCase();
    return allPeople.find(p => p.email?.toLowerCase() === lower);
  }, [allPeople]);

  const isInternalSender = useCallback((email: string): boolean => {
    return email.toLowerCase().endsWith('@commerciallendingx.com');
  }, []);

  const getCRMContext = useCallback((email: GmailEmail): CRMContext => {
    const senderEmail = extractEmailAddress(email.from);

    if (isInternalSender(senderEmail)) {
      return { type: 'internal' };
    }

    const lead = findLeadForEmail(email);
    if (lead) {
      const pipelineLead = lead.pipeline_leads?.[0];
      return {
        type: 'lead',
        lead,
        stageName: pipelineLead?.pipeline_stages?.name,
        stageColor: pipelineLead?.pipeline_stages?.color,
        pipelineName: pipelineLead?.pipelines?.name,
      };
    }

    const person = findPersonForEmail(senderEmail);
    if (person) {
      return { type: 'person', person };
    }

    return { type: 'unknown' };
  }, [findLeadForEmail, findPersonForEmail, isInternalSender]);

  // Helper: look up default pipeline + first stage
  const getDefaultPipelineStage = async () => {
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('is_main', true)
      .maybeSingle();
    if (!pipeline) return null;

    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!stage) return null;

    return { pipelineId: pipeline.id, stageId: stage.id };
  };

  // 1. Auto-create people + leads + pipeline_leads for unknown senders
  useEffect(() => {
    if (allEmails.length === 0 || allLeads.length === 0) return;

    const unknownEmails = new Map<string, string>(); // email -> sender name

    for (const email of allEmails) {
      const senderEmail = extractEmailAddress(email.from);
      if (!senderEmail) continue;
      if (processedRef.current.has(senderEmail)) continue;
      if (isInternalSender(senderEmail)) continue;

      const lead = findLeadForEmail(email);
      if (lead) {
        processedRef.current.add(senderEmail);
        continue;
      }

      const person = findPersonForEmail(senderEmail);
      if (person) {
        processedRef.current.add(senderEmail);
        continue;
      }

      unknownEmails.set(senderEmail, extractSenderName(email.from));
    }

    if (unknownEmails.size === 0) return;

    const syncUnknownSenders = async () => {
      // Insert into people table
      const peopleRows = Array.from(unknownEmails.entries()).map(([email, name]) => ({
        name,
        email,
        contact_type: 'Prospect',
        source: 'gmail',
      }));

      const { error: peopleError } = await supabase.from('people').insert(peopleRows);
      if (peopleError) {
        console.error('[useGmailPeopleSync] Failed to insert people:', peopleError);
      }

      // Also create leads so they appear in pipeline
      const defaults = await getDefaultPipelineStage();

      const leadRows = Array.from(unknownEmails.entries()).map(([email, name]) => ({
        name,
        email,
        status: 'initial_review' as const,
        source: 'Gmail',
      }));

      const { data: insertedLeads, error: leadsError } = await supabase
        .from('leads')
        .insert(leadRows)
        .select('id');

      if (leadsError) {
        console.error('[useGmailPeopleSync] Failed to insert leads:', leadsError);
      }

      // Add to default pipeline
      if (insertedLeads && insertedLeads.length > 0 && defaults) {
        const pipelineRows = insertedLeads.map((lead: { id: string }) => ({
          lead_id: lead.id,
          pipeline_id: defaults.pipelineId,
          stage_id: defaults.stageId,
        }));

        const { error: plError } = await supabase.from('pipeline_leads').insert(pipelineRows);
        if (plError) {
          console.error('[useGmailPeopleSync] Failed to insert pipeline_leads:', plError);
        }
      }

      // Mark as processed
      for (const email of unknownEmails.keys()) {
        processedRef.current.add(email);
      }

      queryClient.invalidateQueries({ queryKey: ['gmail-people'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
    };

    syncUnknownSenders();
  }, [allEmails, allLeads, allPeople, findLeadForEmail, findPersonForEmail, isInternalSender, queryClient]);

  // 2. Backfill: ensure existing leads matched from Gmail have a pipeline_leads entry
  useEffect(() => {
    if (allEmails.length === 0 || allLeads.length === 0) return;

    const leadsWithoutPipeline: string[] = [];

    for (const email of allEmails) {
      const senderEmail = extractEmailAddress(email.from);
      if (!senderEmail || isInternalSender(senderEmail)) continue;

      const lead = findLeadForEmail(email);
      if (!lead) continue;
      if (pipelineSyncedRef.current.has(lead.id)) continue;

      // Check if this lead already has a pipeline_leads entry
      const hasPipeline = lead.pipeline_leads && lead.pipeline_leads.length > 0;
      pipelineSyncedRef.current.add(lead.id);

      if (!hasPipeline) {
        leadsWithoutPipeline.push(lead.id);
      }
    }

    if (leadsWithoutPipeline.length === 0) return;

    const backfillPipelineLeads = async () => {
      const defaults = await getDefaultPipelineStage();
      if (!defaults) return;

      const rows = leadsWithoutPipeline.map(leadId => ({
        lead_id: leadId,
        pipeline_id: defaults.pipelineId,
        stage_id: defaults.stageId,
      }));

      const { error } = await supabase.from('pipeline_leads').insert(rows);
      if (error) {
        console.error('[useGmailPeopleSync] Failed to backfill pipeline_leads:', error);
        return;
      }

      console.log(`[useGmailPeopleSync] Backfilled ${rows.length} leads into default pipeline`);
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
    };

    backfillPipelineLeads();
  }, [allEmails, allLeads, findLeadForEmail, isInternalSender, queryClient]);

  return {
    allPeople,
    findPersonForEmail,
    isInternalSender,
    getCRMContext,
  };
}
