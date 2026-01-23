import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Get body content (prefer HTML if available)
    let plainBody = '';
    let htmlBody = '';
    
    function extractBody(part: any) {
      const mimeType = part?.mimeType;
      const data = part?.body?.data;

      // Only set the first found of each type; keep HTML if present.
      if (mimeType === 'text/html' && data && !htmlBody) {
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
        part.parts.forEach(extractBody);
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
      extractBody(message.payload);
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
      subject: headers.subject || '(No Subject)',
      date: headers.date || '',
      body: htmlBody || plainBody,
      isUnread: message.labelIds?.includes('UNREAD'),
      senderPhoto,
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
function createMimeMessage(
  to: string, 
  subject: string, 
  body: string, 
  attachments?: { filename: string; mimeType: string; data: string }[],
  threadId?: string,
  inReplyTo?: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // If no attachments, use simple format
  if (!attachments || attachments.length === 0) {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      inReplyTo ? `References: ${inReplyTo}` : '',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      body,
    ].filter(Boolean).join('\r\n');
    
    return email;
  }
  
  // Build multipart message with attachments
  let email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    inReplyTo ? `References: ${inReplyTo}` : '',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].filter(Boolean).join('\r\n');
  
  // Add each attachment
  for (const attachment of attachments) {
    email += '\r\n' + [
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.data.replace(/(.{76})/g, '$1\r\n'), // Line wrap base64 at 76 chars
    ].join('\r\n');
  }
  
  // Close the boundary
  email += `\r\n--${boundary}--`;
  
  return email;
}

async function sendMessage(
  accessToken: string, 
  to: string, 
  subject: string, 
  body: string, 
  threadId?: string, 
  inReplyTo?: string,
  attachments?: { filename: string; mimeType: string; data: string }[]
) {
  const email = createMimeMessage(to, subject, body, attachments, threadId, inReplyTo);
  const encodedEmail = encodeBase64Url(email);

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
    console.error('Send message error:', error);
    throw new Error('Failed to send message');
  }

  return response.json();
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
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
      const maxResults = parseInt(url.searchParams.get('maxResults') || '20');
      const pageToken = url.searchParams.get('pageToken') || undefined;
      const fetchPhotos = url.searchParams.get('fetchPhotos') === 'true';
      
      const messagesData = await listMessages(accessToken, query, maxResults, pageToken);
      
      // Fetch full details for each message (filter out any that failed to fetch)
      const allMessages = await Promise.all(
        (messagesData.messages || []).map((m: any) => getMessage(accessToken, m.id, fetchPhotos))
      );
      const messages = allMessages.filter((m): m is NonNullable<typeof m> => m !== null);

      return new Response(JSON.stringify({
        messages,
        nextPageToken: messagesData.nextPageToken,
        resultSizeEstimate: messagesData.resultSizeEstimate || messages.length,
      }), {
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
      const result = await sendMessage(
        accessToken,
        body.to,
        body.subject,
        body.body,
        body.threadId,
        body.inReplyTo,
        body.attachments // Pass attachments to sendMessage
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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