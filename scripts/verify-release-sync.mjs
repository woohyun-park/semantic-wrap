import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const packages = ["core", "en", "ko", "react"];
const repository = "woohyun-park/semantic-wrap";
const remote = process.argv.includes("--remote");

async function readPackage(name) {
  return JSON.parse(await readFile(new URL(`../packages/${name}/package.json`, import.meta.url), "utf8"));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "User-Agent": "semantic-wrap-release-verifier",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const manifests = await Promise.all(packages.map(readPackage));
const expectedVersion = manifests[0]?.version;
const localVersions = new Map(manifests.map((manifest) => [manifest.name, manifest.version]));

if (!expectedVersion || new Set(localVersions.values()).size !== 1) {
  throw new Error(`Public package versions must match: ${JSON.stringify(Object.fromEntries(localVersions))}`);
}

if (!remote) {
  console.log(`Release manifests are synchronized at v${expectedVersion}.`);
  process.exit(0);
}

const npmVersions = await Promise.all(manifests.map(async (manifest) => {
  const metadata = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/latest`);
  return [manifest.name, metadata.version];
}));

for (const [name, version] of npmVersions) {
  if (version !== expectedVersion) {
    throw new Error(`${name} is v${expectedVersion} locally but v${version} on npm.`);
  }
}

const expectedCommit = process.env.RELEASE_COMMIT || null;
for (const manifest of manifests) {
  const tag = `${manifest.name}@${expectedVersion}`;
  let commit;
  try {
    commit = execFileSync("git", ["rev-parse", `${tag}^{commit}`], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`Missing git tag ${tag}.`);
  }
  if (expectedCommit && commit !== expectedCommit) {
    throw new Error(`${tag} points to ${commit}, expected ${expectedCommit}.`);
  }
}

const latestRelease = await fetchJson(
  `https://api.github.com/repos/${repository}/releases/latest?verified_at=${Date.now()}`,
);
if (latestRelease.tag_name !== `v${expectedVersion}`) {
  throw new Error(`Latest GitHub Release is ${latestRelease.tag_name}, expected v${expectedVersion}.`);
}

console.log(`npm, git tags, and GitHub Releases are synchronized at v${expectedVersion}.`);
