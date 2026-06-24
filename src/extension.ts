import * as vscode from "vscode";
import http from "node:http";
import {
  createKillArgs,
  createListArgs,
  createServeSimCandidates,
  createStartArgs,
  runServeSimCommand,
  startServeSimCommand,
  type RunningCommand,
  type ServeSimConfig,
} from "./serve-sim-cli";
import { parseListOutput, pickFirstStream, type ServeSimStream } from "./serve-sim-state";
import { bootSimulator, findBootedSimulator, listIosSimulators } from "./simulators";
import { ServeSimPanel } from "./webview";

const stateKey = "serveSim.activeStream";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Serve Sim");
  let previewProcess: RunningCommand | undefined;
  const panel = new ServeSimPanel(context.extensionUri, {
    getSimulatorState: listIosSimulators,
    startPreview: async (reportStatus) => {
      const next = await startPreview(context, output, previewProcess, reportStatus);
      previewProcess = next.process;
      return next.stream;
    },
    restartPreview: async (reportStatus) => {
      await stopActivePreview(context, output, previewProcess);
      previewProcess = undefined;
      const next = await startPreview(context, output, undefined, reportStatus);
      previewProcess = next.process;
      return next.stream;
    },
    stopPreview: async () => {
      await stopActivePreview(context, output, previewProcess);
      previewProcess = undefined;
    },
    bootSimulator: async (udid) => {
      await bootSimulator(udid);
      await stopActivePreview(context, output, previewProcess);
      previewProcess = undefined;
      const next = await startPreview(context, output, undefined);
      previewProcess = next.process;
      return next.stream;
    },
  });
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "serveSim.open";
  status.text = "$(device-mobile) Serve Sim";
  status.tooltip = "Open Serve Sim panel";
  status.show();

  context.subscriptions.push(
    output,
    status,
    vscode.commands.registerCommand("serveSim.start", async () => {
      await withUserError(output, async () => {
        ensureDarwin();
        panel.reveal();
        await panel.showStatus("Starting Serve Sim preview...");
        const result = await startPreview(
          context,
          output,
          previewProcess,
          panel.showStatus.bind(panel),
        );
        previewProcess = result.process;
        if (readConfig().autoOpenPanel) await panel.showStream(result.stream);
      });
    }),
    vscode.commands.registerCommand("serveSim.open", async () => {
      panel.reveal();
      await panel.showStatus("Checking simulator and Serve Sim status...");
      try {
        ensureDarwin();
        await panel.showStatus("Starting Serve Sim preview...");
        const result = await getActiveOrStart(
          context,
          output,
          previewProcess,
          panel.showStatus.bind(panel),
        );
        if (result.process) previewProcess = result.process;
        await panel.showStream(result.stream);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(message);
        output.show(true);
        await panel.showError(message);
        vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("serveSim.stop", async () => {
      await withUserError(output, async () => {
        ensureDarwin();
        const stream = await getActiveOrListed(context, output);
        if (!stream) {
          vscode.window.showInformationMessage("No serve-sim stream is running.");
          return;
        }
        await stopActivePreview(context, output, previewProcess, stream);
        previewProcess = undefined;
        vscode.window.showInformationMessage("Serve Sim stream stopped.");
      });
    }),
    vscode.commands.registerCommand("serveSim.stopAll", async () => {
      await withUserError(output, async () => {
        ensureDarwin();
        if (previewProcess) {
          previewProcess.child.kill("SIGTERM");
          previewProcess = undefined;
        }
        await runCli(context, createKillArgs(), output);
        await context.globalState.update(stateKey, undefined);
        vscode.window.showInformationMessage("All Serve Sim streams stopped.");
      });
    }),
    vscode.commands.registerCommand("serveSim.restart", async () => {
      await withUserError(output, async () => {
        ensureDarwin();
        const stream = await getActiveOrListed(context, output);
        await stopActivePreview(context, output, previewProcess, stream);
        previewProcess = undefined;
        await panel.showStatus("Restarting Serve Sim preview...");
        const next = await startPreview(
          context,
          output,
          previewProcess,
          panel.showStatus.bind(panel),
        );
        previewProcess = next.process;
        await panel.showStream(next.stream);
      });
    }),
  );
}

export function deactivate(): void {}

async function withUserError(
  output: vscode.OutputChannel,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(message);
    output.show(true);
    vscode.window.showErrorMessage(message);
  }
}

function ensureDarwin(): void {
  if (process.platform !== "darwin") {
    throw new Error("Serve Sim requires macOS with Xcode/iOS Simulator.");
  }
}

function readConfig(): ServeSimConfig & { autoOpenPanel: boolean } {
  const config = vscode.workspace.getConfiguration("serveSim");
  return {
    executablePath: config.get("executablePath", ""),
    port: config.get("port", 3200),
    packageSpec: config.get("packageSpec", "serve-sim@latest"),
    autoOpenPanel: config.get("autoOpenPanel", true),
    codec: config.get("codec", "auto"),
  };
}

function workspaceFolderPaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

async function runCli(
  context: vscode.ExtensionContext,
  args: readonly string[],
  output: vscode.OutputChannel,
) {
  const config = readConfig();
  const candidates = createServeSimCandidates(config, workspaceFolderPaths());
  const result = await runServeSimCommand(candidates, args, output);
  output.appendLine(`serve-sim via ${result.candidate.label}`);
  return result;
}

interface PreviewStartResult {
  stream: ServeSimStream;
  process?: RunningCommand;
}

async function startPreview(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  existing: RunningCommand | undefined,
  reportStatus?: (message: string) => Promise<void>,
): Promise<PreviewStartResult> {
  const config = readConfig();
  const url = `http://127.0.0.1:${config.port}`;
  await reportStatus?.("Checking for a booted iOS Simulator...");
  const booted = await findBootedSimulator();
  if (!booted) {
    throw new Error(
      "No booted iOS Simulator was found. Choose a simulator from the overlay, then Serve Sim will restart.",
    );
  }

  const existingActive = context.globalState.get<ServeSimStream>(stateKey);
  if (existing && existingActive?.url === url && (await isPreviewReady(url))) {
    return { stream: existingActive, process: existing };
  }

  if (existing) existing.child.kill("SIGTERM");

  const candidates = createServeSimCandidates(config, workspaceFolderPaths());
  await reportStatus?.(`Mirroring ${booted.name} with Serve Sim...`);
  const process = await startServeSimCommand(
    candidates,
    createStartArgs(config, booted.udid),
    output,
  );
  output.appendLine(`serve-sim preview via ${process.candidate.label}`);

  try {
    await reportStatus?.("Waiting for Serve Sim preview to become ready...");
    await waitForPreview(url, process);
  } catch (error) {
    process.child.kill("SIGTERM");
    throw error;
  }
  const stream: ServeSimStream = {
    url,
    port: config.port,
    device: booted.udid,
  };
  await context.globalState.update(stateKey, stream);
  return { stream, process };
}

async function listStreams(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
): Promise<ServeSimStream[]> {
  const result = await runCli(context, createListArgs(), output);
  return parseListOutput(result.stdout).streams;
}

async function getActiveOrListed(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
): Promise<ServeSimStream | undefined> {
  const active = context.globalState.get<ServeSimStream>(stateKey);
  if (active) return active;

  const stream = pickFirstStream(await listStreams(context, output));
  if (stream) await context.globalState.update(stateKey, stream);
  return stream;
}

async function getActiveOrStart(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  previewProcess: RunningCommand | undefined,
  reportStatus?: (message: string) => Promise<void>,
): Promise<PreviewStartResult> {
  const active = await getActiveOrListed(context, output);
  if (active && (await isPreviewReady(active.url))) {
    return previewProcess ? { stream: active, process: previewProcess } : { stream: active };
  }
  return startPreview(context, output, previewProcess, reportStatus);
}

async function waitForPreview(url: string, process?: RunningCommand): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isPreviewReady(url)) return;
    if (process && process.child.exitCode !== null) {
      throw new Error(formatPreviewProcessExit(process, url));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(formatPreviewTimeout(process, url));
}

