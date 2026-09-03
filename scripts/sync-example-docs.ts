import { readFile, writeFile } from "node:fs/promises";
import { exampleCases, type ExampleLocale } from "../apps/docs/src/example-cases";

const startMarker = "<!-- semantic-wrap-examples:start -->";
const endMarker = "<!-- semantic-wrap-examples:end -->";
const checkOnly = process.argv.includes("--check");

const documents = [
  { locale: "en", url: new URL("../README.md", import.meta.url) },
  { locale: "ko", url: new URL("../README-ko_kr.md", import.meta.url) },
] as const satisfies readonly { locale: ExampleLocale; url: URL }[];

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function renderLines(lines: readonly string[]): string {
  return escapeCell(lines.join("<br>"));
}

function renderExamples(locale: ExampleLocale): string {
  const headers = locale === "ko"
    ? ["CSS balance 줄바꿈", "semantic-wrap"]
    : ["CSS balance", "semantic-wrap"];
  const rows = exampleCases[locale].readme.map(({ reference }) =>
    `| ${renderLines(reference.nativeLines)} | ${renderLines(reference.semanticLines)} |`
  );

  return [
    startMarker,
    `| ${headers[0]} | ${headers[1]} |`,
    "| --- | --- |",
    ...rows,
    endMarker,
  ].join("\n");
}

function replaceExamples(source: string, locale: ExampleLocale): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < start) {
    throw new Error(`Missing semantic-wrap example markers for ${locale}`);
  }
  return `${source.slice(0, start)}${renderExamples(locale)}${source.slice(end + endMarker.length)}`;
}

const stale: string[] = [];
for (const document of documents) {
  const source = await readFile(document.url, "utf8");
  const next = replaceExamples(source, document.locale);
  if (source === next) continue;
  if (checkOnly) {
    stale.push(document.url.pathname.split("/").at(-1) ?? document.url.pathname);
  } else {
    await writeFile(document.url, next);
  }
}

if (stale.length > 0) {
  console.error(`Example documentation is out of sync: ${stale.join(", ")}`);
  console.error("Run `bun run examples:sync` and commit the generated changes.");
  process.exit(1);
}

console.log(checkOnly ? "Example documentation is synchronized." : "Example documentation updated.");
