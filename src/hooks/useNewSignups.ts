import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NewSignup {
  id: string;
  client_name: string;
  client_email: string | null;
  company_name: string | null;
  source: string | null;
  signed_up_at: string;
  notes: string | null;
  created_at: string;
}

export const useNewSignups = () => {
  return useQuery({
    queryKey: ['new-signups-this-week'],
    queryFn: async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase as any)
        .from('new_signups')
        .select('*')
        .gte('signed_up_at', monday.toISOString())
        .order('signed_up_at', { ascending: false });

      if (error) throw error;
      return data as NewSignup[];
    },
  });
};
