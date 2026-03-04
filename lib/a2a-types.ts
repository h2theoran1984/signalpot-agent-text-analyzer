export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
}

export interface A2ATextPart {
  type: "text";
  text: string;
}

export interface A2ADataPart {
  type: "data";
  data: Record<string, unknown>;
  mimeType?: string;
}

export type A2APart = A2ATextPart | A2ADataPart;

export interface A2ATask {
  id: string;
  status: { state: "completed" | "failed" | "working" };
  artifacts?: Array<{ parts: A2APart[] }>;
  error?: { message: string };
}

export interface MessageSendParams {
  message: A2AMessage;
  metadata?: {
    capability_used?: string;
    [key: string]: unknown;
  };
}
