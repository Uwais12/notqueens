"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BleElm, initElm, type Transport } from "@/lib/elm";
import { DemoElm } from "@/lib/demo";
import { Uds, hex, parseElm, type Ecu } from "@/lib/uds";
import { ECUS, OPTIONS, PIDS, type Option } from "@/lib/catalog";
import Dump from "./dump";

type Tab = "options" | "coding" | "live" | "faults" | "dump" | "log";
interface ModInfo { ecu: Ecu; part: string; name: string; coding?: number[]; err?: string }
interface Binding { module: string; byte: number; bit: number }
interface Backup { at: string; vin: string; module: string; coding: string }

const load = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const getBit = (c: number[] | undefined, b: Binding) => !!c && ((c[b.byte] >> b.bit) & 1) === 1;

export default function Home() {
  const [tab, setTab] = useState<Tab>("options");
  const [t, setT] = useState<Transport | null>(null);
  const [busy, setBusy] = useState("");
  const [info, setInfo] = useState({ ver: "", volts: "", vin: "" });
  const [mods, setMods] = useState<Record<string, ModInfo>>({});
  const [log, setLog] = useState<{ d: string; m: string }[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [bindings, setBindings] = useState<Record<string, Binding>>({});
  const [backups, setBackups] = useState<Backup[]>([]);
  const [supported, setSupported] = useState(true);
  const uds = useMemo(() => (t ? new Uds(t) : null), [t]);

  useEffect(() => {
    setSupported(BleElm.supported());
    setBindings(load("bindings", {}));
    setBackups(load("backups", []));
  }, []);

  const addLog = (d: string, m: string) => setLog((l) => [...l.slice(-400), { d, m }]);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { const m = (e as Error).message; addLog("err", m); setMsg({ kind: "err", text: m }); }
    finally { setBusy(""); }
  };

  const connect = (demo: boolean) => run("Connecting", async () => {
    let tr: Transport;
    if (demo) tr = new DemoElm();
    else { const b = new BleElm(addLog); await b.connect(() => { setT(null); addLog("info", "Disconnected"); }); tr = b; }
    const i = await initElm(tr);
    let vin = "";
    try { vin = String.fromCharCode(...parseElm(await tr.cmd("0902", 6000)).slice(3).filter((c) => c >= 48 && c < 91)); } catch {}
    setInfo({ ...i, vin }); setT(tr); setMods({});
  });

  const scan = () => run("Scanning modules", async () => {
    const out: Record<string, ModInfo> = {};
    for (const e of ECUS) {
      setBusy(`Scanning ${e.addr} ${e.name}`);
      try {
        const coding = await uds!.readCoding(e);
        out[e.addr] = { ecu: e, coding, part: await uds!.readAscii(e, 0xf187), name: await uds!.readAscii(e, 0xf19e) };
      } catch (err) {
        const m = (err as Error).message;
        if (!/NO DATA|Timeout/.test(m)) out[e.addr] = { ecu: e, part: "", name: "", err: m };
      }
      setMods({ ...out });
    }
  });

  const writeCoding = (addr: string, next: number[]) => run(`Writing ${addr}`, async () => {
    const m = mods[addr];
    if (!m?.coding) throw new Error("Read the module first.");
    const old = hex(m.coding), neu = hex(next);
    if (!confirm(`Write new coding to module ${addr} (${m.ecu.name})?\n\nOLD: ${old}\nNEW: ${neu}\n\nIgnition ON, engine OFF, battery healthy. A backup is saved first.`)) return;
    const b = [...backups, { at: new Date().toISOString(), vin: info.vin, module: addr, coding: old }];
    setBackups(b); save("backups", b);
    const login = Number(localStorage.getItem("login") || 0) || undefined;
    await uds!.writeCoding(m.ecu, next, login);
    const verify = await uds!.readCoding(m.ecu);
    setMods((s) => ({ ...s, [addr]: { ...m, coding: verify } }));
    if (hex(verify) !== neu) throw new Error(`Write acknowledged but read-back differs: ${hex(verify)}`);
    setMsg({ kind: "ok", text: `Module ${addr} coded and verified. Cycle the ignition to apply.` });
  });

  const setBinding = (id: string, b: Binding | null) => {
    const n = { ...bindings }; if (b) n[id] = b; else delete n[id];
    setBindings(n); save("bindings", n);
  };

  return (
    <main>
      <div className="top">
        <div><h1>TT Coder</h1><div className="mut">2020 Audi TT 8S · 2.0 TFSI 40 · FWD</div></div>
        <div className="row">
          {t ? <>
            <span className="pill high">● {t.name}</span>
            <button onClick={() => { t.close(); setT(null); }}>Disconnect</button>
          </> : <>
            <button className="p" disabled={!supported || !!busy} onClick={() => connect(false)}>Connect Bluetooth OBD</button>
            <button disabled={!!busy} onClick={() => connect(true)}>Demo</button>
          </>}
        </div>
      </div>

      {!supported && <div className="card warnbox">This browser doesn&apos;t support Web Bluetooth. Use <b>Chrome on Android</b>, or Chrome/Edge on a laptop. iPhone Safari won&apos;t work; the <b>Bluefy</b> browser app on iOS does. You also need a <b>BLE (Bluetooth Low Energy) ELM327</b> adapter, such as an OBDLink CX, vLinker MC+/FS BLE or Vgate iCar Pro BLE. Classic Bluetooth adapters can&apos;t be used from a web page.</div>}
      {busy && <div className="card">⏳ {busy}…</div>}
      {msg && <div className="card" style={{ borderColor: msg.kind === "ok" ? "var(--ok)" : "#ff7a7a" }}>{msg.text}</div>}
      {t && <div className="card row mut"><span>Adapter: {info.ver}</span><span>Battery: {info.volts}</span><span>VIN: {info.vin || "—"}</span></div>}

      <div className="tabs">
        {(["options", "coding", "live", "faults", "dump", "log"] as Tab[]).map((k) =>
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {{ options: "Options", coding: "Modules & Coding", live: "Live data", faults: "Fault codes", dump: "Full dump", log: "Log" }[k]}
          </button>)}
      </div>

      {tab === "options" && <Options mods={mods} bindings={bindings} connected={!!t} busy={!!busy}
        onScan={scan} onToggle={(o, on) => {
          const b = bindings[o.id], m = mods[b.module];
          if (!m?.coding) return;
          const next = [...m.coding];
          next[b.byte] = on ? next[b.byte] | (1 << b.bit) : next[b.byte] & ~(1 << b.bit);
          writeCoding(b.module, next);
        }} onBind={setBinding} />}
      {tab === "coding" && <Coding mods={mods} connected={!!t} busy={!!busy} onScan={scan} onWrite={writeCoding}
        backups={backups} vin={info.vin} onRead={(e) => run(`Reading ${e.addr}`, async () => {
          const coding = await uds!.readCoding(e);
          setMods((s) => ({ ...s, [e.addr]: { ecu: e, coding, part: s[e.addr]?.part || "", name: s[e.addr]?.name || "" } }));
        })} />}
      {tab === "live" && <Live uds={uds} t={t} />}
      {tab === "faults" && <Faults uds={uds} run={run} />}
      {tab === "dump" && <Dump t={t} uds={uds} vin={info.vin} onBusy={setBusy} />}
      {tab === "log" && <div className="card log">{log.map((l, i) => <div key={i} className={l.d}>{l.d === "tx" ? "→ " : l.d === "rx" ? "← " : "• "}{l.m}</div>)}</div>}

      <p className="mut">Use at your own risk. Coding changes are written to your car&apos;s control modules. Ignition on, engine off, and use a battery charger for long sessions. Every write backs up the old coding first; you can restore it from Modules &amp; Coding.</p>
    </main>
  );
}

