"use client";
import { useRef, useState } from "react";
import type { Transport } from "@/lib/elm";
import { Uds, hex, parseElm, type Ecu } from "@/lib/uds";
import { ECUS } from "@/lib/catalog";

// Read-only identification + coding DIDs (UDS 0x22). Nothing here writes to the car.
const ID_DIDS: [number, string][] = [
  [0xf187, "part number"], [0xf189, "software version"], [0xf191, "hardware number"], [0xf1a3, "hardware version"],
  [0xf197, "system name"], [0xf19e, "ASAM/ODX dataset"], [0xf1a2, "ASAM/ODX version"], [0xf18c, "serial number"],
  [0xf17c, "FAZIT id"], [0xf1df, "coding status"], [0x0600, "long coding"], [0xf1aa, "workshop system name"],
];

const ascii = (b: number[]) => String.fromCharCode(...b.filter((c) => c >= 32 && c < 127)).trim();

export default function Dump({ t, uds, vin, onBusy }: { t: Transport | null; uds: Uds | null; vin: string; onBusy: (s: string) => void }) {
  const [deep, setDeep] = useState("17");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState("");
  const stop = useRef(false);

  const say = (s: string) => { setProgress(s); onBusy(s); };

  const tryDid = async (e: Ecu, did: number) => {
    try { return await uds!.readDid(e, did); }
    catch (err) { const m = (err as Error).message; return m.includes("rejected") ? null : undefined; } // null = module answered "no", undefined = silent
  };

  const runDump = async (sweep: boolean) => {
    if (!t || !uds) return;
    stop.current = false;
    const out: Record<string, unknown> = { app: "TT Coder dump v1", at: new Date().toISOString(), vin, car: "2020 Audi TT 8S 2.0 TFSI 40 FWD" };
    try {
      out.adapter = { id: await t.cmd("ATI"), dev: await t.cmd("AT@1").catch(() => ""), volts: await t.cmd("ATRV") };

      // 1. Find every module: VAG MQB diagnostic responses are request ID + 0x6A.
      const found: Ecu[] = [...ECUS.filter((e) => e.addr === "01" || e.addr === "02")];
      for (let tx = 0x700; tx <= 0x77f && !stop.current; tx++) {
        say(`Looking for modules… 0x${tx.toString(16)}`);
        const e: Ecu = { addr: tx.toString(16).toUpperCase(), name: "", tx, rx: tx + 0x6a };
        const known = ECUS.find((k) => k.tx === tx);
        if (known) { e.addr = known.addr; e.name = known.name; }
        const r = await tryDid(e, 0xf187);
        if (r !== undefined) found.push(e);
      }

      // 2. Identification + coding for each module.
      const modules: Record<string, unknown>[] = [];
      for (const e of found) {
        if (stop.current) break;
        const m: Record<string, unknown> = { addr: e.addr, name: e.name, tx: hex([e.tx >> 8, e.tx & 0xff]), rx: hex([e.rx >> 8, e.rx & 0xff]) };
        for (const [did, label] of ID_DIDS) {
          say(`Module ${e.addr}: ${label}`);
          const r = await tryDid(e, did);
          if (r) m[label] = did === 0x0600 || did === 0xf17c ? hex(r) : ascii(r) || hex(r);
        }
        modules.push(m);
        out.modules = modules;
        setResult({ ...out });
      }

      // 3. Optional: sweep data identifiers on one module to discover its adaptation channels.
      if (sweep && !stop.current) {
        const e = found.find((x) => x.addr.toUpperCase() === deep.toUpperCase());
        if (!e) throw new Error(`Module ${deep} wasn't found on the car.`);
        const dids: Record<string, string> = {};
        const ranges: [number, number][] = [[0x0100, 0x0fff], [0x2000, 0x2fff], [0xf100, 0xf1ff], [0xf400, 0xf4ff]];
        for (const [a, b] of ranges) for (let did = a; did <= b && !stop.current; did++) {
          if (did % 16 === 0) say(`Module ${e.addr} DID sweep 0x${did.toString(16)} (${Object.keys(dids).length} found)`);
          const r = await tryDid(e, did);
          if (r && r.length) dids[did.toString(16).toUpperCase().padStart(4, "0")] = hex(r);
        }
        out.didSweep = { module: e.addr, dids };
      }
      out.obdPidsSupported = await (async () => {
        try { await uds.select({ addr: "OBD", name: "", tx: 0x7df, rx: 0x7e8 }); return hex(parseElm(await t.cmd("0100"))); } catch { return null; }
      })();
      if (stop.current) out.stoppedEarly = true;
      setResult({ ...out });
      say("");
    } catch (err) {
      out.error = (err as Error).message; setResult({ ...out }); say("");
    }
  };

  const text = result ? JSON.stringify(result, null, 2) : "";
  const share = async () => {
    const file = new File([text], `tt-dump-${vin || "car"}.json`, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "TT dump" }); return; }
    } catch {}
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  };

  return <>
    <div className="card">
      <h2>Full car dump (read-only)</h2>
      <p className="mut">This checks every diagnostic address to find all modules, then reads each one&apos;s part number, software version, dataset name and long coding. It only reads; nothing is written. Ignition on, engine off. It takes about 2–4 minutes.</p>
      <div className="row">
        <button className="p" disabled={!t || !!progress} onClick={() => runDump(false)}>Dump all modules</button>
        <button disabled={!!progress} onClick={() => { stop.current = true; }}>Stop</button>
      </div>
      <p className="mut" style={{ marginTop: 14 }}><b>Deep scan (optional, slower):</b> also tries about 8,000 data IDs on one module to find its hidden settings, such as needle sweep in 17. It&apos;s still read-only and can take 10–20 minutes.</p>
      <div className="row">
        <select value={deep} onChange={(e) => setDeep(e.target.value)}>{["17", "09", "5F", "19", "03", "44", "42", "52"].map((a) => <option key={a} value={a}>{a} {ECUS.find((e) => e.addr === a)?.name}</option>)}</select>
        <button disabled={!t || !!progress} onClick={() => runDump(true)}>Dump + deep scan</button>
      </div>
      {progress && <p>⏳ {progress}</p>}
    </div>
    {result && <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="p" onClick={share}>Save / share file</button>
        <button onClick={() => navigator.clipboard?.writeText(text)}>Copy text</button>
        <span className="mut">{(result.modules as unknown[] | undefined)?.length ?? 0} modules</span>
      </div>
      <div className="log" style={{ maxHeight: 300 }}>{text}</div>
    </div>}
  </>;
}
