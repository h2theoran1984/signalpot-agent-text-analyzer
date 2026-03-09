import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    tools: [
      {
        name: "meeting_summary",
        description: "Produces a full structured meeting summary with action items, decisions, participants, and tone analysis. Each action item includes task, owner, due date, notes, and next step.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Meeting transcript or notes (50-50000 chars)" },
            context: { type: "string", description: "Optional meeting context (e.g. 'Weekly engineering standup')" },
          },
          required: ["text"],
        },
      },
      {
        name: "extract_action_items",
        description: "Lightweight extraction of just the action items from a meeting transcript. Each item has task, owner, due date, notes, and next step.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Meeting transcript or notes (20-50000 chars)" },
          },
          required: ["text"],
        },
      },
      {
        name: "analyze_meeting_tone",
        description: "Analyzes the emotional tone and sentiment of a meeting transcript.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Meeting transcript or notes (1-10000 chars)" },
          },
          required: ["text"],
        },
      },
    ],
  });
}
