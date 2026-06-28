import { describe, expect, test } from "vitest";
import { changesetsApplyReleasePlanEntry, extractReleaseNotes } from "./extract-release-notes.mjs";

describe("release note extraction", () => {
  test("extracts only the requested Changesets changelog section", () => {
    expect(
      extractReleaseNotes(
        `# Change Log

## 0.0.3

### Patch Changes

- Fix release body generation.

## 0.0.2

### Patch Changes

- Previous release.
`,
        "0.0.3",
      ),
    ).toBe(`## 0.0.3

### Patch Changes

- Fix release body generation.
`);
  });

  test("uses the Changesets apply-release-plan package as the upstream changelog dependency", () => {
    expect(changesetsApplyReleasePlanEntry).toContain("@changesets/apply-release-plan");
  });

  test("fails when the requested version is missing", () => {
    expect(() => extractReleaseNotes("# Change Log\n\n## 0.0.2\n", "0.0.3")).toThrow(
      /version 0\.0\.3/,
    );
  });
});
