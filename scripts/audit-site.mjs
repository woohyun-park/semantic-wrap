import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.LIGHTHOUSE_ORIGIN ?? "http://127.0.0.1:4193";
const output = resolve(process.env.LIGHTHOUSE_OUTPUT ?? "dogfood-output/lighthouse");
const runs = Number(process.env.LIGHTHOUSE_RUNS ?? 3);
if (!Number.isInteger(runs) || runs < 1) throw new Error("LIGHTHOUSE_RUNS must be a positive integer");
const pages = ["/", "/ko", "/docs/introduction", "/ko/docs/introduction"];
const profiles = ["mobile", "desktop"];
const budgets = { performance: 0.9, accessibility: 0.95, "best-practices": 0.95, seo: 0.95 };
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
await mkdir(output, { recursive: true });

let preview;
if (process.argv.includes("--serve") && !process.env.LIGHTHOUSE_ORIGIN) {
  preview = spawn("bun", ["run", "site:preview", "--host", "127.0.0.1", "--port", "4193", "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.on("exit", () => preview.kill());
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
  // Poll the server instead of parsing its log: Vite colors "Local:" when CI enables color output.
  let log = "";
  let failure;
  preview.stdout.on("data", data => { log += data; });
  preview.stderr.on("data", data => { log += data; });
  preview.on("error", error => { failure = error; });
  preview.on("exit", code => { failure ??= new Error(`Preview exited (${code}): ${log}`); });
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (failure) throw failure;
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`Preview did not start within 30 seconds: ${log}`);
    await new Promise(wait => setTimeout(wait, 250));
  }
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { ...options, timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", data => { log += data; });
    child.stderr.on("data", data => { log += data; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolveRun() : reject(new Error(log)));
  });
}

async function audit() {
  const summary = [];
  for (const profile of profiles) {
    for (const page of pages) {
      const reports = [];
      for (let attempt = 0; attempt < runs; attempt++) {
        const file = resolve(output, `${profile}-${page.replaceAll("/", "_")}-${attempt + 1}`);
        await run(process.execPath, [
          "node_modules/lighthouse/cli/index.js", `${origin}${page}`,
          "--quiet", "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
          "--output=json", "--output=html", `--output-path=${file}`,
          ...(profile === "desktop" ? ["--preset=desktop"] : []),
        ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() } });
        const report = JSON.parse(await readFile(`${file}.report.json`, "utf8"));
        if (report.runtimeError) throw new Error(JSON.stringify(report.runtimeError));
        reports.push(report);
        console.log(`${profile} ${page} ${attempt + 1}/${runs}: ${Object.keys(budgets).map(key => `${key}=${Math.round(report.categories[key].score * 100)}`).join(" ")}`);
      }
      summary.push({
        page, profile, lighthouseVersion: reports[0].lighthouseVersion,
        browser: reports[0].environment.hostUserAgent,
        scores: Object.fromEntries(Object.keys(budgets).map(key => [key, median(reports.map(r => r.categories[key].score))])),
        metrics: Object.fromEntries(["largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift"].map(key => [key, median(reports.map(r => r.audits[key].numericValue))])),
      });
    }
  }
  await writeFile(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
  console.table(summary.map(row => ({ page: row.page, profile: row.profile, ...row.scores, ...row.metrics })));
  if (process.env.LIGHTHOUSE_ASSERT !== "0" && summary.some(row => Object.entries(budgets).some(([key, minimum]) => row.scores[key] < minimum))) {
    throw new Error(`Lighthouse budget failed. See ${output}/summary.json and HTML reports.`);
  }
}

try {
  await audit();
} finally {
  preview?.kill();
}
