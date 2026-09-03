import { useEffect, useState } from "react";
import brandMarkUrl from "./brand-mark.png";
import {
  alternateLocalePath,
  docsPath,
  landingPath,
  repositoryUrl,
  siteVersion,
  type SiteLocale,
} from "./site-config";

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 2.75a9.5 9.5 0 0 0-3 18.52c.48.09.65-.21.65-.46v-1.67c-2.68.58-3.24-1.13-3.24-1.13-.44-1.12-1.07-1.42-1.07-1.42-.87-.6.07-.59.07-.59.97.07 1.48.99 1.48.99.86 1.47 2.25 1.05 2.8.8.09-.62.34-1.05.61-1.29-2.14-.24-4.39-1.07-4.39-4.7 0-1.04.37-1.89.99-2.56-.1-.24-.43-1.22.09-2.52 0 0 .8-.26 2.61.98A9.1 9.1 0 0 1 12 7.42a9.1 9.1 0 0 1 2.38.32c1.81-1.24 2.61-.98 2.61-.98.52 1.3.19 2.28.09 2.52.62.67.99 1.52.99 2.56 0 3.64-2.26 4.45-4.4 4.69.35.3.65.88.65 1.78v2.5c0 .25.18.55.66.46A9.5 9.5 0 0 0 12 2.75Z" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
      <path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m4.5 10.5 3.25 3.25 7.75-8" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <img
      className="brand-mark"
      src={brandMarkUrl}
      alt=""
      width="192"
      height="97"
      aria-hidden="true"
    />
  );
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="semantic-wrap">
      semantic-<span>wrap</span>
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  const classes = ["brand-lockup", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <BrandMark />
      <Wordmark />
    </span>
  );
}

export function SiteHeader({
  current,
  hideBrandWhile,
  locale,
}: {
  current?: "docs";
  hideBrandWhile?: string;
  locale: SiteLocale;
}) {
  const [isBrandHidden, setIsBrandHidden] = useState(Boolean(hideBrandWhile));

  useEffect(() => {
    if (!hideBrandWhile) {
      setIsBrandHidden(false);
      return undefined;
    }

    const target = document.querySelector(hideBrandWhile);
    if (!target) {
      setIsBrandHidden(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsBrandHidden(entry?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hideBrandWhile]);

  const alternateHref = `${alternateLocalePath(window.location.pathname, locale)}${current ? window.location.hash : ""}`;
  const copy = locale === "ko"
    ? { docs: "문서", github: "GitHub 저장소", home: "semantic-wrap 홈", nav: "주요 메뉴", switch: "EN" }
    : { docs: "Docs", github: "GitHub repository", home: "semantic-wrap home", nav: "Primary navigation", switch: "한국어" };

  return (
    <header className={`site-header${isBrandHidden ? " is-hero-brand-visible" : ""}`}>
      <div className="site-header-inner page-width">
        <a
          className="brand-link"
          href={landingPath(locale)}
          aria-label={copy.home}
          aria-hidden={isBrandHidden}
          tabIndex={isBrandHidden ? -1 : undefined}
        >
          <BrandLockup />
        </a>
        <nav className="main-nav" aria-label={copy.nav}>
          <a
            href={docsPath(locale)}
            aria-current={current === "docs" ? "page" : undefined}
          >
            {copy.docs}
          </a>
          <a className="locale-link" href={alternateHref} hrefLang={locale === "ko" ? "en" : "ko"}>
            {copy.switch}
          </a>
        </nav>
        <a
          className="github-link"
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.github}
        >
          <GitHubIcon />
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width">
        <div className="footer-meta">
          <span>semantic-wrap</span>
          <span aria-hidden="true">·</span>
          <span>{siteVersion}</span>
          <span aria-hidden="true">·</span>
          <span>Apache-2.0</span>
        </div>
      </div>
    </footer>
  );
}
