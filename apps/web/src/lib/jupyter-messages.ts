import type { JupyterOutput } from "@odoginote/shared";

export type JupyterChannel = "shell" | "iopub" | "stdin" | "control" | "heartbeat";

export interface JupyterMessageHeader {
  msg_id: string;
  msg_type: string;
  username: string;
  session: string;
  date: string;
  version: string;
}

export interface JupyterWireMessage {
  header: JupyterMessageHeader;
  parent_header: JupyterMessageHeader | Record<string, never>;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
  channel?: JupyterChannel;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createMessageId(): string {
  return crypto.randomUUID();
}

export function createMessage(
  msgType: string,
  content: Record<string, unknown>,
  session: string,
  parentHeader: JupyterMessageHeader | Record<string, never> = {}
): JupyterWireMessage {
  return {
    header: {
      msg_id: createMessageId(),
      msg_type: msgType,
      username: "ginote",
      session,
      date: new Date().toISOString(),
      version: "5.3",
    },
    parent_header: parentHeader,
    metadata: {},
    content,
  };
}

export function encodeWireMessage(channel: JupyterChannel, msg: JupyterWireMessage): string {
  return JSON.stringify([channel, msg.header, msg.parent_header, msg.metadata, msg.content]);
}

export function decodeWireMessage(raw: string): JupyterWireMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 5) return null;
    const channel = parsed[0] as JupyterChannel;
    const [header, parent_header, metadata, content] = parsed.slice(1, 5) as [
      JupyterMessageHeader,
      JupyterMessageHeader | Record<string, never>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    if (!header?.msg_type) return null;
    return { header, parent_header, metadata, content, channel };
  } catch {
    return null;
  }
}

function normalizeText(value: unknown): string | string[] | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String);
  return undefined;
}

export function iopubToOutput(msg: JupyterWireMessage): JupyterOutput | null {
  const { msg_type } = msg.header;
  const content = msg.content;

  if (msg_type === "stream") {
    const name = content.name === "stderr" ? "stderr" : "stdout";
    const text = normalizeText(content.text);
    if (!text) return null;
    return { output_type: "stream", name, text };
  }

  if (msg_type === "execute_result" || msg_type === "display_data") {
    const data = content.data as Record<string, string | string[]> | undefined;
    if (!data) return null;
    const normalized: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(data)) {
      const t = normalizeText(v);
      if (t != null) normalized[k] = t;
    }
    return {
      output_type: msg_type,
      data: normalized,
    } as JupyterOutput;
  }

  if (msg_type === "error") {
    return {
      output_type: "error",
      ename: String(content.ename ?? "Error"),
      evalue: String(content.evalue ?? ""),
      traceback: Array.isArray(content.traceback)
        ? content.traceback.map(String)
        : undefined,
    };
  }

  return null;
}

export function isIdleStatus(msg: JupyterWireMessage, parentMsgId: string): boolean {
  return (
    msg.channel === "iopub" &&
    msg.header.msg_type === "status" &&
    msg.content.execution_state === "idle" &&
    (msg.parent_header as JupyterMessageHeader)?.msg_id === parentMsgId
  );
}

export function isExecuteReplyOk(msg: JupyterWireMessage, parentMsgId: string): boolean {
  return (
    msg.channel === "shell" &&
    msg.header.msg_type === "execute_reply" &&
    (msg.parent_header as JupyterMessageHeader)?.msg_id === parentMsgId &&
    msg.content.status === "ok"
  );
}

export function isExecuteReplyError(msg: JupyterWireMessage, parentMsgId: string): boolean {
  return (
    msg.channel === "shell" &&
    msg.header.msg_type === "execute_reply" &&
    (msg.parent_header as JupyterMessageHeader)?.msg_id === parentMsgId &&
    msg.content.status === "error"
  );
}
