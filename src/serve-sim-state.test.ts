import { describe, expect, test } from "vitest";
import { parseDetachOutput, parseListOutput } from "./serve-sim-state";

const stream = {
  url: "http://127.0.0.1:3200",
  streamUrl: "http://127.0.0.1:3200/helper/ABC/stream.mjpeg",
  wsUrl: "ws://127.0.0.1:3200/helper/ABC/ws",
  port: 3200,
  device: "ABC",
  pid: 123,
};

describe("serve-sim state parsing", () => {
  test("parses single detach stream", () => {
    expect(parseDetachOutput(JSON.stringify(stream))).toEqual([stream]);
  });

  test("parses multi-device detach streams", () => {
    const second = { ...stream, device: "DEF", port: 3201, url: "http://127.0.0.1:3201" };
    expect(parseDetachOutput(JSON.stringify({ devices: [stream, second] }))).toEqual([
      stream,
      second,
    ]);
  });

  test("parses stopped list state", () => {
    expect(parseListOutput(JSON.stringify({ running: false }))).toEqual({
      running: false,
      streams: [],
    });
  });

  test("parses single running list state", () => {
    expect(parseListOutput(JSON.stringify({ running: true, ...stream }))).toEqual({
      running: true,
      streams: [stream],
    });
  });

  test("parses multi running list state", () => {
    const second = { ...stream, device: "DEF", port: 3201, url: "http://127.0.0.1:3201" };
    expect(parseListOutput(JSON.stringify({ running: true, streams: [stream, second] }))).toEqual({
      running: true,
      streams: [stream, second],
    });
  });

  test("reports malformed detach output", () => {
    expect(() => parseDetachOutput("not json")).toThrow(/non-JSON/);
  });
});
