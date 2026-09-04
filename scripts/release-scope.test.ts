import { describe, expect, test } from "bun:test";
import {
  changesetFiles,
  evaluateChangesetRequirement,
  packageFacingFiles,
} from "./release-scope";

describe("packageFacingFiles", () => {
  test("includes files shipped as part of a public package", () => {
    expect(packageFacingFiles([
      "packages/core/src/index.ts",
      "packages/react/package.json",
      "packages/en/README.md",
      "packages/ko/README-ko_kr.md",
      "packages/en/MODEL_CARD.md",
      "packages/core/LICENSE",
      "packages/core/NOTICE",
    ])).toEqual([
      "packages/core/src/index.ts",
      "packages/react/package.json",
      "packages/en/README.md",
      "packages/ko/README-ko_kr.md",
      "packages/en/MODEL_CARD.md",
      "packages/core/LICENSE",
      "packages/core/NOTICE",
    ]);
  });

  test("excludes docs, tests, generated changelogs, and repository tooling", () => {
    expect(packageFacingFiles([
      "apps/docs/src/App.tsx",
      "packages/core/tests/selectors.test.ts",
      "packages/core/tsconfig.build.json",
      "packages/core/CHANGELOG.md",
      "README.md",
      "scripts/verify-release-sync.mjs",
      ".github/workflows/ci.yml",
    ])).toEqual([]);
  });
});

describe("changesetFiles", () => {
  test("accepts release notes but ignores the directory README", () => {
    expect(changesetFiles([
      ".changeset/README.md",
      ".changeset/bright-lines-wrap.md",
      "packages/core/src/index.ts",
    ])).toEqual([".changeset/bright-lines-wrap.md"]);
  });
});

describe("evaluateChangesetRequirement", () => {
  test("rejects a package-facing change without release notes", () => {
    expect(evaluateChangesetRequirement(["packages/core/src/index.ts"])).toMatchObject({
      required: true,
      satisfied: false,
    });
  });

  test("accepts a package-facing change with a Changeset", () => {
    expect(evaluateChangesetRequirement([
      "packages/core/src/index.ts",
      ".changeset/bright-lines-wrap.md",
    ])).toMatchObject({
      required: true,
      satisfied: true,
    });
  });

  test("does not let a deleted Changeset satisfy the requirement", () => {
    expect(evaluateChangesetRequirement(
      ["packages/core/src/index.ts", ".changeset/removed-note.md"],
      ["packages/core/src/index.ts"],
    )).toMatchObject({
      required: true,
      satisfied: false,
    });
  });

  test("allows changes outside published package contents", () => {
    expect(evaluateChangesetRequirement([
      "apps/docs/src/App.tsx",
      "packages/core/tests/selectors.test.ts",
    ])).toMatchObject({
      required: false,
      satisfied: true,
    });
  });
});
