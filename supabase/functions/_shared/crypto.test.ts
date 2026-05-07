import {
  decryptSecret,
  encryptSecret,
  parseHexKey,
} from './crypto.ts';

Deno.test('encrypt/decrypt round trip', async () => {
  const kekHex = 'a'.repeat(64);
  const plaintext = 'sk-test-secret-value';

  const encrypted = await encryptSecret(plaintext, kekHex, 1);
  const decrypted = await decryptSecret(encrypted, () => kekHex);

  if (decrypted !== plaintext) {
    throw new Error('Round trip decryption did not match original plaintext');
  }
});

Deno.test('decrypt fails with wrong KEK', async () => {
  const kekHex = 'b'.repeat(64);
  const wrongKekHex = 'c'.repeat(64);
  const encrypted = await encryptSecret('twilio-token', kekHex, 1);

  let threw = false;
  try {
    await decryptSecret(encrypted, () => wrongKekHex);
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error('Expected decryptSecret to fail with wrong KEK');
  }
});

Deno.test('decrypt fails with tampered ciphertext', async () => {
  const kekHex = 'd'.repeat(64);
  const encrypted = await encryptSecret('openai-key', kekHex, 1);

  const tampered = { ...encrypted, ciphertext: '\\x00' + encrypted.ciphertext.slice(4) };
  let threw = false;

  try {
    await decryptSecret(tampered, () => kekHex);
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error('Expected decryptSecret to fail for tampered ciphertext');
  }
});

Deno.test('parseHexKey validates key length', () => {
  let threw = false;
  try {
    parseHexKey('abcd');
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error('Expected parseHexKey to reject short keys');
  }
});
