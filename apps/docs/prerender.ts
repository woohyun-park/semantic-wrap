import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Manifest } from "vite";
import { sitePages } from "./src/site-routes";

const { render } = await import(resolve("../../.cache/docs-ssr/entry-server.js")) as {
  render(pathname: string): string;
};
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8")) as Manifest;

for (const page of sitePages) {
  const entry = page.path.includes("/docs/") ? "src/Docs.tsx" : "src/App.tsx";
  const visited = new Set<string>();
  const styles = new Set<string>();
  const modules = new Set<string>();
  function collect(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing client chunk: ${key}`);
    modules.add(chunk.file);
    for (const css of chunk.css ?? []) styles.add(css);
    for (const dependency of chunk.imports ?? []) collect(dependency);
  }
  collect(entry);
  const file = `dist/${page.file}`;
  let html = await readFile(file, "utf8");
  // React emits image hints while rendering. Reuse the explicit head preload and
  // keep any additional hints in the head, outside the hydrated application.
  const resourceHints: string[] = [];
  const markup = render(page.path).replace(/<link\b[^>]*rel="preload"[^>]*\/>/g, hint => {
    const href = hint.match(/href="([^"]+)"/)?.[1];
    if (!href || !html.includes(`href="${href}"`)) resourceHints.push(hint);
    return "";
  });
  const links = [
    ...resourceHints,
    ...[...styles].filter(css => !html.includes(`href="/${css}"`)).map(css => `<link rel="stylesheet" href="/${css}">`),
    ...[...modules].filter(js => !html.includes(`href="/${js}"`)).map(js => `<link rel="modulepreload" href="/${js}">`),
  ];
  html = html.replace("</head>", `${links.join("\n")}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  await writeFile(file, html);
  console.log(`Prerendered ${page.path}`);
}
