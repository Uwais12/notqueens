import type { Ecu } from "./uds";

// VAG MQB diagnostic CAN IDs (request / response) for the modules found on a TT 8S.
export const ECUS: Ecu[] = [
  { addr: "01", name: "Engine Electronics", tx: 0x7e0, rx: 0x7e8 },
  { addr: "02", name: "Transmission (S tronic)", tx: 0x7e1, rx: 0x7e9 },
  { addr: "03", name: "Brakes (ABS/ESC)", tx: 0x713, rx: 0x77d },
  { addr: "08", name: "Climate Control", tx: 0x746, rx: 0x7b0 },
  { addr: "09", name: "Central Electrics (BCM)", tx: 0x70e, rx: 0x778 },
  { addr: "10", name: "Parking Aid", tx: 0x70a, rx: 0x774 },
  { addr: "15", name: "Airbag", tx: 0x715, rx: 0x77f },
  { addr: "16", name: "Steering Column Electronics", tx: 0x70c, rx: 0x776 },
  { addr: "17", name: "Instruments (Virtual Cockpit)", tx: 0x714, rx: 0x77e },
  { addr: "19", name: "Gateway", tx: 0x710, rx: 0x77a },
  { addr: "42", name: "Door Electronics Driver", tx: 0x74a, rx: 0x7b4 },
  { addr: "44", name: "Steering Assist", tx: 0x712, rx: 0x77c },
  { addr: "52", name: "Door Electronics Passenger", tx: 0x74b, rx: 0x7b5 },
  { addr: "55", name: "Headlight Range", tx: 0x754, rx: 0x7be },
  { addr: "5F", name: "Information Electronics (MMI)", tx: 0x773, rx: 0x7dd },
];

export type Confidence = "high" | "medium" | "low";
export interface Option {
  id: string; module: string; name: string; description: string; category: string;
  channel: string; confidence: Confidence; values: string[];
}

const o = (id: string, module: string, category: string, name: string, description: string, channel: string, confidence: Confidence, values = ["not active", "active"]): Option =>
  ({ id, module, category, name, description, channel, confidence, values });

