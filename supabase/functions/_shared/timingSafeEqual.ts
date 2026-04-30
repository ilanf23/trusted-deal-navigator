// Constant-time string equality. Use for comparing webhook signatures, channel
// tokens, or any other secret where a length-discriminating early-exit could leak
// information.

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
