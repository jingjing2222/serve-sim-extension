import * as vscode from "vscode";
import type { ServeSimStream } from "./serve-sim-state";
import type { SimulatorState } from "./simulators";
import { renderWebviewHtml } from "./webview-html";

const viewType = "serveSim.preview";

export class ServeSimPanel {
  private panel: vscode.WebviewPanel | undefined;
  private messageDisposable: vscode.Disposable | undefined;
  private stream: ServeSimStream | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: {
      getSimulatorState(): Promise<SimulatorState>;
      startPreview(reportStatus?: (message: string) => Promise<void>): Promise<ServeSimStream>;
      bootSimulator(udid: string): Promise<ServeSimStream>;
    },
  ) {}

  reveal(stream?: ServeSimStream): void {
    if (stream) this.stream = stream;
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        viewType,
        "Serve Sim",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );
      this.messageDisposable = this.panel.webview.onDidReceiveMessage((message: unknown) => {
        void this.handleMessage(message);
      });
      this.panel.onDidDispose(() => {
        this.messageDisposable?.dispose();
        this.messageDisposable = undefined;
        this.panel = undefined;
      });
    }

    this.panel.webview.html = renderWebviewHtml(this.panel.webview.cspSource, this.stream);
    void this.postStatus("Checking simulator and Serve Sim status...");
    void this.postSimulatorState();
  }

  async showStatus(message: string): Promise<void> {
    this.reveal(this.stream);
    await this.postStatus(message);
  }

  async showStream(stream: ServeSimStream): Promise<void> {
    this.stream = stream;
    this.reveal(stream);
    await this.panel?.webview.postMessage({ type: "previewReady", stream });
  }

  async showError(message: string): Promise<void> {
    this.reveal(this.stream);
    await this.panel?.webview.postMessage({ type: "previewError", message });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!this.panel || typeof message !== "object" || message === null || !("type" in message))
      return;
    const type = (message as { type?: unknown }).type;
    if (type === "ready" || type === "refreshSimulators") {
      await this.postSimulatorState();
      return;
    }
    if (type === "startPreview" || type === "retryPreview") {
      await this.runPreviewAction("Starting Serve Sim preview...", this.handlers.startPreview);
      return;
    }
    if (type === "bootSimulator") {
      const udid = (message as { udid?: unknown }).udid;
      if (typeof udid !== "string") return;
      await this.panel.webview.postMessage({ type: "bootingSimulator", udid });
      try {
        const stream = await this.handlers.bootSimulator(udid);
        await this.showStream(stream);
        await this.panel?.webview.postMessage({ type: "bootedSimulator", udid });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.panel?.webview.postMessage({ type: "bootSimulatorError", message });
      }
    }
  }

  private async runPreviewAction(
    status: string,
    action: (reportStatus?: (message: string) => Promise<void>) => Promise<ServeSimStream>,
  ): Promise<void> {
    await this.postStatus(status);
    try {
      const stream = await action(this.postStatus.bind(this));
      await this.showStream(stream);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel?.webview.postMessage({ type: "previewError", message });
    }
  }

  private async postStatus(message: string): Promise<void> {
    await this.panel?.webview.postMessage({ type: "previewStatus", message });
  }

  private async postSimulatorState(): Promise<void> {
    if (!this.panel) return;
    try {
      const state = await this.handlers.getSimulatorState();
      await this.panel.webview.postMessage({ type: "simulatorState", state });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({ type: "simulatorStateError", message });
    }
  }
}