function Options({ mods, bindings, connected, busy, onScan, onToggle, onBind }: {
  mods: Record<string, ModInfo>; bindings: Record<string, Binding>; connected: boolean; busy: boolean;
  onScan: () => void; onToggle: (o: Option, on: boolean) => void; onBind: (id: string, b: Binding | null) => void;
}) {
  const [cat, setCat] = useState("All");
  const [linking, setLinking] = useState<string | null>(null);
  const cats = ["All", ...Array.from(new Set(OPTIONS.map((o) => o.category)))];
  const list = OPTIONS.filter((o) => cat === "All" || o.category === cat);
  return <>
    <div className="card">
      <h2>Available options for your TT</h2>
      <p className="mut">There are {OPTIONS.length} researched options. On the MQB platform most of them are stored as module coding or adaptation values, and their exact positions depend on each module&apos;s part number. Audi doesn&apos;t publish those positions. Scan your car first to see which modules respond. Then <b>link</b> an option to its coding byte/bit; you can confirm the bit by checking a VCDS/OBDeleven readout or by toggling the feature in the MMI and re-reading. Once linked, the switch reads and writes the real value on your car. Confidence shows how solid the research is.</p>
      <div className="row"><button className="p" disabled={!connected || busy} onClick={onScan}>Scan car modules</button>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
    </div>
    <div className="card">
      {list.map((o) => {
        const b = bindings[o.id], m = mods[o.module], present = !!m?.coding;
        const on = b ? getBit(mods[b.module]?.coding, b) : false;
        return <div key={o.id}>
          <div className="opt">
            <div>
              <div><b>{o.name}</b> <span className={`pill ${o.confidence}`}>{o.confidence}</span> <span className="pill">{o.module} · {o.category}</span></div>
              <div className="mut">{o.description} Channel: “{o.channel}”{o.values.length > 2 ? ` · values: ${o.values.join(" / ")}` : ""}</div>
              <div className="mut">{!connected ? "Connect to check your car" : !Object.keys(mods).length ? "Scan modules to check" : present ? `Module ${o.module} found` : `Module ${o.module} not found on this car`}
                {b && ` · linked to ${b.module} byte ${b.byte} bit ${b.bit}`}</div>
            </div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <button onClick={() => setLinking(linking === o.id ? null : o.id)}>{b ? "Edit" : "Link"}</button>
              <button aria-label={`Toggle ${o.name}`} className={`sw ${on ? "on" : ""}`} disabled={!b || !mods[b.module]?.coding || busy} onClick={() => onToggle(o, !on)} />
            </div>
          </div>
          {linking === o.id && <LinkForm o={o} b={b} mods={mods} onDone={(nb) => { onBind(o.id, nb); setLinking(null); }} />}
        </div>;
      })}
    </div>
  </>;
}

