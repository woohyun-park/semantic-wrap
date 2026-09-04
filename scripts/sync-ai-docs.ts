import { readFile, writeFile } from "node:fs/promises";

const repositoryUrl = "https://github.com/woohyun-park/semantic-wrap";
const rawRepositoryUrl = "https://raw.githubusercontent.com/woohyun-park/semantic-wrap/main";
const readmeUrl = new URL("../README.md", import.meta.url);
const summaryUrl = new URL("../apps/docs/public/llms.txt", import.meta.url);
const fullUrl = new URL("../apps/docs/public/llms-full.txt", import.meta.url);
const checkOnly = process.argv.includes("--check");

function publicLink(path: string): string {
  return `${repositoryUrl}/blob/main/${path}`;
}

function normalizeLinks(markdown: string): string {
  return markdown
    .replaceAll(/\]\(\.\/([^\s)]+)\)/gu, (_match, path: string) => `](${publicLink(path)})`)
    .replaceAll(/(src|href)="\.\/([^"]+)"/gu, (_match, attribute: string, path: string) => {
      const base = path.startsWith("assets/") ? rawRepositoryUrl : `${repositoryUrl}/blob/main`;
      return `${attribute}="${base}/${path}"`;
    });
}

function renderFullDocumentation(readme: string): string {
  const contentStart = readme.indexOf("## What is semantic-wrap?");
  if (contentStart < 0) throw new Error("README.md is missing the English documentation entrypoint");
  const content = normalizeLinks(readme.slice(contentStart).trim());
  return [
    "# semantic-wrap — complete documentation",
    "",
    "> Generated from the canonical English README. For a compact index, see https://semantic-wrap.woohyunpark.xyz/llms.txt.",
    "",
    content,
    "",
  ].join("\n");
}

const readme = await readFile(readmeUrl, "utf8");
const summary = await readFile(summaryUrl, "utf8");
const expectedFull = renderFullDocumentation(readme);

if (!summary.startsWith("# semantic-wrap\n\n> ")) {
  throw new Error("llms.txt must start with an H1 followed by a blockquote summary");
}
if (!summary.includes("https://semantic-wrap.woohyunpark.xyz/llms-full.txt")) {
  throw new Error("llms.txt must link to the full LLM documentation");
}
if (/\]\(\.\//u.test(summary)) {
  throw new Error("llms.txt must use public absolute links");
}

if (checkOnly) {
  const currentFull = await readFile(fullUrl, "utf8").catch(() => "");
  if (currentFull !== expectedFull) {
    console.error("AI documentation is out of sync.");
    console.error("Run `bun run ai-docs:sync` and commit the generated changes.");
    process.exit(1);
  }
  console.log("AI documentation is synchronized.");
} else {
  await writeFile(fullUrl, expectedFull);
  console.log("AI documentation updated.");
}
