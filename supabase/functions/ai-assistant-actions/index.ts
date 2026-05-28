import { getRequestClients } from '../_shared/userClient.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { executeAction, undoChange, redoChange } from '../_shared/aiAgent/executor.ts';
import { logAiAudit } from '../_shared/aiAgent/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-actions', 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const { action } = body;
    const { userClient, serviceClient } = getRequestClients(req);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, userClient);

    // === Single action execution (Assist mode confirms) ===
    if (action === 'execute') {
      const { actionType, params, conversationId, mode = 'assist' } = body;

      // Create a batch for single actions too (gracefully handle missing table)
      let batch: { id: string } | null = null;
      try {
        const { data } = await serviceClient
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
        serviceClient,
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

      await logAiAudit({
        serviceClient,
        userId: authUserId,
        conversationId: body.conversationId ?? null,
        functionName: 'ai-assistant-actions',
        tool: action,
        scope: { actionType: body.actionType },
        recordIds: result?.changeId ? [result.changeId] : [],
        mode: body.mode ?? 'agent',
        success: result?.success ?? true,
        errorMessage: result?.success === false ? result.description : undefined,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Undo single change ===
    if (action === 'undo') {
      const result = await undoChange(serviceClient, body.changeId, authUserId, isOwner);

      await logAiAudit({
        serviceClient,
        userId: authUserId,
        conversationId: body.conversationId ?? null,
        functionName: 'ai-assistant-actions',
        tool: action,
        scope: { changeId: body.changeId },
        recordIds: result?.changeId ? [result.changeId] : [],
        mode: body.mode ?? 'agent',
        success: result?.success ?? true,
        errorMessage: result?.success === false ? (result as any).description : undefined,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Redo single change ===
    if (action === 'redo') {
      const result = await redoChange(serviceClient, body.changeId, authUserId, isOwner);

      await logAiAudit({
        serviceClient,
        userId: authUserId,
        conversationId: body.conversationId ?? null,
        functionName: 'ai-assistant-actions',
        tool: action,
        scope: { changeId: body.changeId },
        recordIds: [],
        mode: body.mode ?? 'agent',
        success: result?.success ?? true,
        errorMessage: result?.success === false ? (result as any).description : undefined,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Undo entire batch ===
    if (action === 'undo_batch') {
      const { batchId } = body;

      const { data: batch } = await serviceClient
        .from('ai_agent_batches')
        .select('user_id')
        .eq('id', batchId)
        .single();

      if (!isOwner && batch?.user_id !== authUserId) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: cannot undo another user\'s batch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: changes } = await serviceClient
        .from('ai_agent_changes')
        .select('id')
        .eq('batch_id', batchId)
        .in('status', ['applied', 'redone'])
        .order('batch_order', { ascending: false });

      let undone = 0;
      for (const change of (changes || [])) {
        try {
          await undoChange(serviceClient, change.id, authUserId, isOwner);
          undone++;
        } catch (e) {
          console.error(`Failed to undo change ${change.id}:`, e);
        }
      }

      // Update batch status
      await serviceClient
        .from('ai_agent_batches')
        .update({
          status: undone === (changes?.length || 0) ? 'fully_undone' : 'partially_undone',
        })
        .eq('id', batchId);

      const result = { success: true, undone, total: changes?.length || 0 };

      await logAiAudit({
        serviceClient,
        userId: authUserId,
        conversationId: body.conversationId ?? null,
        functionName: 'ai-assistant-actions',
        tool: action,
        scope: { batchId: body.batchId },
        recordIds: [],
        mode: body.mode ?? 'agent',
        success: true,
      });

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('ai-assistant-actions error:', error);
    try {
      const { serviceClient } = getRequestClients(req);
      await logAiAudit({
        serviceClient,
        userId: '00000000-0000-0000-0000-000000000000',
        functionName: 'ai-assistant-actions',
        tool: 'actions_run',
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch { /* never fail the response on audit error */ }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