function LinkForm({ o, b, mods, onDone }: { o: Option; b?: Binding; mods: Record<string, ModInfo>; onDone: (b: Binding | null) => void }) {
  const [module, setModule] = useState(b?.module || o.module);
  const [byte, setByte] = useState(b?.byte ?? 0);
  const [bit, setBit] = useState(b?.bit ?? 0);
  const c = mods[module]?.coding;
  return <div className="card row" style={{ background: "#0f1317" }}>
    <select value={module} onChange={(e) => setModule(e.target.value)}>{ECUS.map((e) => <option key={e.addr} value={e.addr}>{e.addr} {e.name}</option>)}</select>
    Byte <input type="number" min={0} max={c ? c.length - 1 : 63} value={byte} onChange={(e) => setByte(+e.target.value)} style={{ width: 70 }} />
    Bit <input type="number" min={0} max={7} value={bit} onChange={(e) => setBit(+e.target.value)} style={{ width: 60 }} />
    <span className="mut">{c ? `current: ${getBit(c, { module, byte, bit }) ? "1 (on)" : "0 (off)"}` : "module not read yet"}</span>
    <button className="p" onClick={() => onDone({ module, byte, bit })}>Save link</button>
    {b && <button onClick={() => onDone(null)}>Remove link</button>}
  </div>;
}

function Coding({ mods, connected, busy, onScan, onRead, onWrite, backups, vin }: {
  mods: Record<string, ModInfo>; connected: boolean; busy: boolean; onScan: () => void; onRead: (e: Ecu) => void;
  onWrite: (addr: string, c: number[]) => void; backups: Backup[]; vin: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<number[] | null>(null);
  const [byteIdx, setByteIdx] = useState(0);
  const [login, setLogin] = useState("");
  useEffect(() => { setLogin(localStorage.getItem("login") || ""); }, []);
  const m = sel ? mods[sel] : null;
  const ref = useRef<string>("");
  useEffect(() => { const k = sel + hex(m?.coding || []); if (k !== ref.current) { ref.current = k; setDraft(m?.coding ? [...m.coding] : null); } }, [sel, m]);

  return <>
    <div className="card">
      <h2>Control modules</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="p" disabled={!connected || busy} onClick={onScan}>Scan all modules</button>
        <span className="mut">Security login (optional, e.g. 20103):</span>
        <input value={login} onChange={(e) => { setLogin(e.target.value); try { localStorage.setItem("login", e.target.value); } catch {} }} style={{ width: 90 }} />
      </div>
      {ECUS.map((e) => { const x = mods[e.addr]; return (
        <div key={e.addr} className="opt">
          <div><b>{e.addr}</b> {e.name}<div className="mut">{x ? (x.err || `${x.part} ${x.name} · ${x.coding?.length} coding bytes`) : "not scanned"}</div></div>
          <div className="row"><button disabled={!connected || busy} onClick={() => onRead(e)}>Read</button>
            <button disabled={!x?.coding} onClick={() => { setSel(e.addr); setByteIdx(0); }}>Edit coding</button></div>
        </div>); })}
    </div>

    {m && draft && <div className="card">
      <h2>Long coding: {m.ecu.addr} {m.ecu.name}</h2>
      <div className="bytes">{draft.map((v, i) =>
        <div key={i} className={`byte ${i === byteIdx ? "sel" : ""} ${v !== m.coding![i] ? "chg" : ""}`} onClick={() => setByteIdx(i)}>
          <div className="mut">B{i}</div>{v.toString(16).padStart(2, "0").toUpperCase()}</div>)}</div>
      <div className="bits">{[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => { const on = ((draft[byteIdx] >> bit) & 1) === 1; return (
        <div key={bit} className={`bit ${on ? "on" : ""}`} onClick={() => { const d = [...draft]; d[byteIdx] ^= 1 << bit; setDraft(d); }}>
          <span>bit {bit}</span><b>{on ? 1 : 0}</b></div>); })}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setDraft([...m.coding!])}>Reset changes</button>
        <button className="p" disabled={busy || hex(draft) === hex(m.coding!)} onClick={() => onWrite(m.ecu.addr, draft)}>Write coding</button>
      </div>
    </div>}

    <div className="card">
      <h2>Backups ({backups.length})</h2>
      <p className="mut">The old coding is saved automatically before every write. Download a copy to keep it safe.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button disabled={!backups.length} onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(backups, null, 2)], { type: "application/json" }));
          a.download = `tt-coding-backup-${vin || "car"}.json`; a.click();
        }}>Download backups</button>
      </div>
      {backups.slice().reverse().map((b, i) => <div key={i} className="opt"><div><b>{b.module}</b> <span className="mut">{new Date(b.at).toLocaleString()}</span><div className="mut" style={{ fontFamily: "monospace" }}>{b.coding}</div></div>
        <button disabled={!mods[b.module]?.coding || busy} onClick={() => onWrite(b.module, b.coding.split(" ").map((h) => parseInt(h, 16)))}>Restore</button></div>)}
    </div>
  </>;
}

