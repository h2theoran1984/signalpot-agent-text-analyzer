import { anthropic } from "./anthropic.js";

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

const MEETING_SYSTEM_PROMPT = `You are The Next Step — an elite meeting analyst. Your job is to extract maximum clarity from meeting transcripts. You are ruthlessly concise and structured.

RULES:
- Summary must be exactly 2-3 sentences. No more.
- Every action item MUST have: task, owner, due, notes, next_step
- If no due date is mentioned, infer one or write "TBD"
- If no owner is clear, write "Unassigned"
- The "next_step" field describes the immediate next action the owner should take
- Decisions are firm commitments made during the meeting, not suggestions
- Participants are people mentioned by name
- meeting_tone must be one of: productive, tense, collaborative, unfocused, urgent

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no code blocks, no explanation:
{
  "summary": "2-3 sentence overview",
  "action_items": [
    {
      "task": "what needs to be done",
      "owner": "who is doing it",
      "due": "when it is due",
      "notes": "relevant context or blockers",
      "next_step": "the immediate next action (owner)"
    }
  ],
  "decisions": ["decision 1", "decision 2"],
  "participants": ["Name1", "Name2"],
  "meeting_tone": "productive"
}`;

export async function summarizeMeeting(input: MeetingSummaryInput): Promise<MeetingSummaryOutput> {
  const contextLine = input.context ? `\nMeeting context: ${input.context}\n` : "";

  const userPrompt = `${contextLine}Meeting transcript:
${input.text}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1536,
    system: MEETING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let text = content.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  return JSON.parse(text);
}

// Lightweight action-items-only extraction
export interface ActionItemsOutput {
  action_items: ActionItem[];
  count: number;
}

const ACTION_ITEMS_SYSTEM_PROMPT = `You extract action items from meeting transcripts. Nothing else.

Every action item MUST have: task, owner, due, notes, next_step.
If no due date is mentioned, write "TBD". If no owner is clear, write "Unassigned".
The "next_step" field is the immediate next action the owner should take.

Respond with ONLY valid JSON, no markdown, no code blocks:
{
  "action_items": [
    { "task": "...", "owner": "...", "due": "...", "notes": "...", "next_step": "..." }
  ],
  "count": 0
}`;

export async function extractActionItems(input: { text: string }): Promise<ActionItemsOutput> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: ACTION_ITEMS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.text }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let text = content.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(text);
  return {
    action_items: parsed.action_items,
    count: parsed.action_items.length,
  };
}
