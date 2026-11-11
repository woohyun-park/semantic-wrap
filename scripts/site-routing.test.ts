import { expect, test } from "bun:test";
import { sitePages, siteRedirects } from "../apps/docs/src/site-routes";
import config from "../vercel.json";

test("production routing serves only known pages and matches preview redirects", () => {
  expect(config.cleanUrls).toBe(true);
  expect(config.trailingSlash).toBe(false);
  const bySource = (a: { source: string }, b: { source: string }) => a.source.localeCompare(b.source);
  expect([...config.rewrites].sort(bySource)).toEqual(sitePages.filter(page => page.path !== "/").map(page => ({
    source: page.path, destination: `/${page.file.replace(/\.html$/, "")}`,
  })).sort(bySource));
  expect(config.redirects).toEqual(Object.entries(siteRedirects).map(([source, destination]) => ({
    source, destination, permanent: true,
  })));
});
