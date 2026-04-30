// Gmail API helpers shared by gmail-auth, gmail-mailbox, gmail-write edge functions.
// All helpers expect a refreshed Gmail OAuth access token; use
// `getValidAccessToken(supabase, userId)` below to obtain one.

import type { SupabaseClient } from '../supabase.ts';
import { getGmailAccessTokenForUser } from '../gmailToken.ts';

export interface GmailAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  messageId: string;
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  body: string;
  isUnread: boolean;
  senderPhoto: string | null;
  attachments: GmailAttachment[];
}

export interface SendVerification {
  snippet: string;
  snippetLength: number;
  htmlPartSize: number;
  plainPartSize: number;
  mimeType: string | undefined;
  partsCount: number;
}

export interface SendResult {
  id: string;
  threadId: string;
  verified: boolean;
  verificationDetails: SendVerification | null;
}

/**
 * Resolve a Gmail access token, throwing on missing connection so the caller
 * can map to a 400 `{ needsAuth: true }` response. Uses the shared
 * `getGmailAccessTokenForUser` helper which already refreshes proactively.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const token = await getGmailAccessTokenForUser(supabase, userId);
  if (!token) throw new Error('Gmail not connected');
  return token.accessToken;
}

export function encodeBase64Url(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64UrlToUtf8(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = base64.length % 4;
  const padded = padLen ? base64 + '='.repeat(4 - padLen) : base64;

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

// Format email body so it renders reliably in Gmail while preserving spacing/indents.
// Editor HTML is wrapped; plain text is escaped + <br>-converted with pre-wrap.
function formatEmailBody(body: string): string {
  const raw = (body ?? '');
  if (raw.trim() === '') {
    return '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">&nbsp;</div>';
  }

  const looksLikeHtml = /<\/?(div|p|br|span|b|strong|i|em|u|ul|ol|li|table|thead|tbody|tr|td|h[1-6])\b/i.test(raw);

  if (looksLikeHtml) {
    return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333;">${raw}</div>`;
  }

  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const withBreaks = escaped
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>\r\n');

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333; white-space: pre-wrap;">${withBreaks}</div>`;
}

export function createMimeMessage(
  to: string,
  subject: string,
  body: string,
  attachments?: { filename: string; mimeType: string; data: string }[],
  _threadId?: string,
  inReplyTo?: string,
  flowId?: string,
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const formattedBody = formatEmailBody(body);

  console.log(`[${flowId}] createMimeMessage - formattedBody length: ${formattedBody.length}, preview: ${formattedBody.substring(0, 100)}`);

  const headers: string[] = [
    'From: me',
    `To: ${to}`,
    `Subject: ${subject}`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: <${inReplyTo}>`);
    headers.push(`References: <${inReplyTo}>`);
  }

  headers.push('MIME-Version: 1.0');

  if (!attachments || attachments.length === 0) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 8bit');

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

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const headersStr = headers.join('\r\n');

  let multipartBody = '';
  multipartBody += `--${boundary}\r\n`;
  multipartBody += 'Content-Type: text/html; charset="UTF-8"\r\n';
  multipartBody += 'Content-Transfer-Encoding: 8bit\r\n';
  multipartBody += '\r\n';
  multipartBody += formattedBody + '\r\n';

  for (const attachment of attachments) {
    multipartBody += `--${boundary}\r\n`;
    multipartBody += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
    multipartBody += 'Content-Transfer-Encoding: base64\r\n';
    multipartBody += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    multipartBody += '\r\n';
    multipartBody += attachment.data.replace(/(.{76})/g, '$1\r\n') + '\r\n';
  }

  multipartBody += `--${boundary}--\r\n`;

  const email = headersStr + '\r\n\r\n' + multipartBody;

  console.log(`[${flowId}] MIME multipart message - total length: ${email.length}`);

  return email;
}

export async function listMessages(
  accessToken: string,
  query = '',
  maxResults = 20,
  pageToken?: string,
): Promise<any> {
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

// Cache sender profile photos within a single function isolate to avoid repeats.
const senderPhotoCache = new Map<string, string | null>();

export async function getSenderPhoto(accessToken: string, email: string): Promise<string | null> {
  if (senderPhotoCache.has(email)) {
    return senderPhotoCache.get(email) || null;
  }

  try {
    const response = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]?.person?.photos?.[0]?.url) {
        const photoUrl = data.results[0].person.photos[0].url;
        senderPhotoCache.set(email, photoUrl);
        return photoUrl;
      }
    }

    senderPhotoCache.set(email, null);
    return null;
  } catch (error) {
    console.warn(`Failed to fetch photo for ${email}:`, error);
    senderPhotoCache.set(email, null);
    return null;
  }
}

export async function getMessage(
  accessToken: string,
  messageId: string,
  fetchPhoto = false,
): Promise<ParsedGmailMessage | null> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      console.warn(`Failed to fetch message ${messageId}: ${response.status}`);
      return null;
    }

    const message = await response.json();

    const headers: Record<string, string> = {};
    if (message.payload?.headers) {
      message.payload.headers.forEach((h: { name: string; value: string }) => {
        headers[h.name.toLowerCase()] = h.value;
      });
    }

    let plainBody = '';
    let htmlBody = '';
    const attachments: GmailAttachment[] = [];

    function extractParts(part: any) {
      const mimeType = part?.mimeType;
      const data = part?.body?.data;
      const attachmentId = part?.body?.attachmentId;
      const filename = part?.filename;

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

    const fromHeader = headers.from || '';
    const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<]+@[^\s>]+)/);
    const senderEmail = emailMatch ? emailMatch[1] : fromHeader;

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
      isUnread: !!message.labelIds?.includes('UNREAD'),
      senderPhoto,
      attachments,
    };
  } catch (error) {
    console.error(`Error fetching message ${messageId}:`, error);
    return null;
  }
}

export async function modifyMessage(
  accessToken: string,
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = [],
): Promise<any> {
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
    },
  );

  if (!response.ok) {
    throw new Error('Failed to modify message');
  }

  return response.json();
}

export async function trashMessage(accessToken: string, messageId: string): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to trash message');
  }

  return response.json();
}

export async function getLabels(accessToken: string): Promise<any> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch labels');
  }

  return response.json();
}

export async function sendMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string,
  attachments?: { filename: string; mimeType: string; data: string }[],
  flowId?: string,
): Promise<SendResult> {
  const fid = flowId || `flow_${Date.now()}`;

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

  // FETCH-BACK VERIFICATION: confirm sent message has body content.
  let verified = false;
  let verificationDetails: SendVerification | null = null;

  try {
    console.log(`[${fid}] Fetching sent message for verification: ${result.id}`);

    const verifyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (verifyResponse.ok) {
      const verifyMsg = await verifyResponse.json();

      const snippet = verifyMsg.snippet || '';
      const payload = verifyMsg.payload || {};
      const parts = payload.parts || [];
      const bodyData = payload.body?.data || '';

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

      console.log(`[${fid}] Verification result:`, { verified, ...verificationDetails });

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
