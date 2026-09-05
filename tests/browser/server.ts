import { join } from "node:path";

const build = await Bun.build({
  entrypoints: [join(import.meta.dir, "client.tsx")],
  format: "esm",
  target: "browser",
});

if (!build.success || !build.outputs[0]) {
  throw new Error(build.logs.map(String).join("\n"));
}

const client = build.outputs[0];
const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      .title { margin: 0; font: 28px/1.25 system-ui, sans-serif; word-break: keep-all; }
    </style>
  </head>
  <body>
    <main id="root"></main>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;

Bun.serve({
  hostname: "127.0.0.1",
  port: 4191,
  fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/client.js") {
      return new Response(client, {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }
    if (pathname === "/client-before.js" && process.env.SEMANTIC_WRAP_RESIZE_BASELINE) {
      return new Response(Bun.file(process.env.SEMANTIC_WRAP_RESIZE_BASELINE), {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }
    if (pathname === "/") {
      const before = new URL(request.url).searchParams.has("before");
      if (before && !process.env.SEMANTIC_WRAP_RESIZE_BASELINE) {
        return new Response("SEMANTIC_WRAP_RESIZE_BASELINE is required for before comparisons", { status: 400 });
      }
      return new Response(before && process.env.SEMANTIC_WRAP_RESIZE_BASELINE
        ? html.replace("/client.js", "/client-before.js") : html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});
