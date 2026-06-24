import { describe, expect, test } from "vitest";
import { renderWebviewHtml } from "./webview-html";

describe("Serve Sim webview", () => {
  test("embeds active stream URL and localhost frame CSP", () => {
    const html = renderWebviewHtml("vscode-webview://abc", {
      url: "http://127.0.0.1:3200",
      port: 3200,
      device: "ABC",
    });

    expect(html).toContain("frame-src http://127.0.0.1:* http://localhost:*");
    expect(html).toContain("Choose an iOS Simulator");
    expect(html).toContain("Pick a booted simulator to mirror it");
    expect(html).toContain('src="http://127.0.0.1:3200"');
    expect(html).toContain("Serve Sim - ABC");
  });
});
