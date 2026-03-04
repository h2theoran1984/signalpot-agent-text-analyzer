import { anthropic } from "./anthropic.js";

export interface SummarizeInput {
  text: string;
  format?: "paragraph" | "bullets";
  max_length?: number;
}

export interface SummarizeOutput {
  summary: string;
  key_points: string[];
  word_count_original: number;
  word_count_summary: number;
}

export async function summarize(input: SummarizeInput): Promise<SummarizeOutput> {
  const format = input.format ?? "paragraph";
  const maxLength = input.max_length ?? 300;

  const prompt = `Summarize the following text. Return a JSON object with these fields:
- "summary": a ${format === "bullets" ? "bullet-point" : "concise paragraph"} summary (max ${maxLength} words)
- "key_points": array of 3-5 key takeaways as short strings

Text to summarize:
${input.text}

Respond with only valid JSON, no markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const parsed = JSON.parse(content.text);
  return {
    summary: parsed.summary,
    key_points: parsed.key_points,
    word_count_original: input.text.split(/\s+/).length,
    word_count_summary: parsed.summary.split(/\s+/).length,
  };
}
