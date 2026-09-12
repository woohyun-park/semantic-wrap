export const sitePages = [
  { path: "/", file: "index.html" },
  { path: "/ko", file: "ko/index.html" },
  { path: "/docs/introduction", file: "docs/introduction/index.html" },
  { path: "/ko/docs/introduction", file: "ko/docs/introduction/index.html" },
] as const;

export const siteRedirects: Record<string, string> = {
  "/docs": "/docs/introduction",
  "/ko/docs": "/ko/docs/introduction",
  "/index": "/",
  "/ko/index": "/ko",
  "/docs/introduction/index": "/docs/introduction",
  "/ko/docs/introduction/index": "/ko/docs/introduction",
};
