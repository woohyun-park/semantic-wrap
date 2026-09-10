import type { Plugin } from "vite";
import { siteMetadata } from "./src/site-metadata";

const pages = [
  { path: "/", file: "index.html" },
  { path: "/ko", file: "ko/index.html" },
  { path: "/docs/introduction", file: "docs/introduction/index.html" },
  { path: "/ko/docs/introduction", file: "ko/docs/introduction/index.html" },
];

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderMetadata(html: string, pathname: string) {
  const metadata = siteMetadata(pathname);
  const attributes = (values: Record<string, string | undefined>) => Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${escapeHtml(value!)}"`).join(" ");
  const head = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    ...metadata.meta.map((meta) => `<meta ${attributes(meta)} />`),
    ...metadata.links.map((link) => `<link data-semantic-wrap-locale="true" ${attributes(link)} />`),
  ].join("\n    ");

  return html.replace(/<html lang="[^"]*">/, `<html lang="${metadata.locale}">`)
    .replace(/<!-- site-metadata:start -->[\s\S]*?<!-- site-metadata:end -->/,
      `<!-- site-metadata:start -->\n    ${head}\n    <!-- site-metadata:end -->`);
}

export function siteMetadataPlugin(): Plugin {
  return {
    name: "semantic-wrap-site-metadata",
    transformIndexHtml(html, context) {
      return renderMetadata(html, new URL(context.originalUrl ?? context.path, "http://localhost").pathname);
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset" || typeof index.source !== "string") {
          throw new Error("Missing built index.html for localized sharing metadata");
        }
        for (const page of pages.slice(1)) {
          this.emitFile({ type: "asset", fileName: page.file, source: renderMetadata(index.source, page.path) });
        }
      },
    },
    configurePreviewServer(server) {
      // Mirror the production rewrites so preview/tests exercise the actual static HTML.
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.split("/").at(-1)?.includes(".")) {
          const canonical = new URL(siteMetadata(url.pathname).links[0]!.href).pathname;
          const page = pages.find((entry) => canonical === entry.path);
          if (page) request.url = `/${page.file}${url.search}`;
        }
        next();
      });
    },
  };
}
