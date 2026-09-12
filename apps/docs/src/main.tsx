import { createRoot, hydrateRoot } from "react-dom/client";
import { SiteRoot } from "./SiteRoot";
import { localeFromPath, type SiteLocale } from "./site-config";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("Root element was not found");

// Keep each awaited import in its own branch. Combining imports in a conditional
// expression lets the bundler merge preload dependencies from both page types.
async function loadPage(isDocs: boolean) {
  if (isDocs) return (await import("./Docs")).DocsApp;
  return (await import("./App")).App;
}

async function loadModel(locale: SiteLocale) {
  if (locale === "ko") return (await import("@semantic-wrap/ko")).koTitleModel;
  return (await import("@semantic-wrap/en")).enTitleModel;
}

async function start() {
  const locale = localeFromPath(window.location.pathname);
  const isDocs = /^\/(ko\/)?docs(?:\/|$)/.test(window.location.pathname);
  const [Page, model] = await Promise.all([
    loadPage(isDocs),
    loadModel(locale),
  ]);
  const app = <SiteRoot locale={locale} model={model}><Page locale={locale} /></SiteRoot>;
  if (root!.hasChildNodes()) hydrateRoot(root!, app);
  else createRoot(root!).render(app);
}

void start();
