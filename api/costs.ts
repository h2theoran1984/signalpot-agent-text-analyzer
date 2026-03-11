import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCostTally } from "../lib/cost-tracker.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const tally = await getCostTally();

  if (!tally) {
    return res.status(503).json({ error: "Cost tracking not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." });
  }

  return res.status(200).json({
    agent: "the-next-step",
    ...tally,
  });
}
