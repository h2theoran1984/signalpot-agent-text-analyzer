import { anthropic, logApiCost, type CostInfo } from "./anthropic.js";
import { trackCost } from "./cost-tracker.js";
import { getActivePrompt } from "./prompt-loader.js";

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
DATE RULES (MANDATORY — never skip):
1. Find the meeting date and its day-of-week from the transcript or the "Meeting date:" header.
2. Use this offset table to convert named days. Add the offset to the meeting date:
   If meeting is MONDAY:    Mon=+0 Tue=+1 Wed=+2 Thu=+3 Fri=+4 Sat=+5 Sun=+6
   If meeting is TUESDAY:   Tue=+0 Wed=+1 Thu=+2 Fri=+3 Sat=+4 Sun=+5 Mon=+6
   If meeting is WEDNESDAY: Wed=+0 Thu=+1 Fri=+2 Sat=+3 Sun=+4 Mon=+5 Tue=+6
   If meeting is THURSDAY:  Thu=+0 Fri=+1 Sat=+2 Sun=+3 Mon=+4 Tue=+5 Wed=+6
   If meeting is FRIDAY:    Fri=+0 Sat=+1 Sun=+2 Mon=+3 Tue=+4 Wed=+5 Thu=+6
3. "Today" = +0. "Tomorrow" = +1. "End of day"/"EOD" = +0 (same day).
4. Output "due" as YYYY-MM-DD only. NEVER output words like "Tuesday", "Friday", "Tomorrow", "EOD".
5. Example: Monday 2026-03-09 → "today"=2026-03-09, "tomorrow"=2026-03-10, "Tuesday EOD"=2026-03-10, "Wednesday"=2026-03-11, "Friday"=2026-03-13.
BREVITY IS CRITICAL: summary under 40 words. Each notes/next_step under 8 words. Each task under 12 words. Each decision under 15 words. Minimize total output tokens.`;

export async function summarizeMeeting(input: MeetingSummaryInput): Promise<{ data: MeetingSummaryOutput; cost: CostInfo }> {
  const config = await getActivePrompt("signalpot/meeting-summary@v1");
  const contextLine = input.context ? `\nMeeting context: ${input.context}\n` : "";

  // Inject current date so the model has an anchor for resolving relative dates
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const isoDate = now.toISOString().split("T")[0];
  const dayName = days[now.getDay()];
  const dateLine = `Meeting date (use as fallback if not stated in transcript): ${isoDate} (${dayName})\n`;

  const userPrompt = `${dateLine}${contextLine}Meeting transcript:
${input.text}`;

  const message = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.max_tokens,
    system: config.system_prompt,
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
Rules: "TBD" if no due date. "Unassigned" if no owner. Keep fields SHORT — under 15 words each.
DATE RULES (MANDATORY — never skip):
1. Find the meeting date and its day-of-week from the transcript or the "Meeting date:" header.
2. Use this offset table to convert named days. Add the offset to the meeting date:
   If meeting is MONDAY:    Mon=+0 Tue=+1 Wed=+2 Thu=+3 Fri=+4 Sat=+5 Sun=+6
   If meeting is TUESDAY:   Tue=+0 Wed=+1 Thu=+2 Fri=+3 Sat=+4 Sun=+5 Mon=+6
   If meeting is WEDNESDAY: Wed=+0 Thu=+1 Fri=+2 Sat=+3 Sun=+4 Mon=+5 Tue=+6
   If meeting is THURSDAY:  Thu=+0 Fri=+1 Sat=+2 Sun=+3 Mon=+4 Tue=+5 Wed=+6
   If meeting is FRIDAY:    Fri=+0 Sat=+1 Sun=+2 Mon=+3 Tue=+4 Wed=+5 Thu=+6
3. "Today" = +0. "Tomorrow" = +1. "End of day"/"EOD" = +0 (same day).
4. Output "due" as YYYY-MM-DD only. NEVER output words like "Tuesday", "Friday", "Tomorrow", "EOD".
5. Example: Monday 2026-03-09 → "today"=2026-03-09, "tomorrow"=2026-03-10, "Tuesday EOD"=2026-03-10, "Wednesday"=2026-03-11, "Friday"=2026-03-13.`;

export async function extractActionItems(input: { text: string }): Promise<{ data: ActionItemsOutput; cost: CostInfo }> {
  const config = await getActivePrompt("signalpot/action-items@v1");

  // Inject current date so the model has an anchor for resolving relative dates
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const isoDate = now.toISOString().split("T")[0];
  const dayName = days[now.getDay()];
  const dateLine = `Meeting date (use as fallback if not stated in transcript): ${isoDate} (${dayName})\n\n`;

  const message = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.max_tokens,
    system: config.system_prompt,
    messages: [{ role: "user", content: dateLine + input.text }],
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
