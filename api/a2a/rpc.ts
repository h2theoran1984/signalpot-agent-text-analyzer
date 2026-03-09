import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { JSONRPCRequest, JSONRPCResponse, MessageSendParams } from "../../lib/a2a-types.js";
import { summarizeMeeting, extractActionItems } from "../../lib/summarize.js";
import { analyzeSentiment } from "../../lib/sentiment.js";

function jsonrpcError(id: string | number, code: number, message: string): JSONRPCResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessageSend(params: MessageSendParams): Promise<unknown> {
  const capability = params.metadata?.capability_used ?? "signalpot/meeting-summary@v1";
  const dataPart = params.message.parts.find((p) => p.type === "data") as
    | { type: "data"; data: Record<string, unknown> }
    | undefined;
  const textPart = params.message.parts.find((p) => p.type === "text") as
    | { type: "text"; text: string }
    | undefined;

  const text = (dataPart?.data?.text as string) ?? textPart?.text ?? "";
  if (!text) throw new Error("Missing text input");

  let result: unknown;

  if (capability === "signalpot/action-items@v1") {
    result = await extractActionItems({ text });
  } else if (capability === "signalpot/sentiment@v1") {
    result = await analyzeSentiment({ text });
  } else {
    // Default: meeting-summary
    const context = (dataPart?.data?.context as string) ?? undefined;
    result = await summarizeMeeting({ text, context });
  }

  return {
    id: crypto.randomUUID(),
    status: { state: "completed" },
    artifacts: [{ parts: [{ type: "data", data: result }] }],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as JSONRPCRequest;
  const id = body?.id ?? 0;

  try {
    if (body.method === "message/send") {
      const result = await handleMessageSend(body.params as MessageSendParams);
      const response: JSONRPCResponse = { jsonrpc: "2.0", id, result };
      return res.status(200).json(response);
    }

    return res.status(200).json(jsonrpcError(id, -32601, `Method not found: ${body.method}`));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(200).json(jsonrpcError(id, -32603, message));
  }
}
