import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createKillArgs,
  createListArgs,
  createServeSimCandidates,
  createStartArgs,
  runServeSimCommand,
  type ServeSimConfig,
} from "./serve-sim-cli";

const config: ServeSimConfig = {
  executablePath: "",
  port: 3200,
  packageSpec: "serve-sim@latest",
  codec: "mjpeg",
};

describe("serve-sim CLI", () => {
  test("builds command args", () => {
    expect(createStartArgs(config)).toEqual(["--port", "3200", "--codec", "mjpeg"]);
    expect(createStartArgs(config, "ABC")).toEqual(["--port", "3200", "--codec", "mjpeg", "ABC"]);
    expect(createListArgs()).toEqual(["--list"]);
    expect(createKillArgs("ABC")).toEqual(["--kill", "ABC"]);
    expect(createKillArgs()).toEqual(["--kill"]);
  });

  test("prefers explicit executable", () => {
    expect(createServeSimCandidates({ executablePath: "/tmp/serve-sim", packageSpec: "serve-sim@latest" }, [])).toEqual([
      { label: "configured executable", command: "/tmp/serve-sim", prefixArgs: [] },
    ]);
  });

  test("resolves workspace CLI before PATH and npx", () => {
    const workspace = "/repo/app";
    const candidates = createServeSimCandidates(
      config,
      [workspace],
      (path) => path.endsWith("node_modules/.bin/serve-sim"),
    );
    expect(candidates.map((candidate) => candidate.label)).toEqual(["workspace node_modules", "PATH", "npx"]);
    expect(candidates[0]?.command).toBe(join(workspace, "node_modules", ".bin", "serve-sim"));
    expect(candidates[2]?.prefixArgs).toEqual(["-y", "serve-sim@latest"]);
  });

  test("falls back when first executable is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "serve-sim-extension-"));
    const mock = join(dir, "serve-sim");
    writeFileSync(mock, "#!/bin/sh\nprintf '{\"url\":\"http://127.0.0.1:3200\",\"port\":3200,\"device\":\"ABC\"}'\n");
    chmodSync(mock, 0o755);

    const result = await runServeSimCommand(
      [
        { label: "missing", command: join(dir, "missing"), prefixArgs: [] },
        { label: "mock", command: mock, prefixArgs: [] },
      ],
      ["--list"],
    );

    expect(result.candidate.label).toBe("mock");
    expect(result.stdout).toContain("127.0.0.1");
  });
});
