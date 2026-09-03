import { execFileSync } from "node:child_process";
import { evaluateChangesetRequirement } from "./release-scope";

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function changedFiles(base: string, diffFilter: string): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `--diff-filter=${diffFilter}`, `${base}...HEAD`],
    { encoding: "utf8" },
  );
  return output.split("\n").map((path) => path.trim()).filter(Boolean);
}

const base = argumentValue("--base") ?? process.env.GITHUB_BASE_SHA;
if (!base) {
  console.error("Usage: bun run release:guard --base <git-ref>");
  process.exit(2);
}

const requirement = evaluateChangesetRequirement(
  changedFiles(base, "ACMRD"),
  changedFiles(base, "ACMR"),
);
if (!requirement.required) {
  console.log("No package-facing changes require a Changeset.");
  process.exit(0);
}

if (!requirement.satisfied) {
  console.error("Package-facing changes require a Changeset:");
  for (const path of requirement.packageFiles) console.error(`- ${path}`);
  console.error("Run `bun changeset` and commit the generated file.");
  process.exit(1);
}

console.log(`Changeset requirement satisfied by ${requirement.changesets.join(", ")}.`);
