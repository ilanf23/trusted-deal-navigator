import { createClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getValidGoogleAccessToken } from "../_shared/googleToken.ts";
import { LLM_CHAT_ENDPOINT, LLM_MODEL, LLM_API_KEY_ENV, llmHeaders } from "../_shared/llmConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  leadId: string;
  communicationId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone: string;
  transcript?: string;
  callDirection: string;
  callDate: string;
  teamMemberId?: string;
}

async function createGmailDraft(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const rawEmail = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encodedMessage = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { raw: encodedMessage },
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('Error creating Gmail draft:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, "call-to-lead-automation", 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get(LLM_API_KEY_ENV)!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { leadId, communicationId, leadName, leadEmail, leadPhone, transcript, callDirection, callDate, teamMemberId } = body;

    console.log("Processing call-to-lead automation for:", leadName);

    // Resolve the rep (team member) who owned this call. Prefer the explicit
    // teamMemberId from the request body; fall back to the communication
    // record's user_id when present. Used for: which Gmail account drafts the
    // follow-up, and which name to display in notification copy.
    let repTeamMemberId: string | null = teamMemberId ?? null;
    if (!repTeamMemberId && communicationId) {
      const { data: commRow } = await supabase
        .from('communications')
        .select('user_id')
        .eq('id', communicationId)
        .maybeSingle();
      repTeamMemberId = (commRow?.user_id as string | undefined) ?? null;
    }

    let repName = 'Our team';
    let repAuthUserId: string | null = null;
    if (repTeamMemberId) {
      const { data: rep } = await supabase
        .from('users')
        .select('name, user_id')
        .eq('id', repTeamMemberId)
        .maybeSingle();
      if (rep?.name && (rep.name as string).trim().length > 0) {
        repName = rep.name as string;
      }
      repAuthUserId = (rep?.user_id as string | undefined) ?? null;
    }

    let callSummary = "No transcript available for analysis.";
    let followUpEmailSubject = "";
    let followUpEmailContent = "";

    // Step 1: Use AI to summarize the call transcript and draft a follow-up email
    if (transcript) {
      console.log("Analyzing transcript with AI...");

      const analysisPrompt = `You are a commercial lending sales assistant. Analyze this call transcript and provide:

1. A brief summary of the call (2-3 sentences covering what was discussed and any next steps)
2. A personalized follow-up email based on what was discussed in the call

Call Direction: ${callDirection}
Lead Name: ${leadName}
Transcript:
${transcript}

Respond with a JSON object (no markdown) with these exact fields:
{
  "summary": "<brief summary of the call>",
  "followUpEmail": {
    "subject": "<email subject line>",
    "body": "<email body - professional, warm, and personalized based on the call>"
  }
}`;

      try {
        const aiResponse = await fetch(LLM_CHAT_ENDPOINT, {
          method: "POST",
          headers: llmHeaders(lovableApiKey),
          body: JSON.stringify({
            model: LLM_MODEL,
            messages: [
              { role: "system", content: "You are an expert commercial lending sales assistant. Summarize calls and draft follow-up emails. Always respond with valid JSON only, no markdown." },
              { role: "user", content: analysisPrompt }
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;

          if (content) {
            try {
              // Clean potential markdown code blocks
              const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
              const analysis = JSON.parse(cleanedContent);
              callSummary = analysis.summary || "Analysis completed.";
              followUpEmailSubject = analysis.followUpEmail?.subject || `Following up on our conversation - ${leadName}`;
              followUpEmailContent = analysis.followUpEmail?.body || "";

              console.log("AI analysis complete");
            } catch (parseError) {
              console.error("Failed to parse AI response:", parseError);
            }
          }
        } else {
          console.error("AI Gateway error:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
      }
    }

    // Step 2: Create a follow-up task assigned to the call's rep
    console.log("Creating follow-up task...");
    
    const taskDueDate = new Date();
    taskDueDate.setDate(taskDueDate.getDate() + 1); // Due tomorrow

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: `Follow up with ${leadName}`,
        description: `📞 New lead from call on ${callDate}

**Contact Info:**
- Phone: ${leadPhone}
${leadEmail ? `- Email: ${leadEmail}` : '- No email on file'}

**Call Summary:**
${transcript ? callSummary : 'No transcript available - call was not recorded or transcription pending.'}

**Next Steps:**
1. Review call transcript in Leads section
2. Send personalized follow-up email (draft created in Gmail)
3. Schedule discovery meeting if qualified`,
        priority: 'medium',
        status: 'todo',
        due_date: taskDueDate.toISOString(),
        group_name: 'To Do',
        user_id: repTeamMemberId,
        tags: ['follow-up', 'new-lead', 'phone-call'],
      })
      .select()
      .single();

    if (taskError) {
      console.error("Failed to create task:", taskError);
    } else {
      console.log("Task created:", task.id);

      // Add activity log for the task
      await supabase.from('task_activities').insert({
        task_id: task.id,
        activity_type: 'created',
        content: `Auto-generated from call with ${leadName}`,
        created_by: 'System',
      });
    }

    // Step 3: Create Gmail draft from the call rep's Gmail account if lead has email
    let gmailDraftCreated = false;

    if (followUpEmailContent && leadEmail) {
      if (!repAuthUserId) {
        console.log("No rep auth user id resolved for this call — skipping Gmail draft");
      } else {
        console.log(`Creating Gmail draft for ${repName}...`);

        const gmailCreds = await getValidGoogleAccessToken(supabase, repAuthUserId, 'gmail');

        if (gmailCreds) {
          try {
            gmailDraftCreated = await createGmailDraft(
              gmailCreds.accessToken,
              gmailCreds.email,
              leadEmail,
              followUpEmailSubject,
              followUpEmailContent
            );

            if (gmailDraftCreated) {
              console.log("Gmail draft created successfully");
            }
          } catch (draftError) {
            console.error("Failed to create Gmail draft:", draftError);
          }
        } else {
          console.log(`${repName}'s Gmail not connected - skipping draft creation`);
        }
      }
    }

    // Step 4: Store the follow-up email content in the lead notes
    if (followUpEmailContent && leadEmail) {
      const draftNote = gmailDraftCreated 
        ? '✅ Gmail draft created automatically' 
        : '📧 Email content generated (Gmail not connected)';
        
      const updatedNotes = `📞 Initial call: ${callDate}
📝 Transcript available (Communication ID: ${communicationId})
${draftNote}

📧 **AI-Generated Follow-up Email:**
Subject: ${followUpEmailSubject}

${followUpEmailContent}`;
      
      await supabase
        .from('deals')
        .update({ notes: updatedNotes })
        .eq('id', leadId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        taskId: task?.id,
        followUpEmailGenerated: !!followUpEmailContent,
        gmailDraftCreated,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in call-to-lead-automation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
