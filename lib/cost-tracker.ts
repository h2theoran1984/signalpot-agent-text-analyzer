/**
 * Lightweight cost tracker using Upstash Redis REST API.
 * Tracks per-capability and total API costs with a running tally.
 * No SDK needed — just fetch.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

interface CostEntry {
  api_cost_usd: number;
  revenue_usd: number;
  input_tokens: number;
  output_tokens: number;
}

async function redis(command: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const data = await res.json();
    return data.result;
  } catch {
    // Non-blocking — don't break the agent if tracking fails
    return null;
  }
}

/**
 * Record a cost entry. Increments running totals in Redis.
 * All amounts stored as micro-dollars (millionths) to avoid float issues.
 */
export async function trackCost(capability: string, entry: CostEntry): Promise<void> {
  if (!UPSTASH_URL) return;

  const costMicro = Math.round(entry.api_cost_usd * 1_000_000);
  const revMicro = Math.round(entry.revenue_usd * 1_000_000);

  // Fire-and-forget — don't await in the hot path
  const pipeline = [
    // Global totals
    ["HINCRBY", "tns:costs:total", "api_cost", String(costMicro)],
    ["HINCRBY", "tns:costs:total", "revenue", String(revMicro)],
    ["HINCRBY", "tns:costs:total", "calls", "1"],
    ["HINCRBY", "tns:costs:total", "input_tokens", String(entry.input_tokens)],
    ["HINCRBY", "tns:costs:total", "output_tokens", String(entry.output_tokens)],
    // Per-capability totals
    ["HINCRBY", `tns:costs:${capability}`, "api_cost", String(costMicro)],
    ["HINCRBY", `tns:costs:${capability}`, "revenue", String(revMicro)],
    ["HINCRBY", `tns:costs:${capability}`, "calls", "1"],
    ["HINCRBY", `tns:costs:${capability}`, "input_tokens", String(entry.input_tokens)],
    ["HINCRBY", `tns:costs:${capability}`, "output_tokens", String(entry.output_tokens)],
  ];

  // Use Upstash pipeline endpoint for batch
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

interface CostSummary {
  calls: number;
  api_cost_usd: number;
  revenue_usd: number;
  margin_usd: number;
  margin_pct: number;
  input_tokens: number;
  output_tokens: number;
  avg_cost_per_call: number;
}

function parseSummary(raw: Record<string, string> | null): CostSummary {
  if (!raw) return { calls: 0, api_cost_usd: 0, revenue_usd: 0, margin_usd: 0, margin_pct: 0, input_tokens: 0, output_tokens: 0, avg_cost_per_call: 0 };

  const calls = parseInt(raw.calls || "0");
  const apiCost = parseInt(raw.api_cost || "0") / 1_000_000;
  const revenue = parseInt(raw.revenue || "0") / 1_000_000;
  const margin = revenue - apiCost;

  return {
    calls,
    api_cost_usd: apiCost,
    revenue_usd: revenue,
    margin_usd: margin,
    margin_pct: revenue > 0 ? (margin / revenue) * 100 : 0,
    input_tokens: parseInt(raw.input_tokens || "0"),
    output_tokens: parseInt(raw.output_tokens || "0"),
    avg_cost_per_call: calls > 0 ? apiCost / calls : 0,
  };
}

/**
 * Get the running cost tally — total and per-capability.
 */
export async function getCostTally(): Promise<{
  total: CostSummary;
  by_capability: Record<string, CostSummary>;
} | null> {
  if (!UPSTASH_URL) return null;

  const capabilities = ["meeting-summary", "action-items", "sentiment"];

  const pipeline = [
    ["HGETALL", "tns:costs:total"],
    ...capabilities.map((c) => ["HGETALL", `tns:costs:${c}`]),
  ];

  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
    const data = await res.json();
    const results = data.map((r: { result: unknown }) => r.result);

    // HGETALL returns flat array: [key, val, key, val, ...]
    function toRecord(arr: string[] | null): Record<string, string> | null {
      if (!arr || arr.length === 0) return null;
      const obj: Record<string, string> = {};
      for (let i = 0; i < arr.length; i += 2) {
        obj[arr[i]] = arr[i + 1];
      }
      return obj;
    }

    const byCap: Record<string, CostSummary> = {};
    capabilities.forEach((c, i) => {
      const summary = parseSummary(toRecord(results[i + 1]));
      if (summary.calls > 0) byCap[c] = summary;
    });

    return {
      total: parseSummary(toRecord(results[0])),
      by_capability: byCap,
    };
  } catch {
    return null;
  }
}
