import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ActionProposal } from '@/components/ai/actions/ActionCard';

export const useActionExecutor = () => {
  const navigate = useNavigate();

  const executeAction = useCallback(async (
    action: ActionProposal,
    conversationId: string | null,
  ): Promise<{ success: boolean; result: string; changeId?: string }> => {
    const { type, params } = action;

    // Navigate actions are instant, no edge function
    if (type === 'navigate') {
      const target = params.target;
      if (target) {
        navigate(target);
        return { success: true, result: `Navigated to ${target}` };
      }
      return { success: false, result: 'No target specified' };
    }

    // All other actions go through the edge function
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'execute',
            actionType: type,
            params,
            conversationId,
            mode: 'assist',
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Action execution failed');
      }

      const result = await response.json();
      return {
        success: true,
        result: result.description || 'Action completed',
        changeId: result.changeId,
      };
    } catch (error: any) {
      console.error('Action execution error:', error);
      return {
        success: false,
        result: error.message || 'Action failed',
      };
    }
  }, [navigate]);

  const undoBatch = useCallback(async (batchId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'undo_batch',
            batchId,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Undo failed');
      }

      toast.success('Changes undone successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to undo changes');
      return false;
    }
  }, []);

  return { executeAction, undoBatch };
};
