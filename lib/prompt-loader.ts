/**
 * Hot-swap prompt loader — fetches active system prompts from Supabase.
 * Uses raw fetch (no SDK) with a stale-while-revalidate in-memory cache.
 *
 * Fallback chain:
 *   1. In-memory cache (instant, < 60s old)
 *   2. Supabase PostgREST fetch (~50-100ms)
 *   3. Hardcoded defaults (zero-dependency, always available)
 */

export interface PromptConfig {
  system_prompt: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

// Hardcoded defaults — the original prompts, used as fallback
const DEFAULTS: Record<string, PromptConfig> = {
  "signalpot/meeting-summary@v1": {
    system_prompt: `Expert meeting summarizer. Concise, accurate, structured. Never fabricate facts.

Output ONLY valid JSON (no markdown, no explanation):
{"summary":"2-3 sentences max","action_items":[{"task":"...","owner":"...","due":"...","notes":"...","next_step":"..."}],"decisions":["..."],"participants":["..."],"meeting_tone":"productive|tense|collaborative|unfocused|urgent"}

Rules: Infer due dates or use "TBD". Unassigned if no owner. Decisions = firm commitments only.
DATE RULES: A DATE REFERENCE block is appended to the transcript with pre-computed YYYY-MM-DD dates. ALWAYS use those exact dates for the "due" field. NEVER output day names, "EOD", "noon", or any relative words — only YYYY-MM-DD.
BREVITY IS CRITICAL: summary under 40 words. Each notes/next_step under 8 words. Each task under 12 words. Each decision under 15 words. Minimize total output tokens.`,
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    temperature: 0,
  },
  "signalpot/action-items@v1": {
    system_prompt: `Extract action items from meeting transcripts. Output ONLY valid JSON (no markdown).
{"action_items":[{"task":"...","owner":"...","due":"...","notes":"...","next_step":"..."}],"count":0}
Rules: "TBD" if no due date. "Unassigned" if no owner. Keep fields SHORT — under 15 words each.
DATE RULES: A DATE REFERENCE block is appended to the transcript with pre-computed YYYY-MM-DD dates. ALWAYS use those exact dates for the "due" field. NEVER output day names, "EOD", "noon", or any relative words — only YYYY-MM-DD.`,
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    temperature: 0,
  },
  "signalpot/sentiment@v1": {
    system_prompt: `You analyze the emotional tone of meeting transcripts and conversations.

Return a JSON object with:
- "sentiment": one of "positive", "negative", "neutral", "mixed"
- "score": number from -1 (very negative) to 1 (very positive)
- "confidence": number from 0 to 1
- "meeting_tone": a short phrase describing the meeting dynamic (e.g. "productive and focused", "tense negotiation", "casual brainstorm", "urgent firefighting")
- "emotions": object with scores 0-1 for: joy, anger, sadness, fear, surprise

Respond with ONLY valid JSON, no markdown, no code blocks.`,
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    temperature: 0,
  },
};

// Cache
interface CacheEntry {
  data: PromptConfig;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AGENT_ID = process.env.SIGNALPOT_AGENT_ID;

/**
 * Fetch the active prompt from Supabase PostgREST.
 * Returns null on any failure (network, auth, missing row).
 */
async function fetchFromSupabase(capability: string): Promise<PromptConfig | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !AGENT_ID) return null;

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/prompt_versions`);
    url.searchParams.set("agent_id", `eq.${AGENT_ID}`);
    url.searchParams.set("capability", `eq.${capability}`);
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("select", "system_prompt,model,max_tokens,temperature");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) return null;

    const rows = (await res.json()) as Array<{
      system_prompt: string;
      model: string;
      max_tokens: number;
      temperature: number;
    }>;

    if (rows.length === 0) return null;

    return {
      system_prompt: rows[0].system_prompt,
      model: rows[0].model,
      max_tokens: rows[0].max_tokens,
      temperature: Number(rows[0].temperature),
    };
  } catch {
    // Silent fail — non-blocking
    return null;
  }
}

/**
 * Get the active prompt config for a capability.
 * Uses stale-while-revalidate: returns cached value immediately,
 * triggers background refetch if stale.
 */
export async function getActivePrompt(capability: string): Promise<PromptConfig> {
  const fallback = DEFAULTS[capability];

  // Check cache
  const cached = cache.get(capability);
  const now = Date.now();

  if (cached) {
    if (now - cached.fetchedAt < CACHE_TTL_MS) {
      // Fresh cache — return immediately
      return cached.data;
    }

    // Stale cache — return immediately, refetch in background
    fetchFromSupabase(capability).then((result) => {
      if (result) {
        cache.set(capability, { data: result, fetchedAt: Date.now() });
      }
    });

    return cached.data;
  }

  // No cache — try Supabase (blocking on first call only)
  const result = await fetchFromSupabase(capability);
  if (result) {
    cache.set(capability, { data: result, fetchedAt: now });
    return result;
  }

  // Supabase unavailable or no rows — use hardcoded default
  if (fallback) {
    cache.set(capability, { data: fallback, fetchedAt: now });
    return fallback;
  }

  // Unknown capability — return a minimal default
  return {
    system_prompt: "You are a helpful assistant. Respond with valid JSON only.",
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    temperature: 0,
  };
}
