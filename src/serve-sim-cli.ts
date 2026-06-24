import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type ServeSimCodec = "auto" | "h264" | "mjpeg";

export interface ServeSimConfig {
  executablePath: string;
  port: number;
  packageSpec: string;
  codec: ServeSimCodec;
}

export interface ServeSimCandidate {
  label: string;
  command: string;
  prefixArgs: string[];
}

export interface CommandResult {
  candidate: ServeSimCandidate;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunningCommand {
  candidate: ServeSimCandidate;
  child: ChildProcess;
}

export interface OutputSink {
  appendLine(value: string): void;
}

export function createStartArgs(
  config: Pick<ServeSimConfig, "port" | "codec">,
  device?: string,
): string[] {
  const args = ["--port", String(config.port)];
  if (config.codec !== "auto") args.push("--codec", config.codec);
  if (device) args.push(device);
  return args;
}

export function createListArgs(): string[] {
  return ["--list"];
}

export function createKillArgs(device?: string): string[] {
  return device ? ["--kill", device] : ["--kill"];
}

export function createServeSimCandidates(
  config: Pick<ServeSimConfig, "executablePath" | "packageSpec">,
  workspaceFolders: readonly string[],
  pathExists: (path: string) => boolean = existsSync,
): ServeSimCandidate[] {
  const candidates: ServeSimCandidate[] = [];

  const explicit = config.executablePath.trim();
  if (explicit) {
    return [{ label: "configured executable", command: explicit, prefixArgs: [] }];
  }

  for (const folder of workspaceFolders) {
    const local = join(folder, "node_modules", ".bin", "serve-sim");
    if (pathExists(local)) {
      candidates.push({ label: "workspace node_modules", command: local, prefixArgs: [] });
    }
  }

  candidates.push({ label: "PATH", command: "serve-sim", prefixArgs: [] });
  candidates.push({ label: "npx", command: "npx", prefixArgs: ["-y", config.packageSpec] });
  return candidates;
}

function isMissingExecutable(error: NodeJS.ErrnoException): boolean {
  return error.code === "ENOENT";
}

function shellLine(candidate: ServeSimCandidate, args: readonly string[]): string {
  return `$ ${candidate.command} ${[...candidate.prefixArgs, ...args].join(" ")}`;
}

function runCandidate(
  candidate: ServeSimCandidate,
  args: readonly string[],
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(candidate.command, [...candidate.prefixArgs, ...args], {
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        candidate,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: exitCode ?? 1,
      });
    });
  });
}

export async function runServeSimCommand(
  candidates: readonly ServeSimCandidate[],
  args: readonly string[],
  output?: OutputSink,
): Promise<CommandResult> {
  let lastMissing: NodeJS.ErrnoException | undefined;

  for (const candidate of candidates) {
    output?.appendLine(shellLine(candidate, args));
    try {
      const result = await runCandidate(candidate, args);
      if (result.stdout.trim()) output?.appendLine(result.stdout.trim());
      if (result.stderr.trim()) output?.appendLine(result.stderr.trim());
      if (result.exitCode !== 0) {
        throw new Error(
          `${candidate.label} exited with code ${result.exitCode}\n${result.stderr || result.stdout}`.trim(),
        );
      }
      return result;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (isMissingExecutable(err) && candidate.label !== "npx") {
        lastMissing = err;
        continue;
      }
      throw error;
    }
  }

  throw lastMissing ?? new Error("No serve-sim command candidate was available.");
}

export async function startServeSimCommand(
  candidates: readonly ServeSimCandidate[],
  args: readonly string[],
  output?: OutputSink,
): Promise<RunningCommand> {
  let lastMissing: NodeJS.ErrnoException | undefined;

  for (const candidate of candidates) {
    output?.appendLine(shellLine(candidate, args));
    try {
      const child = await startCandidate(candidate, args, output);
      return { candidate, child };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (isMissingExecutable(err) && candidate.label !== "npx") {
        lastMissing = err;
        continue;
      }
      throw error;
    }
  }

  throw lastMissing ?? new Error("No serve-sim command candidate was available.");
}

function startCandidate(
  candidate: ServeSimCandidate,
  args: readonly string[],
  output?: OutputSink,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(candidate.command, [...candidate.prefixArgs, ...args], {
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;

    child.stdout?.on("data", (chunk: Buffer) =>
      output?.appendLine(chunk.toString("utf8").trimEnd()),
    );
    child.stderr?.on("data", (chunk: Buffer) =>
      output?.appendLine(chunk.toString("utf8").trimEnd()),
    );
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("spawn", () => {
      if (!settled) {
        settled = true;
        resolve(child);
      }
    });
  });
}
