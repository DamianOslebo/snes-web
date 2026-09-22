import { describe, expect, it } from 'vitest';
import { parseToolReply } from '../src/agent/tool-protocol';

const XML_TOOL = '<function=asm_assemble><parameter=args>{"note":"x"}</parameter></function>';

describe('parseToolReply — the structured tool-call protocol', () => {
  it('parses a clean {tool, args} object', () => {
    const p = parseToolReply('{"tool":"asm_assemble","args":{}}');
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'asm_assemble', args: {} }]);
  });

  it('parses a tool call with real args', () => {
    const src = 'reset:\\n  bra reset';
    const p = parseToolReply(`{"tool":"asm_set_source","args":{"source":"${src}"}}`);
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'asm_set_source', args: { source: 'reset:\n  bra reset' } }]);
  });

  it('accepts the function/arguments alias', () => {
    const p = parseToolReply('{"function":"gfx_export_vram","arguments":{"destName":"vram.bin"}}');
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'gfx_export_vram', args: { destName: 'vram.bin' } }]);
  });

  it('accepts name + arguments (OpenAI shape)', () => {
    const p = parseToolReply('{"name":"trk_export_spc","arguments":{"destName":"spc.bin"}}');
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'trk_export_spc', args: { destName: 'spc.bin' } }]);
  });

  it('treats a bare {"name":...} WITHOUT args as a reply, not a call', () => {
    const p = parseToolReply('{"name":"hello-world","size":12345}');
    expect(p.kind).toBe('reply');
    expect(p.calls).toEqual([]);
  });

  it('parses args given as a JSON string', () => {
    const p = parseToolReply('{"tool":"asm_build_rom","args":"{\\"note\\":\\"x\\"}"}');
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'asm_build_rom', args: { note: 'x' } }]);
  });

  it('parses a JSON array of calls (parallel tools)', () => {
    const p = parseToolReply('[{"tool":"asm_assemble","args":{}},{"tool":"asm_run","args":{}}]');
    expect(p.kind).toBe('call');
    expect(p.calls.map((c) => c.name)).toEqual(['asm_assemble', 'asm_run']);
  });

  it('extracts a single call from surrounding prose', () => {
    const p = parseToolReply(
      'Sure — here is the build: {"tool":"asm_build_rom","args":{}}. Tell me when done.',
    );
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'asm_build_rom', args: {} }]);
  });

  it('strips a markdown code fence', () => {
    const p = parseToolReply('```json\n{"tool":"asm_run","args":{}}\n```');
    expect(p.kind).toBe('call');
    expect(p.calls).toEqual([{ name: 'asm_run', args: {} }]);
  });

  it('returns an empty reply for empty/whitespace content', () => {
    expect(parseToolReply('').kind).toBe('reply');
    expect(parseToolReply('   \n  ').kind).toBe('reply');
  });

  it('treats a plain-English summary as a clean final reply (SUCCESS)', () => {
    const p = parseToolReply('Done! I built the ROM and ran it — open the assembler page to watch it.');
    expect(p.kind).toBe('reply');
    expect(p.calls).toEqual([]);
  });

  it('treats a JSON data object that is NOT a tool call as a reply', () => {
    const p = parseToolReply('{"ok":true,"byteCount":12345,"lines":3}');
    expect(p.kind).toBe('reply');
    expect(p.calls).toEqual([]);
  });

  it('flags Ollama-style XML tool markup as malformed (nudge, not fail)', () => {
    const p = parseToolReply(XML_TOOL);
    expect(p.kind).toBe('malformed');
    expect(p.calls).toEqual([]);
  });

  it('flags a broken (truncated) JSON tool object as malformed', () => {
    const p = parseToolReply('{"tool":"asm_assemble","args":{  ← truncated');
    expect(p.kind).toBe('malformed');
  });

  it('flags a JSON object with a non-string tool as malformed', () => {
    const p = parseToolReply('{"tool":123,"args":{}}');
    expect(p.kind).toBe('malformed');
  });

  it('classifies a lone JSON null as a clean reply, not a call', () => {
    expect(parseToolReply('null').kind).toBe('reply');
  });
});
