import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ... keep existing code (interfaces and helper functions through line 153)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = enforceRateLimit(req, "call-to-lead-automation", 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: RequestBody = await req.json();
    const { leadId, communicationId, leadName, leadEmail, leadPhone, transcript, callDirection, callDate } = body;

    console.log("Processing call-to-lead automation for:", leadName);

    let callRating = 5;
    let ratingReasoning = "No transcript available for analysis.";
    let followUpEmailSubject = "";
    let followUpEmailContent = "";

    // Step 1: Use AI to analyze the call transcript and generate rating + follow-up email
    if (transcript) {
      console.log("Analyzing transcript with AI...");
      
      const analysisPrompt = `You are a commercial lending sales coach. Analyze this call transcript and provide:

1. A rating from 1-10 for the call quality (consider rapport building, needs discovery, professionalism, objection handling, and next steps)
2. A detailed reasoning for the rating (2-3 sentences)
3. A personalized follow-up email based on what was discussed in the call

Call Direction: ${callDirection}
Lead Name: ${leadName}
Transcript:
${transcript}

Respond with a JSON object (no markdown) with these exact fields:
{
  "rating": <number 1-10>,
  "reasoning": "<detailed reasoning>",
  "followUpEmail": {
    "subject": "<email subject line>",
    "body": "<email body - professional, warm, and personalized based on the call>"
  }
}`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are an expert commercial lending sales coach. Analyze calls and provide constructive feedback. Always respond with valid JSON only, no markdown." },
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
              callRating = analysis.rating || 5;
              ratingReasoning = analysis.reasoning || "Analysis completed.";
              followUpEmailSubject = analysis.followUpEmail?.subject || `Following up on our conversation - ${leadName}`;
              followUpEmailContent = analysis.followUpEmail?.body || "";
              
              console.log("AI Analysis complete - Rating:", callRating);
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

    // Step 2: Create a follow-up task in Evan's Tasks
    console.log("Creating follow-up task...");
    
    const taskDueDate = new Date();
    taskDueDate.setDate(taskDueDate.getDate() + 1); // Due tomorrow

    const { data: task, error: taskError } = await supabase
      .from('evan_tasks')
      .insert({
        title: `Follow up with ${leadName}`,
        description: `📞 New lead from call on ${callDate}

**Contact Info:**
- Phone: ${leadPhone}
${leadEmail ? `- Email: ${leadEmail}` : '- No email on file'}

**Call Summary:**
${transcript ? ratingReasoning : 'No transcript available - call was not recorded or transcription pending.'}

**Next Steps:**
1. Review call transcript in Leads section
2. Send personalized follow-up email (draft created in Gmail)
3. Schedule discovery meeting if qualified`,
        priority: callRating >= 7 ? 'high' : callRating >= 5 ? 'medium' : 'low',
        status: 'todo',
        due_date: taskDueDate.toISOString(),
        group_name: 'To Do',
        assignee_name: 'Evan',
        tags: ['follow-up', 'new-lead', 'phone-call'],
      })
      .select()
      .single();

    if (taskError) {
      console.error("Failed to create task:", taskError);
    } else {
      console.log("Task created:", task.id);

      // Add activity log for the task
      await supabase.from('evan_task_activities').insert({
        task_id: task.id,
        activity_type: 'created',
        content: `Auto-generated from call with ${leadName}`,
        created_by: 'System',
      });
    }

    // Step 3: Create Gmail draft for Evan if lead has email
    let gmailDraftCreated = false;
    
    if (followUpEmailContent && leadEmail) {
      console.log("Creating Gmail draft for Evan...");
      
      const gmailCreds = await getEvanGmailAccessToken(supabase);
      
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
        console.log("Evan's Gmail not connected - skipping draft creation");
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
        .from('leads')
        .update({ notes: updatedNotes })
        .eq('id', leadId);
    }

    // Step 5: Send rating notification email to Adam and Brad
    console.log("Sending rating notification to Adam and Brad...");

    const ratingEmoji = callRating >= 8 ? '🌟' : callRating >= 6 ? '👍' : callRating >= 4 ? '📊' : '⚠️';
    const ratingColor = callRating >= 8 ? '#22c55e' : callRating >= 6 ? '#3b82f6' : callRating >= 4 ? '#f59e0b' : '#ef4444';

    const notificationHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: 0; }
    .rating-box { background: white; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .rating-number { font-size: 48px; font-weight: bold; color: ${ratingColor}; }
    .rating-label { color: #64748b; font-size: 14px; }
    .details { background: white; border-radius: 8px; padding: 15px; margin-top: 15px; }
    .label { font-weight: 600; color: #475569; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
    .draft-badge { display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${ratingEmoji} New Call Rating</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Evan just completed a call with a new lead</p>
    </div>
    <div class="content">
      <div class="rating-box">
        <div class="rating-number">${callRating}/10</div>
        <div class="rating-label">Call Quality Score</div>
        ${gmailDraftCreated ? '<div class="draft-badge">✉️ Gmail Draft Created</div>' : ''}
      </div>
      
      <div class="details">
        <p><span class="label">Lead Name:</span> ${leadName}</p>
        <p><span class="label">Phone:</span> ${leadPhone}</p>
        ${leadEmail ? `<p><span class="label">Email:</span> ${leadEmail}</p>` : ''}
        <p><span class="label">Call Date:</span> ${callDate}</p>
        <p><span class="label">Direction:</span> ${callDirection === 'inbound' ? '📥 Inbound' : '📤 Outbound'}</p>
      </div>

      <div class="details" style="margin-top: 15px;">
        <p><span class="label">AI Analysis:</span></p>
        <p style="color: #475569;">${ratingReasoning}</p>
      </div>

      ${transcript ? `
      <div class="details" style="margin-top: 15px;">
        <p><span class="label">Transcript Preview:</span></p>
        <p style="color: #64748b; font-size: 13px; white-space: pre-wrap; max-height: 200px; overflow: hidden;">${transcript.substring(0, 500)}${transcript.length > 500 ? '...' : ''}</p>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>CommercialLendingX CRM - Automated Call Analysis</p>
    </div>
  </div>
</body>
</html>`;

    // Step 6: Save notification to database for in-app viewing
    console.log("Saving call rating notification to database...");
    
    const { data: notification, error: notificationError } = await supabase
      .from('call_rating_notifications')
      .insert({
        lead_id: leadId,
        communication_id: communicationId,
        lead_name: leadName,
        lead_phone: leadPhone,
        lead_email: leadEmail,
        call_date: callDate,
        call_direction: callDirection,
        call_rating: callRating,
        rating_reasoning: ratingReasoning,
        transcript_preview: transcript ? transcript.substring(0, 500) : null,
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Failed to save notification:", notificationError);
    } else {
      console.log("Notification saved:", notification.id);
    }

    // Send to Adam and Brad via email
    const ILAN_EMAIL = Deno.env.get("ILAN_EMAIL") || "ilan@maverich.ai";
    const ADAM_EMAIL = Deno.env.get("ADAM_EMAIL") || "adam@company.com";
    const recipients = [ADAM_EMAIL, ILAN_EMAIL];

    try {
      const emailResult = await resend.emails.send({
        from: "CLX CRM <onboarding@resend.dev>",
        to: recipients,
        subject: `${ratingEmoji} Evan's Call Rating: ${callRating}/10 - ${leadName}`,
        html: notificationHtml,
      });

      console.log("Rating notification sent:", emailResult);
    } catch (emailError) {
      console.error("Failed to send rating email:", emailError);
    }

    // Step 7: Send rating notification to Slack
    console.log("Sending rating notification to Slack...");
    
    const slackBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${ratingEmoji} New Call Rating: ${callRating}/10`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Lead:*\n${leadName}` },
          { type: "mrkdwn", text: `*Phone:*\n${leadPhone}` },
          { type: "mrkdwn", text: `*Direction:*\n${callDirection === 'inbound' ? '📥 Inbound' : '📤 Outbound'}` },
          { type: "mrkdwn", text: `*Date:*\n${callDate}` }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*AI Analysis:*\n${ratingReasoning}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${gmailDraftCreated ? '✉️ Gmail draft created' : ''} ${task ? '✅ Follow-up task created' : ''}`
          }
        ]
      }
    ];

    try {
      const slackResponse = await fetch(`${supabaseUrl}/functions/v1/slack-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message: `${ratingEmoji} Evan's Call Rating: ${callRating}/10 - ${leadName}`,
          blocks: slackBlocks,
        }),
      });

      if (slackResponse.ok) {
        console.log("Slack notification sent successfully");
      } else {
        const slackError = await slackResponse.text();
        console.error("Slack notification failed:", slackError);
      }
    } catch (slackError) {
      console.error("Failed to send Slack notification:", slackError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        callRating,
        ratingReasoning,
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