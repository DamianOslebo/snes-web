/**
 * `tool-protocol` — the client-side, structured tool-call convention.
 *
 * We deliberately do NOT rely on Ollama's server-side `tools:` template. That
 * path routes the model's tool intent through Ollama's text/XML templater,
 * which is the source of the "XML syntax error … line 3" class of failures
 * seen in the run log. Instead the model simply EMITS a tool call as a JSON
 * object inside its text reply (the same clean, structured shape Claude uses),
 * and we parse it here, tolerantly.
 *
 * Three outcomes, and only three:
 *   'call'      — a valid tool call (or array of them) was extracted.
 *   'reply'     — a clean final answer. MAY BE EMPTY. This is a SUCCESS, never
 *                 an error: the model can never be "wrong" by finishing.
 *   'malformed' — it clearly TRIED to call a tool (a tool name / XML / tool
 *                 keyword is present) but nothing valid parsed. The loop
 *                 nudges it back to the exact contract instead of failing.
 *
 * Pure and dependency-free: the only input is the reply text.
 */

export interface ProtocolCall {
  name: string;
  args: Record<string, unknown>;
}

export type ReplyKind = 'call' | 'reply' | 'malformed';

export interface ParsedReply {
  kind: ReplyKind;
  calls: ProtocolCall[];
  /** The reply text (used for logging / as the final answer on 'reply'). */
  text: string;
}

const NAME_KEYS = ['tool', 'function', 'name'] as const;
const ARG_KEYS = ['args', 'arguments', 'parameters'] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nameOf(o: Record<string, unknown>): string | undefined {
  for (const k of NAME_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

function argsOf(o: Record<string, unknown>): Record<string, unknown> {
  for (const k of ARG_KEYS) {
    const v = o[k];
    if (isObj(v)) return v;
    if (typeof v === 'string') {
      try {
        const p: unknown = JSON.parse(v);
        if (isObj(p)) return p;
      } catch {
        /* args-as-string that isn't JSON — treat as no args */
      }
    }
  }
  return {};
}

function toCall(o: Record<string, unknown>): ProtocolCall {
  return { name: nameOf(o) as string, args: argsOf(o) };
}

/**
 * A JSON value is a tool call iff it names a tool under `tool`/`function`,
 * OR under `name` *together with* an args-like key (a bare `{"name":…}` is far
 * too weak to trust — that shape also describes ordinary data).
 */
function isCallObj(v: unknown): v is Record<string, unknown> {
  if (!isObj(v)) return false;
  if (typeof v.tool === 'string' && v.tool.trim() !== '') return true;
  if (typeof v.function === 'string' && v.function.trim() !== '') return true;
  if (typeof v.name === 'string' && v.name.trim() !== '') {
    return ARG_KEYS.some((k) => v[k] !== undefined);
  }
  return false;
}

function callsFrom(v: unknown): ProtocolCall[] | undefined {
  if (isCallObj(v)) return [toCall(v)];
  if (Array.isArray(v) && v.length > 0 && v.some(isCallObj)) {
    return v.filter(isCallObj).map((o) => toCall(o));
  }
  return undefined;
}

/**
 * Scan `text` for the first balanced `{…}` or `[…]` (whichever starts
 * earliest) that parses as JSON. Respects string literals and escapes.
 * Returns `undefined` when nothing there parses.
 */
function firstJson(text: string): unknown {
  let bestStart = -1;
  for (const open of ['{', '[']) {
    const s = text.indexOf(open);
    if (s !== -1 && (bestStart === -1 || s < bestStart)) bestStart = s;
  }
  if (bestStart === -1) return undefined;
  const open = text[bestStart];
  const close = open === '{' ? '}' : ']';
  for (let start = bestStart; start !== -1; start = text.indexOf(open, start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          const slice = text.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            break; // unbalanced-or-invalid slice — try the next open bracket
          }
        }
      }
    }
  }
  return undefined;
}

// Strong markers that a reply was a TOOL ATTEMPT (so an unparseable one is a
// "malformed call" worth nudging, not a clean answer). Deliberately excludes
// the weak `"name":` shape — that alone is common in ordinary JSON data.
const TOOL_INTENT =
  /"tool"\s*:|"function"\s*:|"arguments"\s*:|"args"\s*:|tool_calls|<\s*\/?\s*function\b|<\s*\/?\s*parameter\b/i;

/**
 * True when `text` has an opening bracket (`{` or `[`, outside a string
 * literal) whose matching close never arrives — a JSON payload cut off
 * mid-flight, i.e. a truncated stream. This is the second "it clearly tried
 * to call a tool" marker: field logs showed replies of `[{"` and `[{"tool`
 * that carry NO `"tool":` keyword (the colon never arrived) and so were read
 * as clean final answers, ending the run. A genuine prose reply never leaves
 * a bracket dangling, so this cannot misfire on one. Stray CLOSING brackets
 * in prose do not count (the depth never goes negative).
 */
function unbalancedOpen(text: string): boolean {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth += 1;
    else if ((c === '}' || c === ']') && depth > 0) depth -= 1;
  }
  return depth > 0;
}

/**
 * Classify a model reply. `content` is the assistant's text (already the full,
 * accumulated message). Never throws.
 */
export function parseToolReply(content: string): ParsedReply {
  const raw = typeof content === 'string' ? content : String(content ?? '');
  if (raw.trim() === '') return { kind: 'reply', calls: [], text: '' };

  // A markdown fence, if the model wrapped the JSON in one.
  const fenced = raw
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  // 1) Whole reply is (fenced) JSON → use it directly.
  for (const cand of [fenced, raw]) {
    if (!cand) continue;
    try {
      const v: unknown = JSON.parse(cand);
      const calls = callsFrom(v);
      if (calls) return { kind: 'call', calls, text: raw };
    } catch {
      /* not whole-JSON — fall through to extraction */
    }
  }

  // 2) A JSON object/array sits inside surrounding prose.
  const extracted = firstJson(fenced) ?? firstJson(raw);
  if (extracted !== undefined) {
    const calls = callsFrom(extracted);
    if (calls) return { kind: 'call', calls, text: raw };
  }

  // 3) No valid call. A strong tool-attempt marker means "malformed"; an
  //    UNBALANCED opening bracket is the other one (a JSON payload cut off
  //    mid-flight — the `[{"` / `[{"tool` truncations from the field logs,
  //    which carry no `"tool":` keyword and used to end the run as a "reply").
  //    Otherwise this is a clean final answer.
  if (TOOL_INTENT.test(raw) || unbalancedOpen(raw)) return { kind: 'malformed', calls: [], text: raw };
  return { kind: 'reply', calls: [], text: raw };
}
