import corePackage from "../../../packages/core/package.json";

export const repositoryUrl = "https://github.com/woohyun-park/semantic-wrap";
export const siteVersion = `v${corePackage.version}`;
export const productionUrl = "https://semantic-wrap.woohyunpark.xyz";

export type SiteLocale = "en" | "ko";

export function localeFromPath(pathname: string): SiteLocale {
  return pathname === "/ko" || pathname.startsWith("/ko/") ? "ko" : "en";
}

export function landingPath(locale: SiteLocale): string {
  return locale === "ko" ? "/ko" : "/";
}

export function docsPath(locale: SiteLocale): string {
  return locale === "ko" ? "/ko/docs/introduction" : "/docs/introduction";
}

export function alternateLocalePath(pathname: string, locale: SiteLocale): string {
  const isDocs = pathname === "/docs"
    || pathname.startsWith("/docs/")
    || pathname === "/ko/docs"
    || pathname.startsWith("/ko/docs/");
  return isDocs ? docsPath(locale === "en" ? "ko" : "en") : landingPath(locale === "en" ? "ko" : "en");
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}
