import { anthropic, logApiCost, type CostInfo } from "./anthropic.js";
import { trackCost } from "./cost-tracker.js";

export interface MeetingSummaryInput {
  text: string;
  context?: string;
}

export interface ActionItem {
  task: string;
  owner: string;
  due: string;
  notes: string;
  next_step: string;
}

export interface MeetingSummaryOutput {
  summary: string;
  action_items: ActionItem[];
  decisions: string[];
  participants: string[];
  meeting_tone: string;
}

const MEETING_SYSTEM_PROMPT = `Expert meeting summarizer. Concise, accurate, structured. Never fabricate facts.

Output ONLY valid JSON (no markdown, no explanation):
{"summary":"2-3 sentences max","action_items":[{"task":"...","owner":"...","due":"...","notes":"...","next_step":"..."}],"decisions":["..."],"participants":["..."],"meeting_tone":"productive|tense|collaborative|unfocused|urgent"}

Rules: Infer due dates or use "TBD". Unassigned if no owner. Decisions = firm commitments only.
BREVITY IS CRITICAL: summary under 40 words. Each notes/next_step under 8 words. Each task under 12 words. Each decision under 15 words. Minimize total output tokens.`;

export async function summarizeMeeting(input: MeetingSummaryInput): Promise<{ data: MeetingSummaryOutput; cost: CostInfo }> {
  const contextLine = input.context ? `\nMeeting context: ${input.context}\n` : "";

  const userPrompt = `${contextLine}Meeting transcript:
${input.text}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: MEETING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const cost = logApiCost("meeting-summary", message.usage);
  await trackCost("meeting-summary", { ...cost, revenue_usd: cost.revenue_usd });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let text = content.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  return { data: JSON.parse(text), cost };
}

// Lightweight action-items-only extraction
export interface ActionItemsOutput {
  action_items: ActionItem[];
  count: number;
}

const ACTION_ITEMS_SYSTEM_PROMPT = `Extract action items from meeting transcripts. Output ONLY valid JSON (no markdown).
{"action_items":[{"task":"...","owner":"...","due":"...","notes":"...","next_step":"..."}],"count":0}
Rules: "TBD" if no due date. "Unassigned" if no owner. Keep fields SHORT — under 15 words each.`;

export async function extractActionItems(input: { text: string }): Promise<{ data: ActionItemsOutput; cost: CostInfo }> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: ACTION_ITEMS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.text }],
  });

  const cost = logApiCost("action-items", message.usage);
  await trackCost("action-items", { ...cost, revenue_usd: cost.revenue_usd });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let text = content.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(text);
  return {
    data: {
      action_items: parsed.action_items,
      count: parsed.action_items.length,
    },
    cost,
  };
}
