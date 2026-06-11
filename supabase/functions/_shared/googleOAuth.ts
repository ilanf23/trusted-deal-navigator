export const GOOGLE_INTEGRATIONS = ['sheets', 'calendar', 'gmail'] as const;

export type GoogleIntegration = typeof GOOGLE_INTEGRATIONS[number];

const BASE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
];

export const GOOGLE_INTEGRATION_SCOPES: Record<GoogleIntegration, string[]> = {
  sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar.events',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
  ],
};

export function isGoogleIntegration(value: unknown): value is GoogleIntegration {
  return typeof value === 'string' &&
    GOOGLE_INTEGRATIONS.includes(value as GoogleIntegration);
}

export function getGoogleScopes(integration: GoogleIntegration): string[] {
  return [...BASE_SCOPES, ...GOOGLE_INTEGRATION_SCOPES[integration]];
}

export function parseGoogleScopes(scopes: string | null | undefined): Set<string> {
  return new Set((scopes || '').split(/\s+/).filter(Boolean));
}

export function hasGoogleIntegrationScopes(
  scopes: string | null | undefined,
  integration: GoogleIntegration,
): boolean {
  const granted = parseGoogleScopes(scopes);
  return GOOGLE_INTEGRATION_SCOPES[integration].every((scope) => granted.has(scope));
}

export function getGoogleCapabilities(scopes: string | null | undefined) {
  return Object.fromEntries(
    GOOGLE_INTEGRATIONS.map((integration) => [
      integration,
      hasGoogleIntegrationScopes(scopes, integration),
    ]),
  ) as Record<GoogleIntegration, boolean>;
}

interface GoogleOAuthState {
  userId: string;
  integration: GoogleIntegration;
  issuedAt: number;
  nonce: string;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function importStateKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createGoogleOAuthState(
  secret: string,
  userId: string,
  integration: GoogleIntegration,
): Promise<string> {
  const payload: GoogleOAuthState = {
    userId,
    integration,
    issuedAt: Date.now(),
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importStateKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGoogleOAuthState(
  secret: string,
  state: string,
  expectedUserId: string,
  maxAgeMs = 10 * 60 * 1000,
): Promise<GoogleOAuthState | null> {
  try {
    const [encodedPayload, encodedSignature] = state.split('.');
    if (!encodedPayload || !encodedSignature) return null;

    const isValid = await crypto.subtle.verify(
      'HMAC',
      await importStateKey(secret),
      toArrayBuffer(decodeBase64Url(encodedSignature)),
      new TextEncoder().encode(encodedPayload),
    );
    if (!isValid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as GoogleOAuthState;

    if (
      payload.userId !== expectedUserId ||
      !isGoogleIntegration(payload.integration) ||
      !Number.isFinite(payload.issuedAt) ||
      Date.now() - payload.issuedAt > maxAgeMs ||
      payload.issuedAt > Date.now() + 60_000
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
