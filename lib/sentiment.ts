import { anthropic } from "./anthropic.js";

export interface SentimentInput {
  text: string;
  language?: string;
}

export interface SentimentOutput {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score: number;
  confidence: number;
  emotions: {
    joy: number;
    anger: number;
    sadness: number;
    fear: number;
    surprise: number;
  };
}

export async function analyzeSentiment(input: SentimentInput): Promise<SentimentOutput> {
  const prompt = `Analyze the sentiment of the following text. Return a JSON object with:
- "sentiment": one of "positive", "negative", "neutral", "mixed"
- "score": number from -1 (very negative) to 1 (very positive)
- "confidence": number from 0 to 1 indicating how confident you are
- "emotions": object with scores 0-1 for: joy, anger, sadness, fear, surprise

Text: ${input.text}

Respond with only valid JSON, no markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  return JSON.parse(content.text);
}
