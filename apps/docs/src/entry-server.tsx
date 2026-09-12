import { renderToString } from "react-dom/server";
import { enTitleModel } from "@semantic-wrap/en";
import { koTitleModel } from "@semantic-wrap/ko";
import { App } from "./App";
import { DocsApp } from "./Docs";
import { SiteRoot } from "./SiteRoot";
import { localeFromPath } from "./site-config";

export function render(pathname: string) {
  const locale = localeFromPath(pathname);
  const Page = /^\/(ko\/)?docs(?:\/|$)/.test(pathname) ? DocsApp : App;
  return renderToString(
    <SiteRoot locale={locale} model={locale === "ko" ? koTitleModel : enTitleModel}>
      <Page locale={locale} />
    </SiteRoot>,
  );
}
