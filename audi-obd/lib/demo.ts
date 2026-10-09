import type { Transport } from "./elm";
// Simulated adapter so the UI can be explored without a car.
export class DemoElm implements Transport {
  name = "Demo adapter (simulated)";
  private tx = "7E0";
  private coding: Record<string, string> = {
    "70E": "1C0E3A2F4B000700A0C0010000000000", "714": "2A04C0E10F2200", "773": "0103A5110080",
    "7E0": "0119000C24000000",
  };
  private caf = true; private tp: number[] = []; private tpLen = 0;
  async cmd(l: string) {
    await new Promise((r) => setTimeout(r, 40));
    if (l === "ATCAF0") { this.caf = false; return "OK"; }
    if (l === "ATCAF1") { this.caf = true; return "OK"; }
    if (!this.caf && !l.startsWith("AT")) {
      const b = l.match(/../g)!.map((h) => parseInt(h, 16));
      if ((b[0] & 0xf0) === 0x10) { this.tpLen = ((b[0] & 15) << 8) | b[1]; this.tp = b.slice(2); return "30 00 00"; }
      this.tp.push(...b.slice(1));
      if (this.tp.length < this.tpLen) return "";
      const d = this.tp.slice(0, this.tpLen);
      this.coding[this.tx] = d.slice(3).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join("");
      return "03 6E 06 00 AA AA AA AA";
    }
    if (l.startsWith("ATSH")) { this.tx = l.slice(4); return "OK"; }
    if (l === "ATI") return "ELM327 v1.5 (demo)";
    if (l === "ATRV") return "12.6V";
    if (l.startsWith("AT")) return "OK";
    if (l.startsWith("2E0600")) { this.coding[this.tx] = l.slice(6); return "03 6E 06 00"; }
    if (l === "220600") return this.coding[this.tx] ? "62 06 00 " + this.coding[this.tx].match(/../g)!.join(" ") : "NO DATA";
    if (l === "22F187") return this.coding[this.tx] ? "62 F1 87 38 53 30 39 30 37 30 36 32 20 20" : "NO DATA";
    if (l === "22F19E") return this.coding[this.tx] ? "62 F1 9E 45 56 5F 44 45 4D 4F" : "NO DATA";
    if (l === "0902") return "014\n0: 49 02 01 54 52 55\n1: 5A 5A 5A 46 56 31 4C\n2: 31 30 30 30 30 30 31";
    if (l === "03") return "43 01 01 71";
    if (l === "04") return "44";
    if (l.startsWith("1003") || l.startsWith("10")) return "50 03 00 32 01 F4";
    if (l.startsWith("01")) {
      const p = parseInt(l.slice(2), 16), r = () => Math.floor(Math.random() * 40);
      const v: Record<number, number[]> = { 12: [0x0c + (r() % 3), r()], 13: [r()], 5: [130], 15: [62], 4: [60 + r()], 17: [40 + r()], 11: [100 + r()], 92: [128], 47: [150] };
      return v[p] ? `41 ${p.toString(16).padStart(2, "0")} ` + v[p].map((x) => x.toString(16).padStart(2, "0")).join(" ") : "NO DATA";
    }
    return "NO DATA";
  }
  async close() {}
}
