import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh token');
  }

  return response.json();
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: connection, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !connection) {
    throw new Error('Gmail not connected');
  }

  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing access token...');
    const tokens = await refreshAccessToken(connection.refresh_token);
    
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    
    await supabase
      .from('gmail_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq('user_id', userId);

    return tokens.access_token;
  }

  return connection.access_token;
}

async function handleOAuthCallback(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const redirectUri = url.searchParams.get('redirect_uri');

  if (!code || !redirectUri) {
    return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('OAuth token exchange error:', error);
    return new Response(JSON.stringify({ error: 'Failed to exchange code for tokens' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokens: TokenResponse = await tokenResponse.json();
  
  // Get user's email from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const userInfo = await userInfoResponse.json();
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Store tokens in database
  const { error: upsertError } = await supabase
    .from('gmail_connections')
    .upsert({
      user_id: userId,
      email: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokenExpiry.toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('Error storing tokens:', upsertError);
    return new Response(JSON.stringify({ error: 'Failed to store tokens' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, email: userInfo.email }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listMessages(accessToken: string, query: string = '', maxResults: number = 20, pageToken?: string) {
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (query) url += `&q=${encodeURIComponent(query)}`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gmail API error (list):', error);
    throw new Error('Failed to fetch messages');
  }

  return response.json();
}

function decodeBase64UrlToUtf8(data: string): string {
  // Gmail returns base64url without padding
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = base64.length % 4;
  const padded = padLen ? base64 + '='.repeat(4 - padLen) : base64;

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

// Cache for sender profile photos to avoid repeated API calls
const senderPhotoCache = new Map<string, string | null>();

async function getSenderPhoto(accessToken: string, email: string): Promise<string | null> {
  // Check cache first
  if (senderPhotoCache.has(email)) {
    return senderPhotoCache.get(email) || null;
  }

  try {
    // Use Gmail API to get profile - check if sender has a Google profile photo
    // First try People API with email as resourceName
    const response = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]?.person?.photos?.[0]?.url) {
        const photoUrl = data.results[0].person.photos[0].url;
        senderPhotoCache.set(email, photoUrl);
        return photoUrl;
      }
    }

    // Cache null to avoid re-fetching
    senderPhotoCache.set(email, null);
    return null;
  } catch (error) {
    console.warn(`Failed to fetch photo for ${email}:`, error);
    senderPhotoCache.set(email, null);
    return null;
  }
}

async function getMessage(accessToken: string, messageId: string, fetchPhoto: boolean = false): Promise<any | null> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch message ${messageId}: ${response.status}`);
      return null; // Return null for inaccessible messages instead of throwing
    }

    const message = await response.json();
    
    // Parse headers safely
    const headers: Record<string, string> = {};
    if (message.payload?.headers) {
      message.payload.headers.forEach((h: { name: string; value: string }) => {
        headers[h.name.toLowerCase()] = h.value;
      });
    }

    // Get body content (prefer HTML if available) and collect attachments
    let plainBody = '';
    let htmlBody = '';
    const attachments: { id: string; name: string; type: string; size: number; messageId: string }[] = [];

    function extractParts(part: any) {
      const mimeType = part?.mimeType;
      const data = part?.body?.data;
      const attachmentId = part?.body?.attachmentId;
      const filename = part?.filename;

      // Attachment: has an attachmentId or a filename with size > 0
      if (attachmentId || (filename && part?.body?.size > 0)) {
        attachments.push({
          id: attachmentId || '',
          name: filename || 'untitled',
          type: mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          messageId: message.id,
        });
      } else if (mimeType === 'text/html' && data && !htmlBody) {
        try {
          htmlBody = decodeBase64UrlToUtf8(data);
        } catch {
          console.warn('Failed to decode HTML body');
        }
      } else if (mimeType === 'text/plain' && data && !plainBody) {
        try {
          plainBody = decodeBase64UrlToUtf8(data);
        } catch {
          console.warn('Failed to decode plain text body');
        }
      }

      if (part?.parts) {
        part.parts.forEach(extractParts);
      }
    }
    
    if (message.payload?.body?.data) {
      try {
        // Top-level body could be text/plain or text/html depending on the message
        const decoded = decodeBase64UrlToUtf8(message.payload.body.data);
        if (message.payload?.mimeType === 'text/html') htmlBody = htmlBody || decoded;
        else plainBody = plainBody || decoded;
      } catch {
        console.warn('Failed to decode message body');
      }
    }

    if (message.payload) {
      extractParts(message.payload);
    }

    // Extract sender email for photo lookup
    const fromHeader = headers.from || '';
    const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<]+@[^\s>]+)/);
    const senderEmail = emailMatch ? emailMatch[1] : fromHeader;
    
    // Fetch sender photo if requested
    let senderPhoto: string | null = null;
    if (fetchPhoto && senderEmail) {
      senderPhoto = await getSenderPhoto(accessToken, senderEmail);
    }

    return {
      id: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds || [],
      snippet: message.snippet || '',
      from: headers.from || '',
      to: headers.to || '',
      cc: headers.cc || '',
      bcc: headers.bcc || '',
      subject: headers.subject || '(No Subject)',
      date: headers.date || '',
      body: htmlBody || plainBody,
      isUnread: message.labelIds?.includes('UNREAD'),
      senderPhoto,
      attachments,
    };
  } catch (error) {
    console.error(`Error fetching message ${messageId}:`, error);
    return null; // Return null on any error instead of crashing
  }
}

// Helper function to encode UTF-8 string to base64url
function encodeBase64Url(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper to create a multipart MIME message with attachments
// Format email body to ensure it renders reliably in Gmail while preserving spacing/indents.
// - If the editor provides HTML, we keep it.
// - If it's plain text, we escape it and convert newlines to <br>, while using pre-wrap to preserve spacing.
function formatEmailBody(body: string): string {
  const raw = (body ?? '');
  if (raw.trim() === '') {
    // Avoid totally-empty HTML bodies (some clients can render them oddly)
    return '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">&nbsp;</div>';
  }

  // Only treat as HTML if it contains common HTML tags the editor outputs.
  // This avoids false positives for strings like "2 < 3".
  const looksLikeHtml = /<\/?(div|p|br|span|b|strong|i|em|u|ul|ol|li|table|thead|tbody|tr|td|h[1-6])\b/i.test(raw);

  if (looksLikeHtml) {
    return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333;">${raw}</div>`;
  }

  // Plain text: escape and preserve formatting.
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert newlines to <br> but keep pre-wrap for indentation/spaces.
  const withBreaks = escaped
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>\r\n');

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333; white-space: pre-wrap;">${withBreaks}</div>`;
}

function createMimeMessage(
  to: string, 
  subject: string, 
  body: string, 
  attachments?: { filename: string; mimeType: string; data: string }[],
  threadId?: string,
  inReplyTo?: string,
  flowId?: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // Format the body for proper HTML rendering
  const formattedBody = formatEmailBody(body);
  
  console.log(`[${flowId}] createMimeMessage - formattedBody length: ${formattedBody.length}, preview: ${formattedBody.substring(0, 100)}`);
  
  // Build headers array - NEVER filter out empty strings as they create required blank lines
  const headers: string[] = [
    'From: me',
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  
  // Add reply headers if this is a reply
  if (inReplyTo) {
    headers.push(`In-Reply-To: <${inReplyTo}>`);
    headers.push(`References: <${inReplyTo}>`);
  }
  
  headers.push('MIME-Version: 1.0');
  
// If no attachments, use simple format
  if (!attachments || attachments.length === 0) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 8bit');
    
    // CRITICAL: Join headers, add blank line, then body
    // The blank line (\r\n\r\n) separates headers from body per RFC 5322
    const headersStr = headers.join('\r\n');
    const email = headersStr + '\r\n\r\n' + formattedBody;
    
    console.log(`[${flowId}] MIME simple message constructed:`, {
      headersLength: headersStr.length,
      bodyLength: formattedBody.length,
      totalLength: email.length,
      firstHeaderLine: headers[0],
      lastHeaderLine: headers[headers.length - 1],
    });
    
    return email;
  }
  
  // Multipart message with attachments
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  
  const headersStr = headers.join('\r\n');
  
  // Build multipart body
  let multipartBody = '';
  
// First part: HTML body
  multipartBody += `--${boundary}\r\n`;
  multipartBody += 'Content-Type: text/html; charset="UTF-8"\r\n';
  multipartBody += 'Content-Transfer-Encoding: 8bit\r\n';
  multipartBody += '\r\n'; // Blank line before body
  multipartBody += formattedBody + '\r\n';
  
  // Add each attachment
  for (const attachment of attachments) {
    multipartBody += `--${boundary}\r\n`;
    multipartBody += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
    multipartBody += 'Content-Transfer-Encoding: base64\r\n';
    multipartBody += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    multipartBody += '\r\n'; // Blank line before body
    multipartBody += attachment.data.replace(/(.{76})/g, '$1\r\n') + '\r\n';
  }
  
  // Close the boundary
  multipartBody += `--${boundary}--\r\n`;
  
  // CRITICAL: Headers + blank line + multipart body
  const email = headersStr + '\r\n\r\n' + multipartBody;
  
  console.log(`[${flowId}] MIME multipart message - total length: ${email.length}`);
  
  return email;
}

async function sendMessage(
  accessToken: string, 
  to: string, 
  subject: string, 
  body: string, 
  threadId?: string, 
  inReplyTo?: string,
  attachments?: { filename: string; mimeType: string; data: string }[],
  flowId?: string
): Promise<{ id: string; threadId: string; verified: boolean; verificationDetails?: any }> {
  const fid = flowId || `flow_${Date.now()}`;
  
  // HARD FAIL: Validate body is not empty
  const bodyTrimmed = (body || '').trim();
  if (bodyTrimmed.length === 0) {
    console.error(`[${fid}] HARD FAIL: body is empty`);
    throw new Error(`Move Forward failed: email body was empty. See flow_id: ${fid}`);
  }
  
  console.log(`[${fid}] sendMessage - input validation passed:`, {
    to,
    subject,
    bodyLength: body.length,
    bodyPreview: body.substring(0, 200),
    threadId: threadId || null,
    inReplyTo: inReplyTo || null,
    hasAttachments: !!attachments?.length,
  });
  
  const email = createMimeMessage(to, subject, body, attachments, threadId, inReplyTo, fid);
  
  // HARD FAIL: Validate MIME body section is not too short
  // The body should be at least 20 chars after we strip headers
  const blankLineIndex = email.indexOf('\r\n\r\n');
  const mimeBodySection = blankLineIndex > -1 ? email.substring(blankLineIndex + 4) : '';
  
  console.log(`[${fid}] MIME structure:`, {
    totalLength: email.length,
    blankLineIndex,
    bodyPartLength: mimeBodySection.length,
    bodyPartPreview: mimeBodySection.substring(0, 100),
  });
  
  if (mimeBodySection.length < 20) {
    console.error(`[${fid}] HARD FAIL: MIME body section too short (${mimeBodySection.length} chars)`);
    throw new Error(`Move Forward failed: MIME body too short. See flow_id: ${fid}`);
  }
  
  const encodedEmail = encodeBase64Url(email);
  
  // HARD FAIL: Validate base64url encoding is not empty
  if (!encodedEmail || encodedEmail.length < 50) {
    console.error(`[${fid}] HARD FAIL: base64url encoding too short (${encodedEmail?.length || 0} chars)`);
    throw new Error(`Move Forward failed: encoding failed. See flow_id: ${fid}`);
  }
  
  console.log(`[${fid}] Encoded email - length: ${encodedEmail.length}`);

  const requestBody: any = { raw: encodedEmail };
  if (threadId) requestBody.threadId = threadId;

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[${fid}] Gmail API send error:`, error);
    throw new Error(`Failed to send message: ${error}`);
  }

  const result = await response.json();
  
  console.log(`[${fid}] Gmail API send success:`, {
    messageId: result.id,
    threadId: result.threadId,
    labelIds: result.labelIds,
  });
  
  // FETCH-BACK VERIFICATION: Get the sent message and verify it has body content
  let verified = false;
  let verificationDetails: any = null;
  
  try {
    console.log(`[${fid}] Fetching sent message for verification: ${result.id}`);
    
    const verifyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (verifyResponse.ok) {
      const verifyMsg = await verifyResponse.json();
      
      // Check for body parts
      const snippet = verifyMsg.snippet || '';
      const payload = verifyMsg.payload || {};
      const parts = payload.parts || [];
      const bodyData = payload.body?.data || '';
      
      // Find text/html or text/plain parts
      let htmlPartSize = 0;
      let plainPartSize = 0;
      
      function scanParts(partsList: any[]) {
        for (const part of partsList) {
          if (part.mimeType === 'text/html' && part.body?.size) {
            htmlPartSize += part.body.size;
          }
          if (part.mimeType === 'text/plain' && part.body?.size) {
            plainPartSize += part.body.size;
          }
          if (part.parts) {
            scanParts(part.parts);
          }
        }
      }
      
      if (parts.length > 0) {
        scanParts(parts);
      } else if (bodyData) {
        // Single-part message
        if (payload.mimeType === 'text/html') {
          htmlPartSize = bodyData.length;
        } else {
          plainPartSize = bodyData.length;
        }
      }
      
      verificationDetails = {
        snippet: snippet.substring(0, 100),
        snippetLength: snippet.length,
        htmlPartSize,
        plainPartSize,
        mimeType: payload.mimeType,
        partsCount: parts.length,
      };
      
      verified = (htmlPartSize > 0 || plainPartSize > 0 || snippet.length > 0);
      
      console.log(`[${fid}] Verification result:`, {
        verified,
        ...verificationDetails,
      });
      
      if (!verified) {
        console.error(`[${fid}] WARNING: Sent message appears to have empty body!`);
      }
    } else {
      const verifyError = await verifyResponse.text();
      console.warn(`[${fid}] Could not verify sent message:`, verifyError);
    }
  } catch (verifyErr) {
    console.warn(`[${fid}] Verification fetch failed:`, verifyErr);
  }

  return { 
    id: result.id, 
    threadId: result.threadId,
    verified,
    verificationDetails,
  };
}

async function modifyMessage(accessToken: string, messageId: string, addLabels: string[] = [], removeLabels: string[] = []) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: addLabels,
        removeLabelIds: removeLabels,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to modify message');
  }

  return response.json();
}

async function trashMessage(accessToken: string, messageId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to trash message');
  }

  return response.json();
}

async function getLabels(accessToken: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch labels');
  }

  return response.json();
}

// Cache for admin role checks to avoid repeated DB queries
const adminRoleCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'gmail-api', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create client with user's auth header for JWT validation
    const supabaseAnon = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Verify JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseAnon.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role cache first
    const cachedRole = adminRoleCache.get(userId);
    let isAdmin = false;
    
    if (cachedRole && (Date.now() - cachedRole.timestamp) < CACHE_TTL) {
      isAdmin = cachedRole.isAdmin;
    } else {
      // Check if user is admin
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'super_admin'])
        .maybeSingle();
      
      isAdmin = !!roleData;
      adminRoleCache.set(userId, { isAdmin, timestamp: Date.now() });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle OAuth callback
    if (action === 'oauth-callback') {
      return handleOAuthCallback(req, supabaseAdmin, userId);
    }

    // Get OAuth URL for connecting Gmail
    if (action === 'get-oauth-url') {
      const body = await req.json();
      const redirectUri = body.redirect_uri;
      
      const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      oauthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email');
      oauthUrl.searchParams.set('access_type', 'offline');
      oauthUrl.searchParams.set('prompt', 'consent');

      return new Response(JSON.stringify({ url: oauthUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check connection status
    if (action === 'status') {
      const { data: connection } = await supabaseAdmin
        .from('gmail_connections')
        .select('email, created_at')
        .eq('user_id', userId)
        .single();

      return new Response(JSON.stringify({
        connected: !!connection,
        email: connection?.email,
        connectedAt: connection?.created_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disconnect Gmail
    if (action === 'disconnect') {
      await supabaseAdmin
        .from('gmail_connections')
        .delete()
        .eq('user_id', userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All other actions require a valid Gmail connection
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseAdmin, userId);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Gmail not connected', needsAuth: true }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List messages
    if (action === 'list') {
      const query = url.searchParams.get('q') || '';
      const maxResults = parseInt(url.searchParams.get('maxResults') || '50');
      const pageToken = url.searchParams.get('pageToken') || undefined;
      const fetchPhotos = url.searchParams.get('fetchPhotos') === 'true';

      const messagesData = await listMessages(accessToken, query, maxResults, pageToken);

      // Batch messages to avoid rate limiting (max 20 concurrent requests)
      const BATCH_SIZE = 20;
      const messageIds = (messagesData.messages || []).map((m: any) => m.id);
      const messages: any[] = [];
      let droppedCount = 0;

      for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
        const batchIds = messageIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batchIds.map((id: string) => getMessage(accessToken, id, fetchPhotos))
        );
        const validResults = batchResults.filter((m): m is NonNullable<typeof m> => m !== null);
        droppedCount += batchResults.length - validResults.length;
        messages.push(...validResults);

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < messageIds.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (droppedCount > 0) {
        console.warn(`[gmail-api] Dropped ${droppedCount} messages that failed to fetch individually out of ${messageIds.length} total`);
      }

      return new Response(JSON.stringify({
        messages,
        nextPageToken: messagesData.nextPageToken,
        resultSizeEstimate: messagesData.resultSizeEstimate || messages.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download a single attachment
    if (action === 'get-attachment') {
      const messageId = url.searchParams.get('messageId');
      const attachmentId = url.searchParams.get('attachmentId');
      if (!messageId || !attachmentId) {
        return new Response(JSON.stringify({ error: 'messageId and attachmentId are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Gmail API error (get-attachment):', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch attachment' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify({ data: data.data, size: data.size }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List drafts count (uses the dedicated drafts API for accurate counts)
    if (action === 'list-drafts-count') {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=500',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Gmail API error (list-drafts):', error);
        throw new Error('Failed to fetch drafts');
      }

      const data = await response.json();
      const draftsCount = data.drafts?.length || 0;

      return new Response(JSON.stringify({
        count: draftsCount,
        resultSizeEstimate: data.resultSizeEstimate || draftsCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get single message
    if (action === 'get') {
      const messageId = url.searchParams.get('id');
      if (!messageId) {
        return new Response(JSON.stringify({ error: 'Message ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const message = await getMessage(accessToken, messageId);
      
      // Mark as read
      if (message.isUnread) {
        await modifyMessage(accessToken, messageId, [], ['UNREAD']);
      }

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

// Send message
    if (action === 'send') {
      const body = await req.json();
      const flowId = body.flowId || `flow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      console.log(`[${flowId}] Send request received:`, {
        to: body.to,
        subject: body.subject,
        bodyHtmlLength: body.body?.length || 0,
        bodyPlainLength: body.bodyPlain?.length || 0,
        bodyPreview: (body.body || body.bodyPlain || '').substring(0, 200),
        threadId: body.threadId || null,
        inReplyTo: body.inReplyTo || null,
        hasAttachments: !!body.attachments?.length,
        leadId: body.leadId || null,
      });
      
      // HARD FAIL: Validate that body content exists before sending
      const bodyContent = body.body || body.bodyPlain || '';
      if (!bodyContent || bodyContent.trim() === '') {
        console.error(`[${flowId}] HARD FAIL - Empty body detected`);
        return new Response(
          JSON.stringify({ 
            error: `Move Forward failed: email body was empty. See flow_id: ${flowId}`,
            flowId,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const result = await sendMessage(
          accessToken,
          body.to,
          body.subject,
          bodyContent,
          body.threadId,
          body.inReplyTo,
          body.attachments,
          flowId
        );
        
        console.log(`[${flowId}] Send complete:`, {
          messageId: result.id,
          threadId: result.threadId,
          verified: result.verified,
          verificationDetails: result.verificationDetails,
        });

        // Log email as a communication/touchpoint for the scorecard
        if (body.leadId) {
          try {
            const { error: commError } = await supabaseAdmin
              .from('evan_communications')
              .insert({
                lead_id: body.leadId,
                communication_type: 'email',
                direction: 'outbound',
                content: `Subject: ${body.subject}\n\n${bodyContent.substring(0, 500)}...`,
                status: 'sent',
              });

            if (commError) {
              console.error(`[${flowId}] Failed to log email communication:`, commError);
            } else {
              console.log(`[${flowId}] Email logged as communication for lead ${body.leadId}`);
            }

            // Update lead's last_activity_at
            const { error: leadError } = await supabaseAdmin
              .from('leads')
              .update({ last_activity_at: new Date().toISOString() })
              .eq('id', body.leadId);

            if (leadError) {
              console.error(`[${flowId}] Failed to update lead last_activity_at:`, leadError);
            }
          } catch (logErr) {
            console.error(`[${flowId}] Error logging email touchpoint:`, logErr);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          id: result.id,
          threadId: result.threadId,
          flowId,
          verified: result.verified,
          verificationDetails: result.verificationDetails,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (sendErr: any) {
        console.error(`[${flowId}] Send failed:`, sendErr.message);
        return new Response(
          JSON.stringify({ 
            error: sendErr.message,
            flowId,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Archive message
    if (action === 'archive') {
      const body = await req.json();
      await modifyMessage(accessToken, body.messageId, [], ['INBOX']);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trash message
    if (action === 'trash') {
      const body = await req.json();
      await trashMessage(accessToken, body.messageId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as read/unread
    if (action === 'mark-read') {
      const body = await req.json();
      const removeLabels = body.read ? ['UNREAD'] : [];
      const addLabels = body.read ? [] : ['UNREAD'];
      await modifyMessage(accessToken, body.messageId, addLabels, removeLabels);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get labels
    if (action === 'labels') {
      const labels = await getLabels(accessToken);
      return new Response(JSON.stringify(labels), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create draft
    if (action === 'create-draft') {
      const body = await req.json();
      const { to, subject, body: emailBody } = body;
      
      if (!to || !subject || !emailBody) {
        return new Response(JSON.stringify({ error: 'Missing to, subject, or body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        emailBody,
      ].join('\r\n');

      const encodedEmail = encodeBase64Url(email);

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: { raw: encodedEmail }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Create draft error:', error);
        throw new Error('Failed to create draft');
      }

      const result = await response.json();
      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Gmail API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});