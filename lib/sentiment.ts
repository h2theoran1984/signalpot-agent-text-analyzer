import { anthropic, logApiCost, type CostInfo } from "./anthropic.js";
import { trackCost } from "./cost-tracker.js";

export interface SentimentInput {
  text: string;
}

export interface SentimentOutput {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score: number;
  confidence: number;
  meeting_tone: string;
  emotions: {
    joy: number;
    anger: number;
    sadness: number;
    fear: number;
    surprise: number;
  };
}

const SENTIMENT_SYSTEM_PROMPT = `You analyze the emotional tone of meeting transcripts and conversations.

Return a JSON object with:
- "sentiment": one of "positive", "negative", "neutral", "mixed"
- "score": number from -1 (very negative) to 1 (very positive)
- "confidence": number from 0 to 1
- "meeting_tone": a short phrase describing the meeting dynamic (e.g. "productive and focused", "tense negotiation", "casual brainstorm", "urgent firefighting")
- "emotions": object with scores 0-1 for: joy, anger, sadness, fear, surprise

Respond with ONLY valid JSON, no markdown, no code blocks.`;

export async function analyzeSentiment(input: SentimentInput): Promise<{ data: SentimentOutput; cost: CostInfo }> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SENTIMENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.text }],
  });

  const cost = logApiCost("sentiment", message.usage);
  await trackCost("sentiment", { ...cost, revenue_usd: cost.revenue_usd });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let text = content.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  return { data: JSON.parse(text), cost };
}
