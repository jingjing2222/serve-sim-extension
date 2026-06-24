import { join, resolve } from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = resolve(__dirname, "../../");
  const extensionTestsPath = join(__dirname, "suite", "index.js");

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
