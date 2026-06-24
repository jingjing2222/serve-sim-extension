import { describe, expect, test } from "vitest";
import { parseSimulatorDevices } from "./simulators";

describe("simulator parsing", () => {
  test("lists available iOS simulators and detects booted state", () => {
    const state = parseSimulatorDevices(
      JSON.stringify({
        devices: {
          "com.apple.CoreSimulator.SimRuntime.watchOS-11-2": [
            { udid: "WATCH", name: "Apple Watch", state: "Shutdown", isAvailable: true },
          ],
          "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
            { udid: "A", name: "iPhone 17 Pro", state: "Booted", isAvailable: true },
            { udid: "B", name: "iPhone 16", state: "Shutdown", isAvailable: true },
            { udid: "C", name: "Unavailable", state: "Shutdown", isAvailable: false },
          ],
        },
      }),
    );

    expect(state.hasBooted).toBe(true);
    expect(state.devices).toEqual([
      {
        udid: "A",
        name: "iPhone 17 Pro",
        state: "Booted",
        runtimeIdentifier: "com.apple.CoreSimulator.SimRuntime.iOS-26-5",
        runtimeName: "iOS 26.5",
      },
      {
        udid: "B",
        name: "iPhone 16",
        state: "Shutdown",
        runtimeIdentifier: "com.apple.CoreSimulator.SimRuntime.iOS-26-5",
        runtimeName: "iOS 26.5",
      },
    ]);
  });
});
