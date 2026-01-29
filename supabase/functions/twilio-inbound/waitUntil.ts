export function waitUntil(task: Promise<unknown>) {
  try {
    // Supabase Edge Runtime provides EdgeRuntime.waitUntil for background work.
    // If it doesn't exist, we still fire-and-forget (best effort).
    // @ts-expect-error - EdgeRuntime is a global in the edge runtime.
    const maybe = globalThis.EdgeRuntime?.waitUntil;
    if (typeof maybe === 'function') {
      // @ts-expect-error - runtime provided.
      globalThis.EdgeRuntime.waitUntil(task);
      return;
    }
  } catch {
    // ignore
  }

  task.catch((err) => console.error('waitUntil background task failed:', err));
}
