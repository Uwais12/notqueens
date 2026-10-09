import type { Transport } from "./elm";

export const hex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
export const parseHex = (s: string) => (s.match(/[0-9A-Fa-f]{2}/g) || []).map((h) => parseInt(h, 16));

const NRC: Record<number, string> = {
  0x11: "service not supported", 0x12: "sub-function not supported", 0x13: "incorrect length",
  0x22: "conditions not correct (ignition on, engine off?)", 0x31: "request out of range",
  0x33: "security access denied", 0x35: "invalid key", 0x36: "exceeded attempts", 0x37: "time delay not expired",
  0x72: "general programming failure", 0x7e: "not supported in active session", 0x7f: "not supported in active session",
};

export class UdsError extends Error { constructor(msg: string, public nrc?: number) { super(msg); } }

/** Turn ELM327 (CAF1, headers off) output into a byte array, handling ISO-TP multi-frame formatting. */
export function parseElm(raw: string): number[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => /NO DATA|ERROR|UNABLE|STOPPED|BUS|CAN ERROR|\?/.test(l))) throw new UdsError(`Adapter: ${raw}`);
  if (lines.length > 1 && /^[0-9A-F]{3}$/i.test(lines[0])) {
    const len = parseInt(lines[0], 16);
    const data = lines.slice(1).flatMap((l) => parseHex(l.replace(/^[0-9A-F]+:/i, "")));
    return data.slice(0, len);
  }
  // Single-frame. Pending (7F xx 78) responses may precede the real one; keep the last line.
  const frames = lines.map((l) => parseHex(l.replace(/^[0-9A-F]+:/i, "")));
  const real = frames.filter((f) => !(f[0] === 0x7f && f[2] === 0x78));
  return real[real.length - 1] || frames[frames.length - 1] || [];
}

export interface Ecu { addr: string; name: string; tx: number; rx: number; }

export class Uds {
  private current?: Ecu;
  constructor(public t: Transport) {}

  async select(e: Ecu) {
    if (this.current?.tx === e.tx) return;
    const tx = e.tx.toString(16).toUpperCase(), rx = e.rx.toString(16).toUpperCase();
    for (const c of [`ATSH${tx}`, `ATCRA${rx}`, `ATFCSH${tx}`, "ATFCSD300000", "ATFCSM1", "ATST96"]) await this.t.cmd(c);
    this.current = e;
  }

  async request(e: Ecu, req: number[], timeout = 5000): Promise<number[]> {
    await this.select(e);
    let resp = parseElm(await this.t.cmd(hex(req).replace(/ /g, ""), timeout));
    if (resp[0] === 0x7f) {
      const code = resp[2];
      throw new UdsError(`ECU ${e.addr} rejected ${hex([req[0]])}: ${NRC[code] || "NRC 0x" + code?.toString(16)}`, code);
    }
    if (resp[0] !== req[0] + 0x40) throw new UdsError(`Unexpected reply from ${e.addr}: ${hex(resp)}`);
    return resp;
  }

  async readDid(e: Ecu, did: number) {
    const r = await this.request(e, [0x22, did >> 8, did & 0xff]);
    return r.slice(3);
  }
  async readAscii(e: Ecu, did: number) {
    try { return String.fromCharCode(...(await this.readDid(e, did)).filter((c) => c >= 32 && c < 127)).trim(); }
    catch { return ""; }
  }
  readCoding(e: Ecu) { return this.readDid(e, 0x0600); }

  /** VAG "login" style security access: key = seed + login (32-bit). Works on many MQB modules with 20103. */
  async securityAccess(e: Ecu, login: number, level = 0x03) {
    const r = await this.request(e, [0x27, level]);
    const seed = r.slice(2);
    if (seed.every((b) => b === 0)) return;
    const s = seed.reduce((a, b) => (a * 256 + b) >>> 0, 0);
    const k = (s + login) >>> 0;
    await this.request(e, [0x27, level + 1, (k >>> 24) & 0xff, (k >>> 16) & 0xff, (k >>> 8) & 0xff, k & 0xff]);
  }

  /** Write long coding (DID 0x0600). Requests > 7 bytes are sent as manual ISO-TP frames because ELM327 can't segment. */
  async writeCoding(e: Ecu, coding: number[], login?: number) {
    await this.request(e, [0x10, 0x03]);
    if (login) await this.securityAccess(e, login);
    const payload = [0x2e, 0x06, 0x00, ...coding];
    if (payload.length <= 7) { await this.request(e, payload, 8000); return; }
    await this.sendIsoTp(e, payload);
  }

  private async sendIsoTp(e: Ecu, payload: number[]) {
    await this.select(e);
    const t = this.t;
    await t.cmd("ATCAF0");
    try {
      const len = payload.length;
      const ff = [0x10 | (len >> 8), len & 0xff, ...payload.slice(0, 6)];
      const fcRaw = await t.cmd(hex(ff).replace(/ /g, ""), 3000);
      const fc = parseHex(fcRaw.split("\n").pop() || "");
      if ((fc[0] & 0xf0) !== 0x30) throw new UdsError(`No flow control from ECU (${fcRaw})`);
      const stMin = Math.min(fc[2] ?? 0, 127);
      let idx = 6, sn = 1;
      await t.cmd("ATR0");
      while (idx < len) {
        const chunk = payload.slice(idx, idx + 7);
        idx += 7;
        const frame = [0x20 | (sn++ & 0x0f), ...chunk];
        while (frame.length < 8) frame.push(0xaa);
        if (idx >= len) await t.cmd("ATR1");
        const out = await t.cmd(hex(frame).replace(/ /g, ""), 8000);
        if (idx >= len) {
          const lines = out.split("\n").map(parseHex).filter((f) => f.length);
          const last = lines.filter((f) => !(f[1] === 0x7f && f[3] === 0x78)).pop() || [];
          const data = last.slice(1, 1 + (last[0] & 0x0f));
          if (data[0] === 0x7f) throw new UdsError(`Write rejected: ${NRC[data[2]] || hex(data)}`, data[2]);
          if (data[0] !== 0x6e) throw new UdsError(`Unexpected write reply: ${out}`);
        } else if (stMin) await new Promise((r) => setTimeout(r, stMin));
      }
    } finally {
      await t.cmd("ATR1").catch(() => {});
      await t.cmd("ATCAF1").catch(() => {});
    }
  }
}
