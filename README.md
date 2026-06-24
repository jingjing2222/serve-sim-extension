# Serve Sim

Run and mirror iOS Simulator with [`serve-sim`](https://github.com/EvanBacon/serve-sim) inside VS Code and Cursor.

This extension is a thin wrapper around the `serve-sim` CLI. It opens a local preview panel, detects installed iOS Simulators, boots selected devices, and mirrors the active simulator stream inside an editor webview.

## Features

- Open a reusable Serve Sim panel inside VS Code or Cursor.
- Detect installed iOS Simulators and show a device picker when no simulator is booted.
- Boot a selected simulator, wait for `simctl bootstatus`, then mirror that device.
- Start the `serve-sim --port <port> <udid>` preview server from the command palette.
- Stop the active stream, stop all streams, restart, or open the preview in your browser.
- Resolve the CLI from a configured path, workspace `node_modules/.bin`, PATH, then `npx -y serve-sim@latest`.

## Requirements

- macOS
- Xcode with iOS Simulator
- Node.js 20+
- `npx` available on PATH for the package fallback

## How It Works

`Serve Sim: Open Panel` shows the panel immediately, then checks simulator state. If an iOS Simulator is already booted, the extension mirrors that device. If none is booted, the panel shows installed simulators so you can choose one to boot and mirror.

The extension does not bundle `serve-sim` or any native helpers. It shells out to your configured CLI, workspace install, PATH, or `npx`.

## Commands

- `Serve Sim: Start`
- `Serve Sim: Open Panel`
- `Serve Sim: Stop Active Stream`
- `Serve Sim: Stop All Streams`
- `Serve Sim: Restart`
- `Serve Sim: Open in Browser`

## Settings

- `serveSim.executablePath`: explicit path to the `serve-sim` CLI.
- `serveSim.port`: starting port. Default: `3200`.
- `serveSim.packageSpec`: package used by `npx`. Default: `serve-sim@latest`.
- `serveSim.autoOpenPanel`: open the panel after start. Default: `true`.
- `serveSim.codec`: `auto`, `h264`, or `mjpeg`. Default: `auto`.

## Development

This repo follows the `yo code` TypeScript + esbuild scaffold, with `pnpm` as the package manager.

```sh
pnpm install
pnpm test
pnpm build
pnpm package
```

Run the extension with the `Run Extension` launch config.

## Publishing

Manual GitHub Actions workflows publish to Visual Studio Marketplace and Open VSX.

Required secrets:

- `VSCODE_PAT`
- `VSX_PAT`

## License

Apache-2.0
