import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    tools: [
      {
        name: "summarize_text",
        description: "Summarize a piece of text using Claude Haiku",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to summarize (50-50000 chars)" },
            format: { type: "string", enum: ["paragraph", "bullets"], default: "paragraph" },
            max_length: { type: "integer", default: 300 },
          },
          required: ["text"],
        },
      },
      {
        name: "analyze_sentiment",
        description: "Analyze the sentiment and emotions in text",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to analyze (1-10000 chars)" },
            language: { type: "string", default: "en" },
          },
          required: ["text"],
        },
      },
    ],
  });
}
