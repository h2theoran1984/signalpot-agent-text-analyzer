import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCostTally } from "../lib/cost-tracker.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Require COSTS_SECRET as a bearer token or query param
  const secret = process.env.COSTS_SECRET;
  if (secret) {
    const auth = req.headers.authorization;
    const query = req.query.secret as string | undefined;
    if (auth !== `Bearer ${secret}` && query !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const tally = await getCostTally();

  if (!tally) {
    return res.status(503).json({ error: "Cost tracking not configured." });
  }

  return res.status(200).json({
    agent: "the-next-step",
    ...tally,
  });
}
