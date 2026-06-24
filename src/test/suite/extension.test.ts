import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Serve Sim extension", () => {
  test("registers public commands", async () => {
    await vscode.extensions.getExtension("jingjing2222.serve-sim")?.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("serveSim.start"));
    assert.ok(commands.includes("serveSim.open"));
    assert.ok(commands.includes("serveSim.stop"));
    assert.ok(commands.includes("serveSim.stopAll"));
    assert.ok(commands.includes("serveSim.restart"));
    assert.ok(commands.includes("serveSim.openExternal"));
  });
});
