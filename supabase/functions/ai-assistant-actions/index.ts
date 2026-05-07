import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { executeAction, undoChange, redoChange } from '../_shared/aiAgent/executor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-actions', 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, supabase);

    // === Single action execution (Assist mode confirms) ===
    if (action === 'execute') {
      const { actionType, params, conversationId, mode = 'assist' } = body;

      // Create a batch for single actions too (gracefully handle missing table)
      let batch: { id: string } | null = null;
      try {
        const { data } = await supabase
          .from('ai_agent_batches')
          .insert({
            conversation_id: conversationId,
            user_id: authUserId,
            mode,
            prompt_summary: `${actionType}: ${params?.label || ''}`,
            total_changes: 1,
          })
          .select('id')
          .single();
        batch = data;
      } catch (e) {
        console.warn('Could not create batch:', e);
      }

      const result = await executeAction(
        supabase,
        actionType,
        params,
        authUserId,
        teamMember?.id || null,
        conversationId,
        mode,
        batch?.id || null,
        0,
        isOwner,
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Undo single change ===
    if (action === 'undo') {
      const result = await undoChange(supabase, body.changeId, authUserId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Redo single change ===
    if (action === 'redo') {
      const result = await redoChange(supabase, body.changeId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Undo entire batch ===
    if (action === 'undo_batch') {
      const { batchId } = body;
      const { data: changes } = await supabase
        .from('ai_agent_changes')
        .select('id')
        .eq('batch_id', batchId)
        .in('status', ['applied', 'redone'])
        .order('batch_order', { ascending: false });

      let undone = 0;
      for (const change of (changes || [])) {
        try {
          await undoChange(supabase, change.id, authUserId);
          undone++;
        } catch (e) {
          console.error(`Failed to undo change ${change.id}:`, e);
        }
      }

      // Update batch status
      await supabase
        .from('ai_agent_batches')
        .update({
          status: undone === (changes?.length || 0) ? 'fully_undone' : 'partially_undone',
        })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({ success: true, undone, total: changes?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('ai-assistant-actions error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
