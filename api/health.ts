import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    agent: "text-analyzer",
    version: "0.1.0",
    capabilities: ["signalpot/text-summary@v1", "signalpot/sentiment@v1"],
  });
}
