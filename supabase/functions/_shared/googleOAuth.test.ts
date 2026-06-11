import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createGoogleOAuthState,
  getGoogleCapabilities,
  getGoogleScopes,
  hasGoogleIntegrationScopes,
  verifyGoogleOAuthState,
} from './googleOAuth.ts';

Deno.test('Google integrations request only their own product scopes', () => {
  const sheetsScopes = getGoogleScopes('sheets');

  assert(sheetsScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert(sheetsScopes.includes('https://www.googleapis.com/auth/drive.readonly'));
  assert(!sheetsScopes.includes('https://www.googleapis.com/auth/gmail.modify'));
  assert(!sheetsScopes.includes('https://www.googleapis.com/auth/calendar.events'));
});

Deno.test('Google capabilities reflect the scopes actually granted', () => {
  const scopes = [
    ...getGoogleScopes('sheets'),
    ...getGoogleScopes('calendar'),
  ].join(' ');

  assertEquals(getGoogleCapabilities(scopes), {
    sheets: true,
    calendar: true,
    gmail: false,
  });
  assert(hasGoogleIntegrationScopes(scopes, 'sheets'));
  assert(!hasGoogleIntegrationScopes(scopes, 'gmail'));
});

Deno.test('Google OAuth state is signed and bound to the authenticated user', async () => {
  const state = await createGoogleOAuthState('test-secret', 'user-1', 'sheets');

  assertEquals(
    (await verifyGoogleOAuthState('test-secret', state, 'user-1'))?.integration,
    'sheets',
  );
  assertEquals(await verifyGoogleOAuthState('test-secret', state, 'user-2'), null);
  assertEquals(await verifyGoogleOAuthState('wrong-secret', state, 'user-1'), null);
});
