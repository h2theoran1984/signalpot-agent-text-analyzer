import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    agent: "the-next-step",
    version: "0.2.0",
    capabilities: [
      "signalpot/meeting-summary@v1",
      "signalpot/action-items@v1",
      "signalpot/sentiment@v1",
    ],
  });
}