function formatPreviewProcessExit(process: RunningCommand, url: string): string {
  const details = process.getOutput().trim();
  const suffix = details ? `\n\nserve-sim output:\n${details}` : "";
  return `${process.candidate.label} exited before Serve Sim became ready at ${url}.${fallbackHint(process)}${suffix}`;
}

function formatPreviewTimeout(process: RunningCommand | undefined, url: string): string {
  const via = process ? `${process.candidate.label} ` : "";
  const details = process?.getOutput().trim();
  const suffix = details ? `\n\nserve-sim output:\n${details}` : "";
  return `${via}serve-sim preview did not become ready at ${url}.${process ? fallbackHint(process) : ""}${suffix}`;
}

function fallbackHint(process: RunningCommand): string {
  if (process.candidate.label !== "npx") return "";
  return " The extension used the npx fallback. Install serve-sim in the workspace or set serveSim.executablePath if npx is slow or blocked.";
}

async function stopActivePreview(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  previewProcess: RunningCommand | undefined,
  stream = context.globalState.get<ServeSimStream>(stateKey),
): Promise<void> {
  if (previewProcess) {
    previewProcess.child.kill("SIGTERM");
  }
  if (stream) {
    await runCli(context, createKillArgs(stream.device), output);
  }
  await context.globalState.update(stateKey, undefined);
}

function isPreviewReady(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(
        response.statusCode !== undefined &&
          response.statusCode >= 200 &&
          response.statusCode < 400,
      );
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}
