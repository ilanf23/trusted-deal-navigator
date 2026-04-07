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
      return {
        type: 'lead',
        lead,
      };
    }

    const person = findPersonForEmail(senderEmail);
    if (person) {
      return { type: 'person', person };
    }

    return { type: 'unknown' };
  }, [findLeadForEmail, findPersonForEmail, isInternalSender]);

  // 1. Auto-create people for unknown senders (standalone — no pipeline assignment)
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
      // Create people as standalone contacts
      const peopleRows = Array.from(unknownEmails.entries()).map(([email, name]) => ({
        name,
        email,
        status: 'initial_review' as const,
        source: 'Gmail',
      }));

      const { error: peopleError } = await supabase
        .from('people')
        .insert(peopleRows)
        .select('id');

      if (peopleError) {
        console.error('[useGmailPeopleSync] Failed to insert people:', peopleError);
      }

      // Mark as processed
      for (const email of unknownEmails.keys()) {
        processedRef.current.add(email);
      }

      queryClient.invalidateQueries({ queryKey: ['gmail-people'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
    };

    syncUnknownSenders();
  }, [allEmails, allLeads, allPeople, findLeadForEmail, findPersonForEmail, isInternalSender, queryClient]);

  // Pipeline backfill removed — people are standalone and not placed in pipelines.

  return {
    allPeople,
    findPersonForEmail,
    isInternalSender,
    getCRMContext,
  };
}
