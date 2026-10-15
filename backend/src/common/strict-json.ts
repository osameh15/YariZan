import { requireCondition } from "./errors";
import { canonical } from "../signing/signing";

// Validate before Express parses. Reject duplicate keys and non-integer lexical numbers.
export function strictJson(text: string): unknown {
  requireCondition(Buffer.byteLength(text) <= 32768, "INVALID_REQUEST");
  let offset = 0;
  const whitespace = () => {
    while (/[\x20\t\r\n]/.test(text[offset] ?? "!")) offset++;
  };
  const string = () => {
    const pattern = /"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
    pattern.lastIndex = offset;
    const m = pattern.exec(text);
    requireCondition(m, "INVALID_REQUEST");
    offset = pattern.lastIndex;
    return JSON.parse(m[0]) as string;
  };
  const value = (depth: number): void => {
    requireCondition(depth <= 8, "INVALID_REQUEST");
    whitespace();
    const ch = text[offset];
    if (ch === '"') {
      string();
      return;
    }
    if (ch === "{") {
      offset++;
      whitespace();
      const keys = new Set<string>();
      if (text[offset] === "}") {
        offset++;
        return;
      }
      while (true) {
        whitespace();
        const k = string();
        requireCondition(!keys.has(k), "INVALID_REQUEST");
        keys.add(k);
        whitespace();
        requireCondition(text[offset++] === ":", "INVALID_REQUEST");
        value(depth + 1);
        whitespace();
        const end = text[offset++];
        if (end === "}") return;
        requireCondition(end === ",", "INVALID_REQUEST");
      }
    }
    if (ch === "[") {
      offset++;
      whitespace();
      if (text[offset] === "]") {
        offset++;
        return;
      }
      while (true) {
        value(depth + 1);
        whitespace();
        const end = text[offset++];
        if (end === "]") return;
        requireCondition(end === ",", "INVALID_REQUEST");
      }
    }
    const p = /(?:true|false|null|-?(?:0|[1-9][0-9]*))/y;
    p.lastIndex = offset;
    const m = p.exec(text);
    requireCondition(m, "INVALID_REQUEST");
    offset = p.lastIndex;
  };
  value(0);
  whitespace();
  requireCondition(offset === text.length, "INVALID_REQUEST");
  const parsed: unknown = JSON.parse(text);
  canonical(parsed);
  return parsed;
}
