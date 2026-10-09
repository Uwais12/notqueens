// ELM327 over Bluetooth Low Energy (Web Bluetooth).
// Works with BLE adapters (OBDLink CX/MX+ BLE, vLinker MC+/FS BLE, Vgate iCar Pro BLE, Veepeak BLE...).
// Classic-Bluetooth (SPP) adapters cannot be reached from a browser.

export const BLE_SERVICES: BluetoothServiceUUID[] = [
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // OBDLink / vLinker
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip ISSC transparent UART
];

export type LogFn = (dir: "tx" | "rx" | "info" | "err", msg: string) => void;

export interface Transport {
  name: string;
  cmd(line: string, timeoutMs?: number): Promise<string>;
  close(): Promise<void>;
}

export class BleElm implements Transport {
  name = "";
  private device!: BluetoothDevice;
  private write!: BluetoothRemoteGATTCharacteristic;
  private buffer = "";
  private waiter: ((s: string) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private log: LogFn) {}

  static supported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  async connect(onDisconnect: () => void) {
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES,
    });
    this.name = this.device.name || "OBD adapter";
    this.device.addEventListener("gattserverdisconnected", onDisconnect);
    this.log("info", `Connecting to ${this.name}…`);
    const server = await this.device.gatt!.connect();
    let notify: BluetoothRemoteGATTCharacteristic | undefined;
    let write: BluetoothRemoteGATTCharacteristic | undefined;
    for (const uuid of BLE_SERVICES) {
      let svc: BluetoothRemoteGATTService;
      try { svc = await server.getPrimaryService(uuid); } catch { continue; }
      for (const c of await svc.getCharacteristics()) {
        if (!notify && (c.properties.notify || c.properties.indicate)) notify = c;
        if (!write && (c.properties.write || c.properties.writeWithoutResponse)) write = c;
      }
      if (notify && write) break;
      notify = write = undefined;
    }
    if (!notify || !write) throw new Error("This adapter doesn't expose a known ELM327 BLE serial service.");
    this.write = write;
    await notify.startNotifications();
    const dec = new TextDecoder();
    notify.addEventListener("characteristicvaluechanged", (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value!;
      this.buffer += dec.decode(v);
      if (this.buffer.includes(">") && this.waiter) {
        const out = this.buffer.slice(0, this.buffer.indexOf(">"));
        this.buffer = this.buffer.slice(this.buffer.indexOf(">") + 1);
        const w = this.waiter; this.waiter = null; w(out);
      }
    });
    this.log("info", `Connected to ${this.name}`);
  }

  cmd(line: string, timeoutMs = 4000): Promise<string> {
    const run = async () => {
      this.buffer = "";
      const p = new Promise<string>((res, rej) => {
        const t = setTimeout(() => { this.waiter = null; rej(new Error(`Timeout: ${line}`)); }, timeoutMs);
        this.waiter = (s) => { clearTimeout(t); res(s); };
      });
      this.log("tx", line);
      const bytes = new TextEncoder().encode(line + "\r");
      for (let i = 0; i < bytes.length; i += 20) {
        const chunk = bytes.slice(i, i + 20);
        if (this.write.properties.writeWithoutResponse) await this.write.writeValueWithoutResponse(chunk);
        else await this.write.writeValueWithResponse(chunk);
      }
      const raw = (await p).replace(/\r/g, "\n").split("\n").map((s) => s.trim())
        .filter((s) => s && s !== line).join("\n");
      this.log("rx", raw || "(empty)");
      return raw;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  async close() { try { this.device?.gatt?.disconnect(); } catch {} }
}

export async function initElm(t: Transport) {
  await t.cmd("ATZ", 6000);
  for (const c of ["ATE0", "ATL0", "ATS1", "ATH0", "ATAT1", "ATSP6", "ATCAF1"]) await t.cmd(c);
  const ver = await t.cmd("ATI");
  const volts = await t.cmd("ATRV");
  return { ver, volts };
}
