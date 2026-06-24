# Serve Sim

Run [`serve-sim`](https://github.com/EvanBacon/serve-sim) inside VS Code and Cursor.

This extension is a thin wrapper around the `serve-sim` CLI. It starts and stops local simulator streams, then opens the served preview UI in an editor webview.

## Features

- Start the `serve-sim --port <port>` preview server from the command palette.
- Open a reusable Serve Sim panel inside VS Code or Cursor.
- Stop the active stream, stop all streams, restart, or open the preview in your browser.
- Resolve the CLI from a configured path, workspace `node_modules/.bin`, PATH, then `npx -y serve-sim@latest`.

## Requirements

- macOS
- Xcode with iOS Simulator
- Node.js 20+
- `npx` available on PATH for the package fallback

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

- `VSCE_PAT`
- `OVSX_PAT`
