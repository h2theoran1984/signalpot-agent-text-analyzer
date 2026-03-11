import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Haiku 4.5 pricing (per token)
const HAIKU_INPUT_PER_TOKEN = 1.0 / 1_000_000;   // $1.00 / 1M tokens
const HAIKU_OUTPUT_PER_TOKEN = 5.0 / 1_000_000;   // $5.00 / 1M tokens

const RATE_AMOUNT = 0.001; // what we charge per call (USD)

export interface CostInfo {
  input_tokens: number;
  output_tokens: number;
  api_cost_usd: number;
  revenue_usd: number;
  margin_usd: number;
  margin_pct: number;
}

/**
 * Calculate and log actual API cost vs revenue for a call.
 * Returns cost info so it can be included in response metadata.
 */
export function logApiCost(
  capability: string,
  usage: { input_tokens: number; output_tokens: number }
): CostInfo {
  const inputCost = usage.input_tokens * HAIKU_INPUT_PER_TOKEN;
  const outputCost = usage.output_tokens * HAIKU_OUTPUT_PER_TOKEN;
  const apiCost = inputCost + outputCost;
  const margin = RATE_AMOUNT - apiCost;
  const marginPct = (margin / RATE_AMOUNT) * 100;

  console.log(
    `[cost] ${capability} | in=${usage.input_tokens} out=${usage.output_tokens} | cost=$${apiCost.toFixed(6)} | revenue=$${RATE_AMOUNT} | margin=$${margin.toFixed(6)} (${marginPct.toFixed(1)}%)`
  );

  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    api_cost_usd: Math.round(apiCost * 1_000_000) / 1_000_000,
    revenue_usd: RATE_AMOUNT,
    margin_usd: Math.round(margin * 1_000_000) / 1_000_000,
    margin_pct: Math.round(marginPct * 10) / 10,
  };
}