// Researched options for the 2020 Audi TT 8S (MQB). On MQB most of these are adaptation channels whose
// UDS identifiers differ per part number/firmware and are not published, so they're linked to coding bits
// by the user (see "Link to bit") after verifying with the module's current coding.
export const OPTIONS: Option[] = [
  o("needle_sweep", "17", "Instruments", "Needle sweep", "Rev and speed needles sweep at ignition on.", "Gauge test / Zeigertest (Staging)", "medium"),
  o("lap_timer", "17", "Instruments", "Lap timer", "Lap timer menu in the Virtual Cockpit.", "Lap timer", "medium"),
  o("oil_temp", "17", "Instruments", "Oil temperature display", "Oil temperature in the cluster menus.", "Oil temperature display", "medium"),
  o("digital_speed", "17", "Instruments", "Digital speedometer", "Digital speed readout in the cluster.", "Digital speed display", "medium"),
  o("battery_meter", "17", "Instruments", "Battery voltage display", "Battery voltage in the cluster/MMI.", "Battery voltage display", "low"),
  o("door_chime", "17", "Instruments", "Door-open chime", "Chime when a door is open.", "Door warning chime", "low"),
  o("seatbelt", "17", "Safety", "Seatbelt warning", "Seatbelt chime (legally required in many regions).", "Seat belt warning", "medium"),
  o("tpms_display", "17", "Safety", "Tyre pressure display", "Indirect TPMS menu in the cluster.", "Tire pressure monitoring display", "low"),
  o("tpms_abs", "03", "Safety", "Indirect TPMS", "Wheel-speed-based tyre pressure monitoring.", "Tire pressure monitoring", "low"),
  o("ebrake_flash", "03", "Safety", "Emergency brake flashing", "Brake lights flash under hard braking.", "Emergency brake flashing", "low"),
  o("auto_hold_mem", "03", "Driving", "Auto Hold memory", "Remember Auto Hold after restart.", "Auto hold - last setting", "low"),
  o("drl", "09", "Lighting", "Daytime running lights", "DRL on/off.", "Daytime running light activation", "medium"),
  o("drl_menu", "09", "Lighting", "DRL toggle in MMI", "Switch DRL from the MMI menu.", "Daytime running lights - menu control", "medium"),
  o("drl_dim", "09", "Lighting", "DRL dims with indicator", "DRL dims on the indicating side.", "Daytime running lights - turn signal dimming", "low"),
  o("coming_home", "09", "Lighting", "Coming home", "Lights on when leaving the car.", "Coming home - activation", "medium"),
  o("leaving_home", "09", "Lighting", "Leaving home", "Lights on at unlock.", "Leaving home - activation", "medium"),
  o("rear_fog", "09", "Lighting", "Rear fog behaviour", "Rear fog single/both sides.", "Rear fog - light function", "low", ["default", "both sides"]),
  o("cornering", "09", "Lighting", "Cornering via fog lights", "Fog lights act as cornering lights.", "Cornering light via fog lights", "low"),
  o("comfort_turn", "09", "Lighting", "Comfort indicator flashes", "Flashes per stalk tap.", "Comfort turn signal - number of flashes", "medium", ["3", "4", "5"]),
  o("hazard_ebrake", "09", "Safety", "Hazards on emergency stop", "Hazards on during an emergency stop.", "Emergency brake flashing - hazard", "low"),
  o("lock_flash", "09", "Locking", "Indicator flash on lock/unlock", "Indicator confirmation.", "Turn signal - acknowledgment lock/unlock", "medium"),
  o("horn_confirm", "09", "Locking", "Horn on lock", "Horn chirp when locking.", "Horn - acknowledgment lock", "low"),
  o("auto_lock", "09", "Locking", "Auto lock at speed", "Lock doors at ~15 km/h.", "Speed dependent locking", "medium"),
  o("auto_unlock", "09", "Locking", "Auto unlock at ignition off", "Unlock when ignition switched off.", "Automatic unlocking - terminal 15 off", "medium"),
  o("single_unlock", "09", "Locking", "Driver-door-only unlock", "First press unlocks driver only.", "Selective unlocking", "medium", ["all doors", "driver only"]),
  o("comfort_open", "09", "Comfort", "Windows open via key", "Hold unlock to open windows.", "Comfort opening - remote control", "medium"),
  o("comfort_close", "09", "Comfort", "Windows close via key", "Hold lock to close windows.", "Comfort closing - remote control", "medium"),
  o("rain_mem", "09", "Comfort", "Rain sensor memory", "Rain sensor stays on after restart.", "Rain sensor - permanent activation", "low"),
  o("tear_wipe", "09", "Comfort", "Tear wipe", "Extra wipe after washing.", "Wipe after washing", "medium"),
  o("mirror_dip", "52", "Comfort", "Mirror dip on reverse", "Passenger mirror tilts in reverse.", "Mirror lowering in reverse", "low"),
  o("mirror_fold", "42", "Comfort", "Mirror fold on lock", "Fold mirrors when locking (needs power fold).", "Mirror folding with locking", "low"),
  o("startstop_mem", "19", "Driving", "Start/Stop memory", "Remember last start/stop state.", "Start-Stop - last mode", "low"),
  o("ads_mem", "19", "Driving", "Drive Select memory", "Remember last Drive Select mode.", "Drive select - last mode", "low"),
  o("steering_char", "44", "Driving", "Steering characteristic", "Steering weight per Drive Select mode.", "Steering characteristic", "low"),
  o("dev_menu", "5F", "Audio", "MMI developer menu", "Green engineering menu.", "Developer mode", "medium"),
  o("vim", "5F", "Audio", "Video in motion", "Video while driving (passenger use only).", "Video speed limit", "low"),
  o("car_menu", "5F", "Comfort", "Extra car menu items", "More vehicle settings in MMI.", "Car function list", "low"),
];

export const PIDS = [
  { pid: 0x0c, name: "Engine RPM", unit: "rpm", f: (a: number[]) => (a[0] * 256 + a[1]) / 4 },
  { pid: 0x0d, name: "Speed", unit: "km/h", f: (a: number[]) => a[0] },
  { pid: 0x05, name: "Coolant", unit: "°C", f: (a: number[]) => a[0] - 40 },
  { pid: 0x0f, name: "Intake air", unit: "°C", f: (a: number[]) => a[0] - 40 },
  { pid: 0x04, name: "Engine load", unit: "%", f: (a: number[]) => Math.round(a[0] / 2.55) },
  { pid: 0x11, name: "Throttle", unit: "%", f: (a: number[]) => Math.round(a[0] / 2.55) },
  { pid: 0x0b, name: "Manifold pressure", unit: "kPa", f: (a: number[]) => a[0] },
  { pid: 0x5c, name: "Oil temp", unit: "°C", f: (a: number[]) => a[0] - 40 },
  { pid: 0x2f, name: "Fuel level", unit: "%", f: (a: number[]) => Math.round(a[0] / 2.55) },
];
