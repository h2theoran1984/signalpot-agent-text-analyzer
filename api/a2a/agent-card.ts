import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    name: "Text Analyzer",
    description: "Summarizes text and performs sentiment analysis using Claude Haiku.",
    url: process.env.AGENT_BASE_URL ?? "https://signalpot-agent-text-analyzer.vercel.app",
    version: "0.1.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
  });
}
