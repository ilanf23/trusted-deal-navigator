const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH_BITS = 128;
const DEK_LENGTH_BYTES = 32;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

export interface WrappedDekPayload {
  encrypted_dek: string;
  dek_iv: string;
  dek_auth_tag: string;
}

export interface StoredEncryptedSecret extends EncryptedPayload, WrappedDekPayload {
  key_version: number;
}

interface RawEncryptedPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function getKekForVersion(version = 1): string {
  const key = Deno.env.get(`SECRETS_KEK_V${version}`);
  if (!key) {
    throw new Error(`Missing KEK environment variable: SECRETS_KEK_V${version}`);
  }
  return key;
}

function stripHexPrefix(hex: string): string {
  return hex.startsWith('\\x') ? hex.slice(2) : hex;
}

export function bytesToPgBytea(input: Uint8Array): string {
  const hex = Array.from(input).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `\\x${hex}`;
}

export function pgByteaToBytes(input: string | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  const normalized = stripHexPrefix(input);
  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid bytea hex value');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function parseHexKey(hexKey: string): Uint8Array {
  const normalized = stripHexPrefix(hexKey.trim());
  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('KEK must be a hex-encoded value');
  }
  const bytes = pgByteaToBytes(normalized);
  if (bytes.byteLength !== DEK_LENGTH_BYTES) {
    throw new Error('KEK must be 32 bytes (64 hex chars)');
  }
  return bytes;
}

export function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_LENGTH_BYTES));
}

async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBytes(plaintext: Uint8Array, keyBytes: Uint8Array): Promise<RawEncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const key = await importAesKey(keyBytes);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: AES_GCM_TAG_LENGTH_BITS },
    key,
    plaintext,
  );

  const encrypted = new Uint8Array(encryptedBuffer);
  const tagBytes = AES_GCM_TAG_LENGTH_BITS / 8;
  const ciphertext = encrypted.slice(0, encrypted.length - tagBytes);
  const authTag = encrypted.slice(encrypted.length - tagBytes);

  return { ciphertext, iv, authTag };
}

async function decryptBytes(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  keyBytes: Uint8Array,
): Promise<Uint8Array> {
  const key = await importAesKey(keyBytes);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: AES_GCM_TAG_LENGTH_BITS },
    key,
    combined,
  );

  return new Uint8Array(plainBuffer);
}

export async function encryptWithKey(plaintext: string, key: Uint8Array): Promise<RawEncryptedPayload> {
  return encryptBytes(textEncoder.encode(plaintext), key);
}

export async function decryptWithKey(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  key: Uint8Array,
): Promise<string> {
  const bytes = await decryptBytes(ciphertext, iv, authTag, key);
  return textDecoder.decode(bytes);
}

export async function wrapDEK(dek: Uint8Array, kek: Uint8Array): Promise<WrappedDekPayload> {
  const wrapped = await encryptBytes(dek, kek);
  return {
    encrypted_dek: bytesToPgBytea(wrapped.ciphertext),
    dek_iv: bytesToPgBytea(wrapped.iv),
    dek_auth_tag: bytesToPgBytea(wrapped.authTag),
  };
}

export async function unwrapDEK(payload: {
  encrypted_dek: string | Uint8Array;
  dek_iv: string | Uint8Array;
  dek_auth_tag: string | Uint8Array;
}, kek: Uint8Array): Promise<Uint8Array> {
  return decryptBytes(
    pgByteaToBytes(payload.encrypted_dek),
    pgByteaToBytes(payload.dek_iv),
    pgByteaToBytes(payload.dek_auth_tag),
    kek,
  );
}

export async function encryptSecret(
  plaintext: string,
  kekHex: string,
  keyVersion = 1,
): Promise<StoredEncryptedSecret> {
  const dek = generateDEK();
  const kek = parseHexKey(kekHex);
  const encrypted = await encryptWithKey(plaintext, dek);
  const wrappedDek = await wrapDEK(dek, kek);

  return {
    ciphertext: bytesToPgBytea(encrypted.ciphertext),
    iv: bytesToPgBytea(encrypted.iv),
    auth_tag: bytesToPgBytea(encrypted.authTag),
    ...wrappedDek,
    key_version: keyVersion,
  };
}

export async function decryptSecret(
  payload: {
    ciphertext: string | Uint8Array;
    iv: string | Uint8Array;
    auth_tag: string | Uint8Array;
    encrypted_dek: string | Uint8Array;
    dek_iv: string | Uint8Array;
    dek_auth_tag: string | Uint8Array;
    key_version?: number | null;
  },
  keyResolver?: (version: number) => string,
): Promise<string> {
  const version = payload.key_version ?? 1;
  const kekHex = keyResolver ? keyResolver(version) : getKekForVersion(version);
  const kek = parseHexKey(kekHex);
  const dek = await unwrapDEK(payload, kek);
  return decryptWithKey(
    pgByteaToBytes(payload.ciphertext),
    pgByteaToBytes(payload.iv),
    pgByteaToBytes(payload.auth_tag),
    dek,
  );
}