function Live({ uds, t }: { uds: Uds | null; t: Transport | null }) {
  const [vals, setVals] = useState<Record<number, string>>({});
  const [on, setOn] = useState(false);
  const [volts, setVolts] = useState("");
  useEffect(() => {
    if (!on || !t || !uds) return;
    let stop = false;
    (async () => {
      await uds.select(ECUS[0]);
      while (!stop) {
        for (const p of PIDS) {
          if (stop) break;
          try { const r = parseElm(await t.cmd("01" + p.pid.toString(16).padStart(2, "0"), 2000)); if (r[0] === 0x41) setVals((v) => ({ ...v, [p.pid]: String(p.f(r.slice(2))) })); }
          catch { setVals((v) => ({ ...v, [p.pid]: "n/a" })); }
        }
        try { setVolts(await t.cmd("ATRV")); } catch {}
      }
    })();
    return () => { stop = true; };
  }, [on, t, uds]);
  return <div className="card">
    <div className="row" style={{ marginBottom: 10 }}><h2 style={{ margin: 0 }}>Live data</h2>
      <button className="p" disabled={!t} onClick={() => setOn(!on)}>{on ? "Stop" : "Start"}</button></div>
    <div className="grid">
      <div className="stat"><span className="mut">Battery</span><b>{volts || "—"}</b></div>
      {PIDS.map((p) => <div key={p.pid} className="stat"><span className="mut">{p.name}</span><b>{vals[p.pid] ?? "—"} <small className="mut">{vals[p.pid] && vals[p.pid] !== "n/a" ? p.unit : ""}</small></b></div>)}
    </div>
  </div>;
}

const OBD: Ecu = { addr: "OBD", name: "OBD-II", tx: 0x7df, rx: 0x7e8 };

function Faults({ uds, run }: { uds: Uds | null; run: (l: string, f: () => Promise<void>) => Promise<void> }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const read = () => run("Reading fault codes", async () => {
    const r = await uds!.request(OBD, [0x03], 6000);
    const out: string[] = [];
    const data = r.slice(r.length % 2 === 0 ? 2 : 1);
    for (let i = 0; i + 1 < data.length; i += 2) {
      const a = data[i], b = data[i + 1]; if (!a && !b) continue;
      out.push("PCBU"[a >> 6] + ((a >> 4) & 3) + (a & 15).toString(16) + b.toString(16).padStart(2, "0").toUpperCase());
    }
    setCodes(out);
  });
  return <div className="card">
    <h2>Engine fault codes (OBD-II)</h2>
    <div className="row"><button className="p" disabled={!uds} onClick={read}>Read codes</button>
      <button disabled={!uds} onClick={() => confirm("Clear engine fault codes and the check-engine light?") && run("Clearing", async () => { await uds!.request(OBD, [0x04], 6000); setCodes([]); })}>Clear codes</button></div>
    {codes && <p>{codes.length ? codes.map((c) => <span key={c} className="pill" style={{ marginRight: 6 }}>{c.toUpperCase()}</span>) : "No stored fault codes 🎉"}</p>}
  </div>;
}
