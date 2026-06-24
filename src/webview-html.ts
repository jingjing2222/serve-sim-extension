import type { ServeSimStream } from "./serve-sim-state";

export function renderWebviewHtml(cspSource: string, stream?: ServeSimStream): string {
  const title = escapeHtml(stream ? `Serve Sim - ${stream.device}` : "Serve Sim");
  const url = stream ? escapeHtml(stream.url) : "";
  const nonce = randomNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} http://127.0.0.1:* http://localhost:* data:`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    "frame-src http://127.0.0.1:* http://localhost:*",
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
      overflow: hidden;
      background: var(--vscode-editor-background);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: var(--vscode-editor-background);
    }
    iframe.pending {
      display: none;
    }
    .status-screen {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 28px;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
    }
    .status-screen.hidden {
      display: none;
    }
    .status-card {
      width: min(560px, 100%);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
      padding: 22px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.25);
    }
    .status-title {
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.25;
      font-weight: 600;
    }
    .status-message {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.45;
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 32px;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, black);
      z-index: 10;
    }
    .overlay.visible {
      display: flex;
    }
    .dialog {
      width: min(640px, 100%);
      max-height: min(720px, 100%);
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
      color: var(--vscode-foreground);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
    }
    .header {
      padding: 20px 22px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
      line-height: 1.25;
      font-weight: 600;
    }
    p {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.45;
    }
    .body {
      padding: 12px;
      max-height: 420px;
      overflow: auto;
    }
    .device {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 0;
      border-radius: 6px;
      color: var(--vscode-foreground);
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .device:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .device:disabled {
      cursor: wait;
    }
    .name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
    }
    .meta {
      margin-top: 3px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .badge {
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 22px 18px;
      border-top: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .refresh {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      padding: 6px 10px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }
    .refresh:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <iframe id="preview" class="${stream ? "" : "pending"}" title="${title}" ${stream ? `src="${url}"` : ""} allow="clipboard-read; clipboard-write; fullscreen"></iframe>
  <main id="statusScreen" class="status-screen ${stream ? "hidden" : ""}">
    <section class="status-card">
      <h1 class="status-title">Serve Sim</h1>
      <p id="previewStatus" class="status-message">Opening the Serve Sim panel...</p>
    </section>
  </main>
  <div id="overlay" class="overlay" aria-live="polite">
    <section class="dialog">
      <div class="header">
        <h1>Choose an iOS Simulator</h1>
        <p>Serve Sim mirrors a booted iOS Simulator. Pick a booted simulator to mirror it, or pick a shutdown simulator to boot it first.</p>
      </div>
      <div id="devices" class="body"></div>
      <div class="footer">
        <span id="status">Checking installed simulators...</span>
        <button id="refresh" class="refresh" type="button">Refresh</button>
      </div>
    </section>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const overlay = document.getElementById("overlay");
    const preview = document.getElementById("preview");
    const statusScreen = document.getElementById("statusScreen");
    const previewStatus = document.getElementById("previewStatus");
    const devicesEl = document.getElementById("devices");
    const statusEl = document.getElementById("status");
    const refreshEl = document.getElementById("refresh");
    let bootingUdid = null;
    let forceDevicePicker = false;

    function requestState() {
      vscode.postMessage({ type: "refreshSimulators" });
    }

    function setStatus(message) {
      previewStatus.textContent = message;
      statusScreen.classList.remove("hidden");
      preview.classList.add("pending");
    }

    function setError(message) {
      previewStatus.textContent = message;
      statusScreen.classList.remove("hidden");
      preview.classList.add("pending");
      forceDevicePicker = true;
      requestState();
    }

    function showPreview(stream) {
      if (stream && preview.getAttribute("src") !== stream.url) {
        preview.setAttribute("src", stream.url);
      }
      preview.classList.remove("pending");
      statusScreen.classList.add("hidden");
    }

    function renderDevices(devices) {
      devicesEl.textContent = "";
      if (!devices.length) {
        const empty = document.createElement("p");
        empty.textContent = "No installed iOS simulators were found. Install an iOS Simulator runtime in Xcode, then refresh.";
        devicesEl.appendChild(empty);
        return;
      }
      for (const device of devices) {
        const button = document.createElement("button");
        button.className = "device";
        button.type = "button";
        button.disabled = Boolean(bootingUdid);
        button.addEventListener("click", () => {
          bootingUdid = device.udid;
          statusEl.textContent = device.state === "Booted" ? "Mirroring " + device.name + "..." : "Booting " + device.name + "...";
          renderDevices(devices);
          vscode.postMessage({ type: "bootSimulator", udid: device.udid });
        });

        const label = document.createElement("div");
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = device.name;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = device.runtimeName + " · " + device.udid;
        label.append(name, meta);

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = bootingUdid === device.udid ? (device.state === "Booted" ? "Mirroring" : "Booting") : device.state;
        button.append(label, badge);
        devicesEl.appendChild(button);
      }
    }

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "simulatorState") {
        const state = message.state;
        overlay.classList.toggle("visible", forceDevicePicker || !state.hasBooted || Boolean(bootingUdid));
        renderDevices(state.devices);
        if (!bootingUdid) {
          statusEl.textContent = state.hasBooted ? "Simulator is running." : "No booted iOS Simulator detected.";
        }
      }
      if (message.type === "simulatorStateError") {
        overlay.classList.add("visible");
        statusEl.textContent = message.message;
      }
      if (message.type === "bootingSimulator") {
        bootingUdid = message.udid;
        setStatus("Preparing selected iOS Simulator...");
      }
      if (message.type === "bootedSimulator") {
        bootingUdid = null;
        forceDevicePicker = false;
        statusEl.textContent = "Simulator ready. Opening Serve Sim preview...";
        requestState();
      }
      if (message.type === "bootSimulatorError") {
        bootingUdid = null;
        overlay.classList.add("visible");
        statusEl.textContent = message.message;
        requestState();
      }
      if (message.type === "previewStatus") {
        setStatus(message.message);
      }
      if (message.type === "previewReady") {
        showPreview(message.stream);
      }
      if (message.type === "previewError") {
        setError(message.message);
      }
    });

    refreshEl.addEventListener("click", requestState);
    vscode.postMessage({ type: "ready" });
    ${stream ? `showPreview({ url: "${url}" });` : ""}
    setInterval(requestState, 2500);
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function randomNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 24; index++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}
