import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: string;
  runtimeIdentifier: string;
  runtimeName: string;
}

export interface SimulatorState {
  devices: SimulatorDevice[];
  hasBooted: boolean;
}

interface SimctlDeviceRecord {
  udid?: unknown;
  name?: unknown;
  state?: unknown;
  isAvailable?: unknown;
}

interface SimctlDevicesOutput {
  devices?: Record<string, SimctlDeviceRecord[]>;
}

export async function listIosSimulators(): Promise<SimulatorState> {
  const { stdout } = await execFileAsync("xcrun", ["simctl", "list", "devices", "available", "-j"]);
  return parseSimulatorDevices(stdout);
}

export function parseSimulatorDevices(json: string): SimulatorState {
  const data = JSON.parse(json) as SimctlDevicesOutput;
  const devices: SimulatorDevice[] = [];

  for (const [runtimeIdentifier, records] of Object.entries(data.devices ?? {})) {
    if (!runtimeIdentifier.includes("SimRuntime.iOS")) continue;
    for (const record of records) {
      if (record.isAvailable !== true) continue;
      if (typeof record.udid !== "string") continue;
      if (typeof record.name !== "string") continue;
      if (typeof record.state !== "string") continue;
      devices.push({
        udid: record.udid,
        name: record.name,
        state: record.state,
        runtimeIdentifier,
        runtimeName: runtimeName(runtimeIdentifier),
      });
    }
  }

  devices.sort((a, b) => {
    if (a.state === "Booted" && b.state !== "Booted") return -1;
    if (b.state === "Booted" && a.state !== "Booted") return 1;
    return `${b.runtimeName} ${b.name}`.localeCompare(`${a.runtimeName} ${a.name}`);
  });

  return {
    devices,
    hasBooted: devices.some((device) => device.state === "Booted"),
  };
}

export async function bootSimulator(udid: string): Promise<void> {
  try {
    await execFileAsync("xcrun", ["simctl", "boot", udid]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("current state: Booted")) throw error;
  }
  await execFileAsync("xcrun", ["simctl", "bootstatus", udid, "-b"]);
  await execFileAsync("open", ["-ga", "Simulator"]);
}

export async function findBootedSimulator(): Promise<SimulatorDevice | undefined> {
  const state = await listIosSimulators();
  const booted = state.devices.find((device) => device.state === "Booted");
  if (!booted) return undefined;
  await execFileAsync("xcrun", ["simctl", "bootstatus", booted.udid, "-b"]);
  return booted;
}

export async function waitForAnyBootedSimulator(
  timeoutMs = 60_000,
): Promise<SimulatorDevice | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const booted = await findBootedSimulator();
    if (booted) return booted;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return undefined;
}

function runtimeName(identifier: string): string {
  const last = identifier.split(".").at(-1) ?? identifier;
  return last.replace(/^iOS-/, "iOS ").replaceAll("-", ".");
}
