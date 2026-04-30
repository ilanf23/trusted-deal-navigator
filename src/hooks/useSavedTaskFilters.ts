import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type {
  SavedTaskFilter,
  SavedTaskFilterInput,
  TaskFilterCriteria,
  FilterVisibility,
} from '@/components/employee/tasks/savedFilters/types';
import { toast } from 'sonner';

interface RawSavedFilterRow {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  criteria: unknown;
  created_by: string | null;
  position: number;
  created_at: string | null;
  updated_at: string | null;
  creator?: { id: string; name: string | null } | null;
}

const toSavedFilter = (row: RawSavedFilterRow): SavedTaskFilter => ({
  id: row.id,
  name: row.name,
  description: row.description,
  visibility: row.visibility === 'public' ? 'public' : 'private',
  criteria: (row.criteria as TaskFilterCriteria) ?? {},
  createdBy: row.created_by,
  createdByName: row.creator?.name ?? null,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const QUERY_KEY = ['task-saved-filters'] as const;

export const useSavedTaskFilters = () => {
  const { teamMember } = useTeamMember();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const { preferences, update: updatePreferences } = useUserPreferences();

  const teamMemberId = teamMember?.id ?? null;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin' || teamMember?.is_owner === true;

  const { data: filters = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SavedTaskFilter[]> => {
      const { data, error } = await supabase
        .from('task_saved_filters')
        .select('id, name, description, visibility, criteria, created_by, position, created_at, updated_at, creator:users!task_saved_filters_created_by_fkey(id, name)')
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as unknown as RawSavedFilterRow[]).map(toSavedFilter);
    },
  });

  const publicFilters = useMemo(
    () => filters.filter(f => f.visibility === 'public'),
    [filters],
  );
  const privateFilters = useMemo(
    () => filters.filter(f => f.visibility === 'private' && f.createdBy === teamMemberId),
    [filters, teamMemberId],
  );
  const myFilters = useMemo(
    () => filters.filter(f => f.createdBy === teamMemberId),
    [filters, teamMemberId],
  );
  const otherPublicFilters = useMemo(
    () => filters.filter(f => f.visibility === 'public' && f.createdBy !== teamMemberId),
    [filters, teamMemberId],
  );

  const defaultFilterId = (preferences as { default_task_filter_id?: string | null } | undefined)?.default_task_filter_id ?? null;

  const create = useMutation({
    mutationFn: async (input: SavedTaskFilterInput): Promise<SavedTaskFilter> => {
      if (!teamMemberId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('task_saved_filters')
        .insert({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          visibility: input.visibility,
          criteria: input.criteria as never,
          created_by: teamMemberId,
        })
        .select('id, name, description, visibility, criteria, created_by, position, created_at, updated_at')
        .single();
      if (error) throw error;
      return toSavedFilter(data as unknown as RawSavedFilterRow);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Filter "${saved.name}" saved`);
    },
    onError: (err: Error) => toast.error(`Failed to save filter: ${err.message}`),
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<SavedTaskFilterInput> }) => {
      const patch: Record<string, unknown> = {};
      if (args.patch.name !== undefined) patch.name = args.patch.name.trim();
      if (args.patch.description !== undefined) patch.description = args.patch.description?.trim() || null;
      if (args.patch.visibility !== undefined) patch.visibility = args.patch.visibility;
      if (args.patch.criteria !== undefined) patch.criteria = args.patch.criteria;
      const { error } = await supabase.from('task_saved_filters').update(patch).eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Filter updated');
    },
    onError: (err: Error) => toast.error(`Failed to update filter: ${err.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_saved_filters').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (defaultFilterId === id) {
        void updatePreferences.mutateAsync({
          preferences: {
            ...((preferences as Record<string, unknown>) ?? {}),
            default_task_filter_id: null,
          } as never,
        });
      }
      toast.success('Filter deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete filter: ${err.message}`),
  });

  const duplicate = useMutation({
    mutationFn: async (args: { id: string; visibility?: FilterVisibility }) => {
      if (!teamMemberId) throw new Error('Not signed in');
      const original = filters.find(f => f.id === args.id);
      if (!original) throw new Error('Filter not found');
      const visibility = args.visibility ?? 'private';
      const { data, error } = await supabase
        .from('task_saved_filters')
        .insert({
          name: `${original.name} (copy)`,
          description: original.description,
          visibility,
          criteria: original.criteria as never,
          created_by: teamMemberId,
        })
        .select('id, name, description, visibility, criteria, created_by, position, created_at, updated_at')
        .single();
      if (error) throw error;
      return toSavedFilter(data as unknown as RawSavedFilterRow);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Duplicated as "${saved.name}"`);
    },
    onError: (err: Error) => toast.error(`Failed to duplicate filter: ${err.message}`),
  });

  const setDefault = async (id: string | null) => {
    await updatePreferences.mutateAsync({
      preferences: {
        ...((preferences as Record<string, unknown>) ?? {}),
        default_task_filter_id: id,
      } as never,
    });
  };

  const canEdit = (filter: SavedTaskFilter): boolean => {
    if (filter.createdBy && filter.createdBy === teamMemberId) return true;
    if (filter.visibility === 'public' && isAdmin) return true;
    return false;
  };

  const canDelete = canEdit;

  return {
    filters,
    publicFilters,
    privateFilters,
    myFilters,
    otherPublicFilters,
    defaultFilterId,
    isLoading,
    isAdmin,
    create,
    update,
    remove,
    duplicate,
    setDefault,
    canEdit,
    canDelete,
  };
};

export const findFilterById = (filters: SavedTaskFilter[], id: string | null | undefined): SavedTaskFilter | null => {
  if (!id) return null;
  return filters.find(f => f.id === id) ?? null;
};
