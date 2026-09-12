import type { Plugin } from "vite";
import { siteMetadata } from "./src/site-metadata.ts";
import { sitePages, siteRedirects } from "./src/site-routes.ts";
import { productionUrl } from "./src/site-config.ts";

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
    apply: (_config, environment) => !environment.isSsrBuild,
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const path = url.pathname.replace(/\/$/, "") || "/";
        if (sitePages.some(page => page.path === path) || siteRedirects[path]) {
          request.originalUrl = request.url;
          request.url = `/index.html${url.search}`;
        }
        next();
      });
    },
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
        for (const page of sitePages.slice(1)) {
          this.emitFile({ type: "asset", fileName: page.file, source: renderMetadata(index.source, page.path) });
        }
        this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n\nSitemap: ${productionUrl}/sitemap.xml\n` });
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitePages.map(page => `  <url><loc>${productionUrl}${page.path}</loc></url>`).join("\n")}\n</urlset>\n` });
      },
    },
    configurePreviewServer(server) {
      // Mirror the production rewrites so preview/tests exercise the actual static HTML.
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const normalized = url.pathname.replace(/\/$/, "") || "/";
        const clean = normalized.replace(/\.html$/, "");
        const redirect = siteRedirects[clean] ?? (normalized !== url.pathname ? normalized : undefined);
        if (redirect) {
          response.writeHead(308, { Location: `${redirect}${url.search}` });
          response.end();
          return;
        }
        const page = sitePages.find(entry => entry.path === normalized);
        if (page) request.url = `/${page.file}${url.search}`;
        next();
      });
    },
  };
}
