/**
 * KeyKeeper credential resolver.
 * Fetches secrets from the SignalPot KeyKeeper vault at runtime.
 * Falls back to process.env when KeyKeeper is unavailable (e.g. local dev).
 */

const DISPATCH_URL = process.env.KEYKEEPER_DISPATCH_URL;
const DISPATCH_KEY = process.env.INTERNAL_DISPATCH_KEY;
const OWNER_ID = process.env.KEYKEEPER_OWNER_ID;

interface ResolveOptions {
  secretName: string;
  envFallback?: string;
  jobId?: string;
}

let cache: Map<string, { value: string; ts: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function resolveCredential(opts: ResolveOptions): Promise<string | undefined> {
  // Check in-memory cache first
  const cached = cache.get(opts.secretName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.value;
  }

  // Try KeyKeeper dispatch
  if (DISPATCH_URL && DISPATCH_KEY && OWNER_ID) {
    try {
      const res = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signalpot-internal": DISPATCH_KEY,
        },
        body: JSON.stringify({
          capability: "credential.resolve",
          job_id: opts.jobId ?? "internal",
          input: {
            secret_name: opts.secretName,
            owner_id: OWNER_ID,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          cache.set(opts.secretName, { value: data.value, ts: Date.now() });
          return data.value;
        }
      }
    } catch (err) {
      console.warn(`[keykeeper] Failed to resolve ${opts.secretName}, falling back to env`);
    }
  }

  // Fallback to environment variable
  return opts.envFallback ? process.env[opts.envFallback] : undefined;
}
