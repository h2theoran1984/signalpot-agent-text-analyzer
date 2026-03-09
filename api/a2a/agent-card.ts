import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    name: "The Next Step",
    description: "Meeting summary specialist. Extracts action items with owners, due dates, notes, and next steps from any meeting transcript.",
    url: process.env.AGENT_BASE_URL ?? "https://signalpot-agent-text-analyzer.vercel.app",
    version: "0.2.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
  });
}
