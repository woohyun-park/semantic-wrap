import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  CopyIcon,
  SiteFooter,
  SiteHeader,
} from "./site";
import { KoreanSemanticWrap } from "./KoreanSemanticWrap";
import { LocalizedSemanticWrap } from "./LocalizedSemanticWrap";
import {
  copyText,
  docsPath,
  repositoryUrl,
  type SiteLocale,
} from "./site-config";

const installCode =
  "npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react react-dom";

const reactCode = `import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

export function Title({ children }: { children: string }) {
  return (
    <SemanticWrap model={koTitleModel}>
      <h1 className="title">{children}</h1>
    </SemanticWrap>
  );
}`;

const coreCode = `import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "더 나은 사용자 경험을 만드는 방법",
  model: koTitleModel,
  maxWidth: 320,
  measureText: (text) => canvasContext.measureText(text).width,
});

console.log(result.lines);
// ["더 나은 사용자 경험을", "만드는 방법"]`;

const planCode = `const plan = createLineBreakPlan({ text, model, strategy });

plan.predict();
plan.aggregate();
plan.calculate({ maxWidth, measureText });
plan.select({ maxWidth, measureText, nativeLayout });`;

const modelCode = `import {
  selectLineBreaks,
  type PhraseModel,
} from "@semantic-wrap/core";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const colonTitleModel: PhraseModel = {
  boundaryMode: "spaces",
  levels: [
    {
      name: "after-colon",
      model: { UW3: { ":": 100 } },
      penalty: 0,
    },
  ],
  fallbackPenalty: 1,
};

const result = selectLineBreaks({
  text: "서비스 업데이트: 새로운 기능을 사용하는 방법",
  model: colonTitleModel,
  maxWidth: 400,
  measureText: (value) => canvasContext.measureText(value).width,
});

console.log(result.lines);
// ["서비스 업데이트:", "새로운 기능을 사용하는 방법"]`;

const strategyCode = `import {
  balance,
  consensus,
  createLineBreakStrategy,
  greedy,
} from "@semantic-wrap/core";

const consensusStrategy = createLineBreakStrategy({
  aggregate: consensus({ minimumModels: 2 }),
  select: balance({ tolerance: 0.12 }),
});

const greedyStrategy = createLineBreakStrategy({
  calculate: greedy(),
});`;

const customStrategyCode = `import {
  createLineBreakStrategy,
  selectLineBreaks,
  type LineBreakCalculator,
} from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const twoLineTitleCalculator: LineBreakCalculator = ({
  text,
  candidates,
  maxWidth,
  measureText,
}) => {
  let best: { offset: number; score: number } | undefined;

  for (const candidate of candidates) {
    const firstLine = text.slice(0, candidate.offset).trimEnd();
    const lastLine = text.slice(candidate.offset).trimStart();
    const firstWidth = measureText(firstLine);
    const lastWidth = measureText(lastLine);

    if (firstWidth > maxWidth || lastWidth > maxWidth) continue;
    if (lastLine.split(/\\s+/u).length < 2) continue;

    const imbalance = Math.abs(firstWidth - lastWidth) / maxWidth;
    const score = candidate.penalty + imbalance;
    if (!best || score < best.score) {
      best = { offset: candidate.offset, score };
    }
  }

  return [{ breaks: best ? [best.offset] : [] }];
};

const twoLineTitleStrategy = createLineBreakStrategy({
  calculate: twoLineTitleCalculator,
});

const input = {
  text: "좋은 사용자 경험을 만들기 위해 놓치지 말아야 할 기준",
  model: koTitleModel,
  maxWidth: 360,
  measureText: (value: string) => canvasContext.measureText(value).width,
};

console.log(selectLineBreaks(input).lines);
// ["좋은 사용자 경험을 만들기", "위해 놓치지 말아야 할 기준"]

console.log(selectLineBreaks(input, { strategy: twoLineTitleStrategy }).lines);
// ["좋은 사용자 경험을 만들기 위해", "놓치지 말아야 할 기준"]`;

const diagnosticsCode = `const result = selectLineBreaks(
  {
    text: "더 나은 사용자",
    model: koTitleModel,
    maxWidth: 320,
    measureText: (text) => canvasContext.measureText(text).width,
  },
  { diagnostics: true },
);

console.log(result.diagnostics.predictions);
console.log(result.diagnostics.candidates);`;

const progressiveCode = `<SemanticWrap mode="progressive" model={koTitleModel}>
  <h1>{title}</h1>
</SemanticWrap>`;

const chakraCode = `import { Text } from "@chakra-ui/react";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={koTitleModel}>
  <Text textStyle="heading2">{title}</Text>
</SemanticWrap>`;

const tailwindCode = `import { createLineBreakStrategy, greedy } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const greedyStrategy = createLineBreakStrategy({
  calculate: greedy(),
});

<SemanticWrap model={koTitleModel} strategy={greedyStrategy}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>`;

const hookCode = `import { koTitleModel } from "@semantic-wrap/ko";
import { useSemanticWrap } from "@semantic-wrap/react";

export function BreakPreview({ title }: { title: string }) {
  const { ref, selection } = useSemanticWrap({
    text: title,
    model: koTitleModel,
  });
  const preview = selection ? selection.lines.join(" / ") : title;

  return <h1 ref={ref}>{preview}</h1>;
}`;

const modelImportCode = `import { koTitleModel } from "@semantic-wrap/ko";
import { enTitleModel } from "@semantic-wrap/en";`;

const developmentCode = `bun install
bun run check`;

const englishInstallCode =
  "npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/en react react-dom";

const englishReactCode = `import { enTitleModel } from "@semantic-wrap/en";
import { SemanticWrap } from "@semantic-wrap/react";

export function Title({ children }: { children: string }) {
  return (
    <SemanticWrap model={enTitleModel}>
      <h1 className="title">{children}</h1>
    </SemanticWrap>
  );
}`;

const englishCoreCode = `import { selectLineBreaks } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";

const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "Write headlines for readers not for internal approval",
  model: enTitleModel,
  maxWidth: 420,
  measureText: (text) => canvasContext.measureText(text).width,
});

console.log(result.lines);
// ["Write headlines for readers", "not for internal approval"]`;

const englishModelCode = `import {
  selectLineBreaks,
  type PhraseModel,
} from "@semantic-wrap/core";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const colonTitleModel: PhraseModel = {
  boundaryMode: "spaces",
  levels: [{
    name: "after-colon",
    model: { UW3: { ":": 100 } },
    penalty: 0,
  }],
  fallbackPenalty: 1,
};

const result = selectLineBreaks({
  text: "Design review checklist: what to ask before approval",
  model: colonTitleModel,
  maxWidth: 400,
  measureText: (value) => canvasContext.measureText(value).width,
});

console.log(result.lines);
// ["Design review checklist:", "what to ask before approval"]`;

const englishCustomStrategyCode = customStrategyCode
  .replaceAll('import { koTitleModel } from "@semantic-wrap/ko";', 'import { enTitleModel } from "@semantic-wrap/en";')
  .replaceAll("koTitleModel", "enTitleModel")
  .replaceAll("좋은 사용자 경험을 만들기 위해 놓치지 말아야 할 기준", "Good metrics guide decisions before they become dashboard decoration")
  .replaceAll('["좋은 사용자 경험을 만들기", "위해 놓치지 말아야 할 기준"]', '["Good metrics guide decisions before", "they become dashboard decoration"]')
  .replaceAll('["좋은 사용자 경험을 만들기 위해", "놓치지 말아야 할 기준"]', '["Good metrics guide decisions", "before they become dashboard decoration"]');

const englishDiagnosticsCode = `const result = selectLineBreaks(input, { diagnostics: true });

console.log(result.diagnostics.predictions);
console.log(result.diagnostics.candidates);`;

const englishProgressiveCode = `<SemanticWrap mode="progressive" model={enTitleModel}>
  <h1>{title}</h1>
</SemanticWrap>`;

const englishChakraCode = chakraCode
  .replaceAll('import { koTitleModel } from "@semantic-wrap/ko";', 'import { enTitleModel } from "@semantic-wrap/en";')
  .replaceAll("koTitleModel", "enTitleModel");

const englishTailwindCode = tailwindCode
  .replaceAll('import { koTitleModel } from "@semantic-wrap/ko";', 'import { enTitleModel } from "@semantic-wrap/en";')
  .replaceAll("koTitleModel", "enTitleModel");

const englishHookCode = hookCode
  .replaceAll('import { koTitleModel } from "@semantic-wrap/ko";', 'import { enTitleModel } from "@semantic-wrap/en";')
  .replaceAll("koTitleModel", "enTitleModel");

function getNavigationGroups(locale: SiteLocale) {
  const introductionPath = docsPath(locale);
  if (locale === "en") return [
    {
      label: "Get started",
      links: [
        { href: introductionPath, label: "Introduction" },
        { href: `${introductionPath}#examples`, label: "Examples" },
        { href: `${introductionPath}#quick-start`, label: "Quick start" },
        { href: `${introductionPath}#how-it-works`, label: "How it works" },
        { href: `${introductionPath}#packages`, label: "Packages" },
      ],
    },
    {
      label: "@semantic-wrap/core",
      links: [
        { href: `${introductionPath}#core-api`, label: "selectLineBreaks" },
        { href: `${introductionPath}#line-break-plan`, label: "createLineBreakPlan" },
        { href: `${introductionPath}#custom-models`, label: "Custom models" },
        { href: `${introductionPath}#strategies`, label: "Strategies" },
        { href: `${introductionPath}#diagnostics`, label: "Diagnostics" },
      ],
    },
    {
      label: "@semantic-wrap/react",
      links: [
        { href: `${introductionPath}#semantic-wrap`, label: "<SemanticWrap />" },
        { href: `${introductionPath}#chakra-ui`, label: "Chakra UI" },
        { href: `${introductionPath}#tailwind-css`, label: "Tailwind CSS" },
        { href: `${introductionPath}#use-semantic-wrap`, label: "useSemanticWrap" },
      ],
    },
    {
      label: "Models and project",
      links: [
        { href: `${introductionPath}#models`, label: "English and Korean presets" },
        { href: `${introductionPath}#development`, label: "Development" },
        { href: `${introductionPath}#license`, label: "License" },
      ],
    },
  ];

  return [
  {
    label: "시작하기",
    links: [
      { href: introductionPath, label: "semantic-wrap 소개" },
      { href: `${introductionPath}#examples`, label: "결과 예시" },
      { href: `${introductionPath}#quick-start`, label: "빠르게 시작하기" },
      { href: `${introductionPath}#how-it-works`, label: "동작 방식" },
      { href: `${introductionPath}#packages`, label: "패키지 구성" },
    ],
  },
  {
    label: "@semantic-wrap/core",
    links: [
      { href: `${introductionPath}#core-api`, label: "selectLineBreaks" },
      { href: `${introductionPath}#line-break-plan`, label: "createLineBreakPlan" },
      { href: `${introductionPath}#custom-models`, label: "커스텀 모델" },
      { href: `${introductionPath}#strategies`, label: "Strategy" },
      { href: `${introductionPath}#diagnostics`, label: "Diagnostics" },
    ],
  },
  {
    label: "@semantic-wrap/react",
    links: [
      { href: `${introductionPath}#semantic-wrap`, label: "<SemanticWrap />" },
      { href: `${introductionPath}#chakra-ui`, label: "Chakra UI" },
      { href: `${introductionPath}#tailwind-css`, label: "Tailwind CSS" },
      { href: `${introductionPath}#use-semantic-wrap`, label: "useSemanticWrap" },
    ],
  },
  {
    label: "모델과 프로젝트",
    links: [
      { href: `${introductionPath}#models`, label: "한국어와 영어 프리셋" },
      { href: `${introductionPath}#development`, label: "개발" },
      { href: `${introductionPath}#license`, label: "라이선스" },
    ],
  },
  ];
}

function useActiveDocsHref(locale: SiteLocale) {
  const introductionPath = docsPath(locale);
  const navigationLinks = useMemo(
    () => getNavigationGroups(locale).flatMap((group) => group.links),
    [locale],
  );
  const navigationTargetIdRef = useRef<string | null>(null);
  const [activeHref, setActiveHref] = useState(() => {
    const candidate = `${introductionPath}${window.location.hash}`;
    return navigationLinks.some((link) => link.href === candidate)
      ? candidate
      : introductionPath;
  });

  useEffect(() => {
    let animationFrame = 0;
    const syncActiveHref = () => {
      animationFrame = 0;
      const navigationTargetId = navigationTargetIdRef.current;
      if (navigationTargetId) {
        const target = document.getElementById(navigationTargetId);
        if (target) {
          const scrollMarginTop = Number.parseFloat(
            window.getComputedStyle(target).scrollMarginTop,
          ) || 0;
          const targetScrollY = Math.min(
            Math.max(0, window.scrollY + target.getBoundingClientRect().top - scrollMarginTop),
            Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
          );

          if (Math.abs(window.scrollY - targetScrollY) > 2) return;
        }
        navigationTargetIdRef.current = null;
      }

      const readingLine = Math.min(240, window.innerHeight * 0.28);
      const sections = Array.from(document.querySelectorAll<HTMLElement>(".docs-anchor[id]"));
      let nextHref = introductionPath;

      for (const section of sections) {
        if (section.getBoundingClientRect().top > readingLine) break;
        nextHref = `${introductionPath}#${section.id}`;
      }

      const lastSection = sections[sections.length - 1];
      const reachedPageEnd = Math.ceil(window.scrollY + window.innerHeight)
        >= document.documentElement.scrollHeight - 2;
      if (reachedPageEnd && lastSection) {
        nextHref = `${introductionPath}#${lastSection.id}`;
      }

      setActiveHref((current) => current === nextHref ? current : nextHref);
    };
    const scheduleActiveHrefSync = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(syncActiveHref);
    };
    const cancelNavigationTarget = () => {
      if (!navigationTargetIdRef.current) return;
      navigationTargetIdRef.current = null;
      scheduleActiveHrefSync();
    };
    const cancelNavigationTargetOnKeydown = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]
        .includes(event.key)) {
        cancelNavigationTarget();
      }
    };
    const syncHistoryNavigation = () => {
      navigationTargetIdRef.current = null;
      scheduleActiveHrefSync();
    };

    window.addEventListener("scroll", scheduleActiveHrefSync, { passive: true });
    window.addEventListener("resize", scheduleActiveHrefSync);
    window.addEventListener("wheel", cancelNavigationTarget, { passive: true });
    window.addEventListener("touchstart", cancelNavigationTarget, { passive: true });
    window.addEventListener("keydown", cancelNavigationTargetOnKeydown);
    window.addEventListener("hashchange", syncHistoryNavigation);
    window.addEventListener("popstate", syncHistoryNavigation);
    syncActiveHref();

    return () => {
      window.removeEventListener("scroll", scheduleActiveHrefSync);
      window.removeEventListener("resize", scheduleActiveHrefSync);
      window.removeEventListener("wheel", cancelNavigationTarget);
      window.removeEventListener("touchstart", cancelNavigationTarget);
      window.removeEventListener("keydown", cancelNavigationTargetOnKeydown);
      window.removeEventListener("hashchange", syncHistoryNavigation);
      window.removeEventListener("popstate", syncHistoryNavigation);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, [introductionPath, navigationLinks]);

  const navigateToHref = useCallback((href: string, targetId: string) => {
    navigationTargetIdRef.current = targetId;
    setActiveHref(href);
  }, []);

  return { activeHref, navigateToHref };
}

function DocsNavigation({
  activeHref,
  centerActive = false,
  label,
  locale,
  onNavigate,
}: {
  activeHref: string;
  centerActive?: boolean;
  label: string;
  locale: SiteLocale;
  onNavigate: (href: string, targetId: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!centerActive) return undefined;

    const media = window.matchMedia("(min-width: 64rem)");
    const centerActiveLink = () => {
      const scrollContainer = navRef.current?.closest<HTMLElement>(".docs-sidebar");
      const activeLink = navRef.current?.querySelector<HTMLAnchorElement>(
        'a[aria-current="location"]',
      );
      if (
        !media.matches
        || !scrollContainer
        || !activeLink
        || activeLink.getClientRects().length === 0
      ) return;

      const containerBounds = scrollContainer.getBoundingClientRect();
      const activeBounds = activeLink.getBoundingClientRect();
      const centeredTop = scrollContainer.scrollTop
        + activeBounds.top
        - containerBounds.top
        - (scrollContainer.clientHeight - activeBounds.height) / 2;
      scrollContainer.scrollTo({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        top: Math.max(0, centeredTop),
      });
    };

    centerActiveLink();
    media.addEventListener("change", centerActiveLink);
    return () => media.removeEventListener("change", centerActiveLink);
  }, [activeHref, centerActive]);

  function navigateToSection(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;

    const url = new URL(href, window.location.href);
    const normalizePath = (path: string) => path.replace(/\/+$/u, "");
    if (
      url.origin !== window.location.origin
      || normalizePath(url.pathname) !== normalizePath(window.location.pathname)
    ) return;

    const targetId = url.hash ? decodeURIComponent(url.hash.slice(1)) : "overview";
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    onNavigate(href, targetId);
    if (`${window.location.pathname}${window.location.hash}` !== `${url.pathname}${url.hash}`) {
      window.history.pushState(null, "", `${url.pathname}${url.hash}`);
    }
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <nav className="docs-side-nav" aria-label={label} ref={navRef}>
      {getNavigationGroups(locale).map((group) => (
        <div className="docs-nav-group" key={group.label}>
          <h2>{group.label}</h2>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <a
                  className={link.href === activeHref ? "is-current" : undefined}
                  href={link.href}
                  aria-current={link.href === activeHref ? "location" : undefined}
                  onClick={(event) => navigateToSection(event, link.href)}
                >
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const syntaxPattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|--[\w-]+|@[\w/-]+|\b(?:import|from|export|function|const|let|return|new|type|interface|true|false|null|undefined|async|await|extends|for|of|in|if|else|continue|bun|npm|install|run)\b|\b\d+(?:\.\d+)?\b|\b[A-Z][A-Za-z0-9_]*\b|\b[a-zA-Z_$][\w$]*(?=\s*\())/g;
const syntaxKeywords = new Set([
  "import", "from", "export", "function", "const", "let", "return", "new",
  "type", "interface", "true", "false", "null", "undefined", "async", "await",
  "extends", "for", "of", "in", "if", "else", "continue",
]);

function syntaxClassName(token: string) {
  if (token.startsWith("//") || token.startsWith("/*")) return "token-comment";
  if (/^["'`]/u.test(token)) return "token-string";
  if (token.startsWith("--")) return "token-option";
  if (token.startsWith("@")) return "token-package";
  if (syntaxKeywords.has(token)) return "token-keyword";
  if (token === "bun" || token === "npm" || token === "install" || token === "run") {
    return "token-command";
  }
  if (/^\d/u.test(token)) return "token-number";
  if (/^[A-Z]/u.test(token)) return "token-type";
  return "token-function";
}

function renderHighlightedCode(code: string): ReactNode[] {
  const content: ReactNode[] = [];
  let cursor = 0;

  for (const match of code.matchAll(syntaxPattern)) {
    const start = match.index;
    if (start > cursor) content.push(code.slice(cursor, start));
    content.push(
      <span className={syntaxClassName(match[0])} key={`${start}-${match[0]}`}>
        {match[0]}
      </span>,
    );
    cursor = start + match[0].length;
  }

  if (cursor < code.length) content.push(code.slice(cursor));
  return content;
}

function CodeBlock({
  label,
  language,
  children,
  locale = "ko",
}: {
  label: string;
  language: "sh" | "ts" | "tsx";
  children: string;
  locale?: SiteLocale;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyCode() {
    setCopied(await copyText(children));
  }

  return (
    <div className="docs-code-block">
      <div className="docs-code-head">
        <span>{label}</span>
        <button
          type="button"
          onClick={copyCode}
          aria-label={locale === "ko" ? `${label} 코드 복사` : `Copy code from ${label}`}
        >
          <CopyIcon />
          <span aria-live="polite">{copied ? locale === "ko" ? "복사됨" : "Copied" : locale === "ko" ? "복사" : "Copy"}</span>
        </button>
      </div>
      <pre><code className={`language-${language}`}>{renderHighlightedCode(children)}</code></pre>
    </div>
  );
}

function DocsTable({ children }: { children: ReactNode }) {
  return <div className="docs-table-wrap">{children}</div>;
}

function DocsSection({
  children,
  id,
  index,
  locale = "ko",
  title,
}: {
  children: ReactNode;
  id: string;
  index: string;
  locale?: SiteLocale;
  title: ReactNode;
}) {
  const heading = <h2 id={`${id}-title`}>{title}</h2>;
  const isPlainTitle = typeof title === "string";

  return (
    <section className="docs-section docs-anchor" id={id} aria-labelledby={`${id}-title`}>
      <p className="docs-section-index">{index}</p>
      {isPlainTitle ? (
        locale === "ko" ? <KoreanSemanticWrap>{heading}</KoreanSemanticWrap> : (
          <LocalizedSemanticWrap locale={locale}>{heading}</LocalizedSemanticWrap>
        )
      ) : heading}
      {children}
    </section>
  );
}

function DocsSubheading({ children, locale = "ko" }: { children: string; locale?: SiteLocale }) {
  if (locale === "en") {
    return <LocalizedSemanticWrap locale="en"><h3>{children}</h3></LocalizedSemanticWrap>;
  }
  return (
    <KoreanSemanticWrap>
      <h3>{children}</h3>
    </KoreanSemanticWrap>
  );
}

function IntroductionArticle() {
  const introductionPath = docsPath("ko");
  return (
    <article className="docs-article">
      <div className="docs-article-tools">
        <p><a href={introductionPath}>문서</a><span>/</span>소개</p>
        <a href={`${repositoryUrl}/blob/main/README-ko_kr.md`} target="_blank" rel="noreferrer">
          GitHub에서 원문 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <header className="docs-article-header" id="overview">
        <p className="docs-kicker">Introduction</p>
        <h1><span>semantic-wrap</span>이란?</h1>
        <p className="docs-lead">
          학습된 모델과 실제 렌더링 결과를 바탕으로 줄바꿈 위치를 선택하는 JavaScript
          라이브러리입니다. 더 적합한 결과가 있을 때만 해당 위치에 <code>&lt;br&gt;</code>을 삽입합니다.
        </p>
        <p className="docs-overview-copy">
          사용하는 모델과 선택 방식에 따라 줄바꿈 기준을 바꿀 수 있습니다. 한국어 문장을
          읽을 때 자연스럽다고 느끼는 줄바꿈을 브라우저에서도 재현할 수 없을까 하는 고민에서
          출발했습니다. Core는 언어에 종속되지 않으며 영어와 한국어 제목용 프리셋을 제공합니다.
        </p>
        <div className="docs-version-line"><span>ESM only</span><span>React 19+</span><span>Node.js 22+</span></div>
      </header>

      <DocsSection id="examples" index="01" title="결과 예시">
        <p>브라우저가 폭만 보고 나눈 결과와 모델이 의미 경계를 고려한 결과를 나란히 비교합니다.</p>
        <DocsTable><table>
          <caption>브라우저와 semantic-wrap 결과 예시</caption>
          <thead><tr><th>브라우저 기본 줄바꿈</th><th>semantic-wrap</th></tr></thead>
          <tbody>
            <tr><td>디자인 시스템을 도입하기<br />전에 반드시 확인해야 할 기준</td><td>디자인 시스템을 도입하기 전에<br />반드시 확인해야 할 기준</td></tr>
            <tr><td>모바일 환경에서 읽기<br />좋은 제목을 만드는 방법</td><td>모바일 환경에서<br />읽기 좋은 제목을 만드는 방법</td></tr>
            <tr><td>효율적인 회의를 만들기<br />위해 버려야 할 습관</td><td>효율적인 회의를 만들기 위해<br />버려야 할 습관</td></tr>
            <tr><td>사용자를 이해하고, 더<br />나은 해결책을 만드는 방법</td><td>사용자를 이해하고,<br />더 나은 해결책을 만드는 방법</td></tr>
          </tbody>
        </table></DocsTable>
        <aside className="docs-note"><strong>대상</strong><p>짧은 디스플레이 제목과 헤딩에 맞춰져 있으며 본문 전체를 자동 조판하는 도구는 아닙니다.</p></aside>
      </DocsSection>

      <DocsSection id="quick-start" index="02" title="빠르게 시작하기">
        <DocsSubheading>설치</DocsSubheading>
        <p>React에서 한국어 모델을 사용하려면 Core, React 연결 패키지, 한국어 프리셋을 함께 설치합니다.</p>
        <CodeBlock label="Terminal" language="sh">{installCode}</CodeBlock>
        <p><code>@semantic-wrap/react</code>는 React와 React DOM 19 이상을 지원합니다. Core나 모델만 사용하는 환경에는 React가 필요하지 않으며 세 패키지는 모두 ESM 전용입니다.</p>
        <DocsSubheading>React에서 사용하기</DocsSubheading>
        <CodeBlock label="Title.tsx" language="tsx">{reactCode}</CodeBlock>
        <p><code>SemanticWrap</code>은 별도 엘리먼트를 추가하지 않습니다. 기본 precise 모드는 SSR 원문을 HTML에 유지하되 최초의 정확한 선택이 준비될 때까지 opacity를 0으로 둔 뒤 결과를 표시합니다. progressive 모드는 SSR 원문을 변경하지 않고 첫 viewport 또는 element resize부터 precise 선택을 시작합니다.</p>
      </DocsSection>

      <DocsSection id="how-it-works" index="03" title="동작 방식">
        <ol className="docs-pipeline">
          <li><span>01</span><div><strong>예측과 통합</strong><p>모델의 예측을 줄바꿈 경계 후보로 통합합니다.</p></div></li>
          <li><span>02</span><div><strong>후보 계산</strong><p>실제 글꼴과 너비를 기준으로 가능한 layout 후보들을 계산합니다.</p></div></li>
          <li><span>03</span><div><strong>브라우저 검증</strong><p>정상적인 브라우저 layout을 바꾸려면 모델 비용이 더 낮아야 합니다.</p></div></li>
          <li><span>04</span><div><strong>선택과 적용</strong><p>시각적 균형까지 비교해 선택된 위치에만 <code>&lt;br&gt;</code>을 삽입합니다.</p></div></li>
        </ol>
        <p>엘리먼트 크기가 바뀌거나 웹 폰트 로딩이 끝나면 다시 측정하므로 반응형 레이아웃에서도 같은 기준을 유지합니다.</p>
      </DocsSection>

      <DocsSection id="packages" index="04" title="패키지 구성">
        <DocsTable><table>
          <caption>semantic-wrap 패키지와 역할</caption>
          <thead><tr><th>패키지</th><th>역할</th></tr></thead>
          <tbody>
            <tr><td><code>@semantic-wrap/core</code></td><td>줄바꿈 후보를 만들고 그중 하나를 선택합니다.</td></tr>
            <tr><td><code>@semantic-wrap/react</code></td><td>화면을 측정하고 선택된 줄바꿈을 React에 적용합니다.</td></tr>
            <tr><td><code>@semantic-wrap/en</code></td><td>영어 제목을 위해 학습된 실험적 모델을 제공합니다.</td></tr>
            <tr><td><code>@semantic-wrap/ko</code></td><td>한국어 제목을 위해 학습된 모델을 제공합니다.</td></tr>
          </tbody>
        </table></DocsTable>
      </DocsSection>

      <DocsSection id="core-api" index="Core 01" title={<code>selectLineBreaks</code>}>
        <p><code>@semantic-wrap/core</code>는 모델 예측부터 최종 layout 선택까지 한 번에 실행합니다. DOM이나 React에 의존하지 않으므로 문자열 너비를 측정할 수 있는 환경이라면 어디서든 사용할 수 있습니다.</p>
        <CodeBlock label="line-breaks.ts" language="ts">{coreCode}</CodeBlock>
        <DocsSubheading>입력</DocsSubheading>
        <DocsTable><table>
          <caption>selectLineBreaks input</caption>
          <thead><tr><th>필드</th><th>타입</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td><code>string</code></td><td>줄바꿈을 적용할 원문</td></tr>
            <tr><td><code>model</code></td><td><code>PhraseModel</code></td><td>경계와 우선순위를 예측할 모델</td></tr>
            <tr><td><code>maxWidth</code></td><td><code>number</code></td><td>한 줄에 사용할 수 있는 최대 너비</td></tr>
            <tr><td><code>measureText</code></td><td><code>(text: string) =&gt; number</code></td><td>실제 글꼴로 측정한 문자열 너비를 반환하는 함수</td></tr>
          </tbody>
        </table></DocsTable>
        <p>Core는 특정 렌더링 환경에 의존하지 않으므로 <code>measureText</code>를 직접 받습니다. 브라우저에서는 Canvas로 만들 수 있고 React 패키지는 렌더링된 엘리먼트에서 자동으로 만듭니다.</p>
        <DocsSubheading>옵션</DocsSubheading>
        <DocsTable><table>
          <caption>selectLineBreaks options</caption>
          <thead><tr><th>필드</th><th>필수</th><th>기본값</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>nativeLayout</code></td><td>아니요</td><td>없음</td><td>비교할 기존 줄바꿈. 마지막 줄을 제외한 UTF-16 offset을 오름차순으로 전달</td></tr>
            <tr><td><code>strategy</code></td><td>아니요</td><td>기본 strategy</td><td>후보 통합, 계산, 최종 선택 규칙</td></tr>
            <tr><td><code>diagnostics</code></td><td>아니요</td><td><code>false</code></td><td>단계별 중간 결과 포함 여부</td></tr>
          </tbody>
        </table></DocsTable>
        <p><code>nativeLayout</code>을 전달하면 계산된 후보와 함께 평가하며 생략하면 계산된 후보 안에서만 선택합니다. React API는 브라우저가 실제로 나눈 줄을 자동으로 전달합니다. 기본 selector는 native가 overflow일 때 너비 안에 들어오는 계산 결과를 허용하고, 그 외에는 줄 수가 같고 <code>modelCost</code>가 더 낮은 후보만 native를 대체할 수 있습니다.</p>
        <h3>출력: <code>LineBreakSelection</code></h3>
        <DocsTable><table>
          <caption>LineBreakSelection 출력</caption>
          <thead><tr><th>필드</th><th>타입</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td><code>string</code></td><td>입력받은 원문</td></tr>
            <tr><td><code>lines</code></td><td><code>string[]</code></td><td>선택된 위치를 기준으로 나눈 문자열 배열</td></tr>
            <tr><td><code>breaks</code></td><td><code>number[]</code></td><td>마지막 줄을 제외한 각 줄 끝의 UTF-16 offset</td></tr>
            <tr><td><code>widths</code></td><td><code>number[]</code></td><td>각 줄을 측정한 너비</td></tr>
            <tr><td><code>selectedCandidates</code></td><td><code>BreakCandidate[]</code></td><td>선택된 offset의 후보와 모델 정보</td></tr>
            <tr><td><code>applied</code></td><td><code>boolean</code></td><td>계산된 줄바꿈을 적용해야 하는지 여부</td></tr>
            <tr><td><code>reason</code></td><td><code>string</code></td><td>최종 layout을 선택한 이유</td></tr>
            <tr><td><code>overflow</code></td><td><code>boolean</code></td><td>선택된 줄이 maxWidth를 넘는지 여부</td></tr>
            <tr><td><code>diagnostics</code></td><td><code>LineBreakDiagnostics</code></td><td>diagnostics를 요청했을 때의 중간 결과</td></tr>
          </tbody>
        </table></DocsTable>
      </DocsSection>

      <DocsSection id="line-break-plan" index="Core 02" title={<code>createLineBreakPlan</code>}>
        <p>같은 원문, 모델, strategy를 여러 너비에서 반복 측정한다면 lazy plan을 사용합니다.</p>
        <CodeBlock label="line-break-plan.ts" language="ts">{planCode}</CodeBlock>
        <p>뒤 단계를 호출하면 필요한 앞 단계를 자동 실행합니다. 예측과 집계는 immutable snapshot으로 캐시하고 계산과 선택은 measurement마다 실행합니다.</p>
      </DocsSection>

      <DocsSection id="custom-models" index="Core 03" title="커스텀 모델">
        <p><code>PhraseModel</code> 인터페이스를 만족하는 모델이라면 어떤 모델이든 사용할 수 있습니다. 별도로 학습한 모델이나 여러 단계의 모델 예측을 함께 사용할 수 있습니다.</p>
        <DocsTable><table>
          <caption>PhraseModel 필드</caption>
          <thead><tr><th>필드</th><th>필수</th><th>기본값</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>levels</code></td><td>예</td><td>—</td><td>모델과 penalty를 담은 하나 이상의 단계</td></tr>
            <tr><td><code>fallbackPenalty</code></td><td>예</td><td>—</td><td>어떤 단계도 찾지 않은 일반 경계의 비용</td></tr>
            <tr><td><code>boundaryMode</code></td><td>아니요</td><td><code>spaces</code></td><td>공백 또는 Unicode grapheme 경계를 사용하며 인접 공백은 하나로 통합</td></tr>
          </tbody>
        </table></DocsTable>
        <p>각 level의 <code>penalty</code>는 해당 모델이 예측한 경계의 비용입니다. 낮을수록 우선하며 여러 level이 같은 경계를 예측하면 기본 aggregate 단계는 가장 낮은 값을 사용합니다.</p>
        <CodeBlock label="colon-model.ts" language="ts">{modelCode}</CodeBlock>
        <p><code>UW3</code>는 후보 바로 앞 한 글자를 나타내는 BudouX feature입니다. 예시의 100은 확률이 아니라 경계를 판정할 때 사용하는 가중치입니다. 실제 서비스에서는 충분한 데이터로 학습하고 검증한 모델을 사용하세요.</p>
      </DocsSection>

      <DocsSection id="strategies" index="Core 04" title="Strategy">
        <p>기본 strategy는 세 단계를 순서대로 실행하며 바꾸고 싶은 단계만 교체할 수 있습니다.</p>
        <DocsTable><table>
          <caption>Strategy 단계</caption>
          <thead><tr><th>단계</th><th>입력</th><th>기본 규칙</th><th>개입할 수 있는 부분</th></tr></thead>
          <tbody>
            <tr><td><code>aggregate</code></td><td>모델별 원본 예측</td><td>같은 경계의 가장 낮은 penalty</td><td>모델 합의 조건과 제품별 가중치</td></tr>
            <tr><td><code>calculate</code></td><td>후보와 렌더링 너비</td><td>최소 줄 수의 비지배 layout 후보</td><td>줄 수 제한, 금지 경계, 탐욕적 계산</td></tr>
            <tr><td><code>select</code></td><td>계산 후보와 nativeLayout</td><td>모델 비용과 시각적 균형 비교</td><td>제품별 점수와 적용 조건</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="strategy.ts" language="ts">{strategyCode}</CodeBlock>
        <p><code>lowestPenalty()</code>는 각 경계에서 가장 낮은 비용을 사용합니다. <code>optimalLayouts()</code>는 최소 줄 수에서 균형 점수와 모델 비용이 서로 지배하지 않는 후보들을 반환하고, <code>greedy()</code>는 현재 줄에 들어가는 후보 중 비용이 가장 낮은 경계를 차례로 선택합니다.</p>
        <p><code>balance()</code>는 overflow가 없고 줄 수가 같으며 modelCost가 native보다 낮은 후보만 변경 대상으로 인정합니다. tolerance 기본값은 0.12이며 값이 클수록 최상의 균형에서 더 먼 layout도 허용합니다. native가 overflow라면 모델 비용과 관계없이 fitting calculated layout을 선택할 수 있습니다. nativeLayout이 없으면 계산 후보 안에서 선택합니다.</p>
        <DocsSubheading>계산 단계 교체하기</DocsSubheading>
        <p>다음 예시는 제목을 두 줄로 나누되 마지막 줄에 한 어절만 남는 후보를 제외합니다.</p>
        <CodeBlock label="two-line-title.ts" language="ts">{customStrategyCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="diagnostics" index="Core 05" title="Diagnostics">
        <p>후보 통합 규칙을 조정하거나 결과를 분석할 때 <code>diagnostics: true</code>를 사용합니다.</p>
        <CodeBlock label="diagnostics.ts" language="ts">{diagnosticsCode}</CodeBlock>
        <DocsTable><table>
          <caption>Diagnostics 필드</caption>
          <thead><tr><th>필드</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>predictions</code></td><td>각 model level이 예측한 원본 경계. 같은 offset이 여러 번 나타날 수 있음</td></tr>
            <tr><td><code>candidates</code></td><td>aggregate 단계가 통합한 최종 후보 목록</td></tr>
            <tr><td><code>calculatedLayouts</code></td><td>lineCount, balanceScore, modelCost, overflow를 포함한 layout 후보</td></tr>
            <tr><td><code>nativeLayout</code></td><td>전달된 기존 줄바꿈을 측정한 layout</td></tr>
            <tr><td><code>selection</code></td><td>select 단계가 반환한 출처, 인덱스, 이유</td></tr>
          </tbody>
        </table></DocsTable>
        <p>기본 <code>balance()</code>는 모델 비용이 개선되지 않아 native를 유지할 때 <code>native-no-model-improvement</code>를 반환합니다. 다른 기본 reason은 <code>native-selected</code>와 <code>calculated-selected</code>이며 custom selector는 별도 reason을 반환할 수 있습니다.</p>
      </DocsSection>

      <DocsSection id="semantic-wrap" index="React 01" title={<code>&lt;SemanticWrap /&gt;</code>}>
        <p>React 패키지는 렌더링된 글꼴과 너비를 측정하고 Core가 선택한 줄바꿈을 적용합니다. 대부분은 plain-text 엘리먼트에 결과를 바로 적용하는 이 컴포넌트로 시작하면 됩니다.</p>
        <DocsTable><table>
          <caption>SemanticWrap props</caption>
          <thead><tr><th>Prop</th><th>필수</th><th>기본값</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>children</code></td><td>예</td><td>—</td><td>ref를 실제 HTMLElement로 전달하는 하나의 plain-text React 엘리먼트</td></tr>
            <tr><td><code>model</code></td><td>예</td><td>—</td><td>줄바꿈 후보를 만드는 모델</td></tr>
            <tr><td><code>strategy</code></td><td>아니요</td><td>기본 strategy</td><td>후보 통합, 계산, 선택 규칙</td></tr>
            <tr><td><code>mode</code></td><td>아니요</td><td><code>precise</code></td><td>precise 또는 progressive 측정 모드</td></tr>
            <tr><td><code>ref</code></td><td>아니요</td><td>—</td><td>자식과 함께 사용할 HTMLElement ref</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="progressive.tsx" language="tsx">{progressiveCode}</CodeBlock>
        <p>두 모드 모두 보이지 않는 DOM copy에서 측정하고 ResizeObserver 안에서 최종 결과만 동기적으로 반영합니다. 측정을 위해 visible element를 비우거나 원문으로 되돌리지 않습니다.</p>
        <aside className="docs-note is-caution"><strong>Plain text만 지원합니다</strong><p>서로 다른 글꼴이나 markup이 필요하다면 <code>useSemanticWrap</code> 또는 Core API를 사용하세요.</p></aside>
      </DocsSection>

      <DocsSection id="chakra-ui" index="React 02" title="Chakra UI">
        <p>Chakra UI처럼 실제 HTMLElement로 ref를 전달하는 컴포넌트도 같은 방식으로 사용할 수 있습니다.</p>
        <CodeBlock label="ChakraTitle.tsx" language="tsx">{chakraCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="tailwind-css" index="React 03" title="Tailwind CSS">
        <p>Tailwind CSS로 스타일을 적용한 plain-text 엘리먼트의 className도 그대로 유지됩니다.</p>
        <CodeBlock label="TailwindTitle.tsx" language="tsx">{tailwindCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="use-semantic-wrap" index="React 04" title={<code>useSemanticWrap</code>}>
        <p>선택된 줄을 직접 렌더링하거나 diagnostics를 확인할 때 사용하는 저수준 Hook입니다. 측정에는 대상 엘리먼트의 계산된 텍스트 스타일을 사용합니다. 내부 markup이 서로 다른 타이포그래피를 쓴다면 그 스타일을 반영한 measureText와 Core를 사용하세요.</p>
        <DocsTable><table>
          <caption>useSemanticWrap 옵션</caption>
          <thead><tr><th>옵션</th><th>필수</th><th>기본값</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td>예</td><td>—</td><td>측정하고 나눌 원문</td></tr>
            <tr><td><code>model</code></td><td>예</td><td>—</td><td>줄바꿈 후보를 만드는 모델</td></tr>
            <tr><td><code>strategy</code></td><td>아니요</td><td>기본 strategy</td><td>후보 통합, 계산, 선택 규칙</td></tr>
            <tr><td><code>diagnostics</code></td><td>아니요</td><td><code>false</code></td><td>단계별 중간 결과 포함 여부</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="BreakPreview.tsx" language="tsx">{hookCode}</CodeBlock>
        <h3>출력: <code>UseSemanticWrapResult</code></h3>
        <DocsTable><table>
          <caption>useSemanticWrap 반환값</caption>
          <thead><tr><th>필드</th><th>타입</th><th>설명</th></tr></thead>
          <tbody>
            <tr><td><code>ref</code></td><td><code>(HTMLElement | null) =&gt; void</code></td><td>측정할 엘리먼트에 연결하는 callback ref</td></tr>
            <tr><td><code>selection</code></td><td><code>LineBreakSelection | null</code></td><td>측정 전 null, 이후 선택 결과</td></tr>
            <tr><td><code>diagnostics</code></td><td><code>LineBreakDiagnostics | null</code></td><td>진단을 요청하고 측정한 경우의 결과</td></tr>
          </tbody>
        </table></DocsTable>
        <p>Hook은 markup이나 CSS를 직접 바꾸지 않습니다. 기존 CSS는 비교 대상인 브라우저 줄바꿈에 반영되고 모델 결과가 선택되면 <code>&lt;br&gt;</code>로 적용됩니다.</p>
      </DocsSection>

      <DocsSection id="models" index="Models" title="한국어와 영어 프리셋">
        <p>한국어 제목에는 <code>koTitleModel</code>, 영어 제목에는 <code>enTitleModel</code>을 사용합니다. 두 모델 모두 공백 경계만 사용하므로 어절 내부에 임의의 후보를 만들지 않습니다.</p>
        <CodeBlock label="models.ts" language="ts">{modelImportCode}</CodeBlock>
        <aside className="docs-note is-caution"><strong>실험적 프리셋</strong><p>두 모델은 소규모 제목 데이터셋으로 학습한 출발점입니다. 프로덕션 적용 전 실제 글꼴, 너비, 콘텐츠를 대표하는 대규모 데이터셋으로 학습하고 검증하세요. 자세한 내용은 GitHub의 <a href={`${repositoryUrl}/blob/main/packages/ko/MODEL_CARD.md`}>한국어 Model Card</a>와{" "}<a href={`${repositoryUrl}/blob/main/packages/en/MODEL_CARD.md`}>영어 Model Card</a>를 참고하세요.</p></aside>
      </DocsSection>

      <DocsSection id="development" index="Project 01" title="개발">
        <CodeBlock label="Terminal" language="sh">{developmentCode}</CodeBlock>
        <p><code>bun run check</code>는 타입 검사, 단위 테스트, 빌드, Chromium·Firefox·WebKit 브라우저 테스트와 npm 패키지 구성을 차례로 확인합니다.</p>
      </DocsSection>

      <DocsSection id="license" index="Project 02" title="라이선스">
        <p>Apache-2.0. <code>@semantic-wrap/core</code>에는 Google의 BudouX Parser를 수정한 dependency-free model inference가 포함되어 있습니다. 자세한 내용은{" "}<a href={`${repositoryUrl}/blob/main/NOTICE`}>NOTICE</a>를 참고하세요.</p>
      </DocsSection>
    </article>
  );
}

function EnglishIntroductionArticle() {
  const introductionPath = docsPath("en");
  return (
    <article className="docs-article">
      <div className="docs-article-tools">
        <p><a href={introductionPath}>Docs</a><span>/</span>Introduction</p>
        <a href={`${repositoryUrl}/blob/main/README.md`} target="_blank" rel="noreferrer">
          View source on GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>

      <header className="docs-article-header" id="overview">
        <p className="docs-kicker">Introduction</p>
        <h1>What is <span>semantic-wrap</span>?</h1>
        <p className="docs-lead">
          A language-independent JavaScript library that selects line breaks from a trained
          model and the actual rendered layout. It inserts <code>&lt;br&gt;</code> only when the
          calculated result is better.
        </p>
        <p className="docs-overview-copy">
          Both the phrase model and the selection strategy are replaceable. Experimental
          presets are available for English and Korean titles, while Core remains independent
          of any language, rendering environment, or UI framework.
        </p>
        <div className="docs-version-line"><span>ESM only</span><span>React 19+</span><span>Node.js 22+</span></div>
      </header>

      <DocsSection id="examples" index="01" locale="en" title="Examples">
        <p>Compare native wrapping based on width alone with results that preserve model-predicted phrase boundaries.</p>
        <DocsTable><table>
          <caption>Browser-native and semantic-wrap results</caption>
          <thead><tr><th>Browser native wrapping</th><th>semantic-wrap</th></tr></thead>
          <tbody>
            <tr><td>Solve the right problem before<br />building a solution</td><td>Solve the right problem<br />before building a solution</td></tr>
            <tr><td>Before adding another feature,<br />understand the behavior it should change</td><td>Before adding another feature,<br />understand the behavior<br />it should change</td></tr>
            <tr><td>The best design systems create consistency<br />without blocking local needs</td><td>The best design systems<br />create consistency without blocking local needs</td></tr>
            <tr><td>Ship the smallest change that<br />solves the whole problem</td><td>Ship the smallest change<br />that solves the whole problem</td></tr>
          </tbody>
        </table></DocsTable>
        <aside className="docs-note"><strong>Scope</strong><p>semantic-wrap is tuned for short display titles and headings, not automatic typesetting of long body copy.</p></aside>
      </DocsSection>

      <DocsSection id="quick-start" index="02" locale="en" title="Quick start">
        <DocsSubheading locale="en">Install</DocsSubheading>
        <p>Install Core, the React adapter, and the English preset to use semantic-wrap in React.</p>
        <CodeBlock label="Terminal" language="sh" locale="en">{englishInstallCode}</CodeBlock>
        <p><code>@semantic-wrap/react</code> requires React and React DOM 19 or later. Core-only and model-only projects do not need React. All packages are ESM-only.</p>
        <DocsSubheading locale="en">Use it in React</DocsSubheading>
        <CodeBlock label="Title.tsx" language="tsx" locale="en">{englishReactCode}</CodeBlock>
        <p><code>SemanticWrap</code> preserves its child element and adds no wrapper. Precise mode keeps SSR text in HTML and reveals the exact first selection when ready. Progressive mode leaves the initial SSR text untouched and starts precise selection on the first viewport or element resize.</p>
      </DocsSection>

      <DocsSection id="how-it-works" index="03" locale="en" title="How it works">
        <ol className="docs-pipeline">
          <li><span>01</span><div><strong>Predict and aggregate</strong><p>A phrase model predicts candidate boundaries and assigns a cost to each one.</p></div></li>
          <li><span>02</span><div><strong>Calculate layouts</strong><p>Core measures multiple candidates with the actual font and available width.</p></div></li>
          <li><span>03</span><div><strong>Verify in the browser</strong><p>A fitting native layout is replaced only when the model provides stronger evidence.</p></div></li>
          <li><span>04</span><div><strong>Select and render</strong><p>Visual balance chooses the final result; React renders <code>&lt;br&gt;</code> only when a calculated layout wins.</p></div></li>
        </ol>
        <p>The React package measures again when the element resizes, its class or inline style changes, or web fonts finish loading.</p>
      </DocsSection>

      <DocsSection id="packages" index="04" locale="en" title="Packages">
        <DocsTable><table>
          <caption>semantic-wrap packages and responsibilities</caption>
          <thead><tr><th>Package</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>@semantic-wrap/core</code></td><td>Boundary prediction, candidate aggregation, layout calculation, and selection</td></tr>
            <tr><td><code>@semantic-wrap/react</code></td><td>DOM measurement and <code>&lt;br&gt;</code> rendering for React</td></tr>
            <tr><td><code>@semantic-wrap/en</code></td><td>Experimental phrase model for English titles</td></tr>
            <tr><td><code>@semantic-wrap/ko</code></td><td>Experimental phrase model for Korean titles</td></tr>
          </tbody>
        </table></DocsTable>
      </DocsSection>

      <DocsSection id="core-api" index="Core 01" locale="en" title={<code>selectLineBreaks</code>}>
        <p><code>selectLineBreaks</code> runs the complete prediction-to-selection pipeline without depending on React or the DOM.</p>
        <CodeBlock label="line-breaks.ts" language="ts" locale="en">{englishCoreCode}</CodeBlock>
        <DocsSubheading locale="en">Required input</DocsSubheading>
        <DocsTable><table>
          <caption>selectLineBreaks input</caption>
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td><code>string</code></td><td>Source text to wrap</td></tr>
            <tr><td><code>model</code></td><td><code>PhraseModel</code></td><td>Model that predicts boundaries and priorities</td></tr>
            <tr><td><code>maxWidth</code></td><td><code>number</code></td><td>Maximum width available to one line</td></tr>
            <tr><td><code>measureText</code></td><td><code>(text: string) =&gt; number</code></td><td>Measures a string with the target font</td></tr>
          </tbody>
        </table></DocsTable>
        <DocsSubheading locale="en">Options</DocsSubheading>
        <DocsTable><table>
          <caption>selectLineBreaks options</caption>
          <thead><tr><th>Field</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>nativeLayout</code></td><td><code>BaselineLayout</code></td><td>none</td><td>Existing line breaks as ascending UTF-16 offsets</td></tr>
            <tr><td><code>strategy</code></td><td><code>LineBreakStrategy</code></td><td>default strategy</td><td>Overrides aggregation, calculation, or selection</td></tr>
            <tr><td><code>diagnostics</code></td><td><code>boolean</code></td><td><code>false</code></td><td>Includes intermediate pipeline results</td></tr>
          </tbody>
        </table></DocsTable>
        <p>When <code>nativeLayout</code> is present, Core evaluates it with the calculated candidates. The default selector may replace an overflowing native layout with any fitting result. Otherwise, replacement requires the same line count and a lower <code>modelCost</code>.</p>
        <h3>Output: <code>LineBreakSelection</code></h3>
        <DocsTable><table>
          <caption>LineBreakSelection output</caption>
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td><code>string</code></td><td>Original input text</td></tr>
            <tr><td><code>lines</code></td><td><code>string[]</code></td><td>Text split at selected boundaries</td></tr>
            <tr><td><code>breaks</code></td><td><code>number[]</code></td><td>Ascending UTF-16 offsets for line ends</td></tr>
            <tr><td><code>widths</code></td><td><code>number[]</code></td><td>Measured width of each line</td></tr>
            <tr><td><code>selectedCandidates</code></td><td><code>BreakCandidate[]</code></td><td>Model candidates used by the selected layout</td></tr>
            <tr><td><code>applied</code></td><td><code>boolean</code></td><td>Whether calculated breaks should render</td></tr>
            <tr><td><code>reason</code></td><td><code>string</code></td><td>Reason returned by selection</td></tr>
            <tr><td><code>overflow</code></td><td><code>boolean</code></td><td>Whether a selected line exceeds maxWidth</td></tr>
            <tr><td><code>diagnostics</code></td><td><code>LineBreakDiagnostics</code></td><td>Present only when diagnostics are enabled</td></tr>
          </tbody>
        </table></DocsTable>
      </DocsSection>

      <DocsSection id="line-break-plan" index="Core 02" locale="en" title={<code>createLineBreakPlan</code>}>
        <p>Create a lazy plan when the same text, model, and strategy will be measured at multiple widths.</p>
        <CodeBlock label="line-break-plan.ts" language="ts" locale="en">{planCode}</CodeBlock>
        <p>Calling a later stage runs its prerequisites. Prediction and aggregation are cached as immutable snapshots; calculation and selection run for every measurement.</p>
      </DocsSection>

      <DocsSection id="custom-models" index="Core 03" locale="en" title="Custom phrase models">
        <p>Any model that implements <code>PhraseModel</code> can replace the preset. Multiple model levels can also be aggregated together.</p>
        <DocsTable><table>
          <caption>PhraseModel fields</caption>
          <thead><tr><th>Field</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>levels</code></td><td>yes</td><td>—</td><td>One or more models and their relative penalties</td></tr>
            <tr><td><code>fallbackPenalty</code></td><td>yes</td><td>—</td><td>Cost of an allowed boundary not predicted by a level</td></tr>
            <tr><td><code>boundaryMode</code></td><td>no</td><td><code>spaces</code></td><td>Whitespace or Unicode grapheme boundaries</td></tr>
          </tbody>
        </table></DocsTable>
        <p>Lower penalties are preferred. When multiple levels predict the same boundary, the default aggregation stage keeps the lowest penalty.</p>
        <CodeBlock label="colon-model.ts" language="ts" locale="en">{englishModelCode}</CodeBlock>
        <p><code>UW3</code> is the BudouX feature for the character immediately before a boundary. The value <code>100</code> is a feature weight, not a probability.</p>
      </DocsSection>

      <DocsSection id="strategies" index="Core 04" locale="en" title="Strategies">
        <p>The default strategy has three independently replaceable stages.</p>
        <DocsTable><table>
          <caption>Strategy stages</caption>
          <thead><tr><th>Stage</th><th>Default</th><th>Customization examples</th></tr></thead>
          <tbody>
            <tr><td><code>aggregate</code></td><td><code>lowestPenalty()</code></td><td>Require model agreement with <code>consensus()</code></td></tr>
            <tr><td><code>calculate</code></td><td><code>optimalLayouts()</code></td><td>Use <code>greedy()</code> or custom line-count rules</td></tr>
            <tr><td><code>select</code></td><td><code>balance()</code></td><td>Apply product-specific scores and replacement rules</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="strategy.ts" language="ts" locale="en">{strategyCode}</CodeBlock>
        <p><code>optimalLayouts()</code> returns non-dominated, minimum-line candidates across visual balance and model cost. <code>balance()</code> uses a default tolerance of <code>0.12</code>, requires lower model cost before replacing a fitting native layout, and allows any fitting candidate when native overflows.</p>
        <DocsSubheading locale="en">Replace the calculation stage</DocsSubheading>
        <p>This example still creates a two-line title but rejects candidates that leave one word on the last line.</p>
        <CodeBlock label="two-line-title.ts" language="ts" locale="en">{englishCustomStrategyCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="diagnostics" index="Core 05" locale="en" title="Diagnostics">
        <p>Enable diagnostics when tuning aggregation rules or investigating a result.</p>
        <CodeBlock label="diagnostics.ts" language="ts" locale="en">{englishDiagnosticsCode}</CodeBlock>
        <DocsTable><table>
          <caption>Diagnostics fields</caption>
          <thead><tr><th>Field</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>predictions</code></td><td>Raw boundaries predicted by each model level</td></tr>
            <tr><td><code>candidates</code></td><td>One candidate list produced by aggregate</td></tr>
            <tr><td><code>calculatedLayouts</code></td><td>Measured candidates with line count, balance, model cost, and overflow</td></tr>
            <tr><td><code>nativeLayout</code></td><td>Measured browser layout when supplied</td></tr>
            <tr><td><code>selection</code></td><td>Source, index, and reason returned by select</td></tr>
          </tbody>
        </table></DocsTable>
        <p>The default selector returns <code>native-no-model-improvement</code> when no calculated layout lowers model cost. Other defaults are <code>native-selected</code> and <code>calculated-selected</code>.</p>
      </DocsSection>

      <DocsSection id="semantic-wrap" index="React 01" locale="en" title={<code>&lt;SemanticWrap /&gt;</code>}>
        <p>Wrap one plain-text React element that forwards its ref to an actual <code>HTMLElement</code>. The component measures the rendered font and width, then applies the Core selection without adding another element.</p>
        <DocsTable><table>
          <caption>SemanticWrap props</caption>
          <thead><tr><th>Prop</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>children</code></td><td>yes</td><td>—</td><td>One plain-text React element</td></tr>
            <tr><td><code>model</code></td><td>yes</td><td>—</td><td>Phrase model used to create candidates</td></tr>
            <tr><td><code>strategy</code></td><td>no</td><td>default strategy</td><td>Aggregation, calculation, and selection rules</td></tr>
            <tr><td><code>mode</code></td><td>no</td><td><code>precise</code></td><td><code>precise</code> or <code>progressive</code> measurement</td></tr>
            <tr><td><code>ref</code></td><td>no</td><td>—</td><td>HTMLElement ref shared with the child</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="progressive.tsx" language="tsx" locale="en">{englishProgressiveCode}</CodeBlock>
        <p>Both modes measure in an invisible DOM copy and synchronously commit the final result from the resize observer. The visible element is never cleared or reset to raw text for measurement.</p>
        <aside className="docs-note is-caution"><strong>Plain text only</strong><p>For nested markup with different typography, use <code>useSemanticWrap</code> or Core with a matching <code>measureText</code> implementation.</p></aside>
      </DocsSection>

      <DocsSection id="chakra-ui" index="React 02" locale="en" title="Chakra UI">
        <p>Components that forward their ref to a real HTMLElement work in the same way.</p>
        <CodeBlock label="ChakraTitle.tsx" language="tsx" locale="en">{englishChakraCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="tailwind-css" index="React 03" locale="en" title="Tailwind CSS">
        <p>Classes on a plain-text element remain unchanged.</p>
        <CodeBlock label="TailwindTitle.tsx" language="tsx" locale="en">{englishTailwindCode}</CodeBlock>
      </DocsSection>

      <DocsSection id="use-semantic-wrap" index="React 04" locale="en" title={<code>useSemanticWrap</code>}>
        <p>Use the lower-level hook to render selected lines yourself or inspect diagnostics. It measures with the target element&apos;s computed text style and does not alter the target&apos;s children or CSS.</p>
        <DocsTable><table>
          <caption>useSemanticWrap options</caption>
          <thead><tr><th>Field</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>text</code></td><td>yes</td><td>—</td><td>Source text to measure and split</td></tr>
            <tr><td><code>model</code></td><td>yes</td><td>—</td><td>Phrase model used to create candidates</td></tr>
            <tr><td><code>strategy</code></td><td>no</td><td>default strategy</td><td>Aggregation, calculation, and selection rules</td></tr>
            <tr><td><code>diagnostics</code></td><td>no</td><td><code>false</code></td><td>Whether to return intermediate results</td></tr>
          </tbody>
        </table></DocsTable>
        <CodeBlock label="BreakPreview.tsx" language="tsx" locale="en">{englishHookCode}</CodeBlock>
        <h3>Output: <code>UseSemanticWrapResult</code></h3>
        <DocsTable><table>
          <caption>useSemanticWrap output</caption>
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>ref</code></td><td><code>(HTMLElement | null) =&gt; void</code></td><td>Callback ref for the measured element</td></tr>
            <tr><td><code>selection</code></td><td><code>LineBreakSelection | null</code></td><td>Selected result after measurement</td></tr>
            <tr><td><code>diagnostics</code></td><td><code>LineBreakDiagnostics | null</code></td><td>Diagnostics after measurement when requested</td></tr>
          </tbody>
        </table></DocsTable>
      </DocsSection>

      <DocsSection id="models" index="Models" locale="en" title="English and Korean presets">
        <p>Use <code>enTitleModel</code> for English titles and <code>koTitleModel</code> for Korean titles. Both models create candidates only at whitespace boundaries.</p>
        <CodeBlock label="models.ts" language="ts" locale="en">{modelImportCode}</CodeBlock>
        <aside className="docs-note is-caution"><strong>Experimental presets</strong><p>Both presets were trained on small title datasets. Before production use, train and validate against a large dataset that represents your fonts, widths, and content. See the <a href={`${repositoryUrl}/blob/main/packages/en/MODEL_CARD.md`}>English Model Card</a> and <a href={`${repositoryUrl}/blob/main/packages/ko/MODEL_CARD.md`}>Korean Model Card</a>.</p></aside>
      </DocsSection>

      <DocsSection id="development" index="Project 01" locale="en" title="Development">
        <CodeBlock label="Terminal" language="sh" locale="en">{developmentCode}</CodeBlock>
        <p><code>bun run check</code> runs type checking, unit tests, the build, Chromium, Firefox, and WebKit browser tests, and npm package validation.</p>
      </DocsSection>

      <DocsSection id="license" index="Project 02" locale="en" title="License">
        <p>Apache-2.0. <code>@semantic-wrap/core</code> includes a modified, dependency-free implementation of the Google BudouX parser. See <a href={`${repositoryUrl}/blob/main/NOTICE`}>NOTICE</a> for details.</p>
      </DocsSection>
    </article>
  );
}

export function DocsApp({ locale }: { locale: SiteLocale }) {
  const navigationGroups = getNavigationGroups(locale);
  const navigationLinks = navigationGroups.flatMap((group) => group.links);
  const { activeHref, navigateToHref } = useActiveDocsHref(locale);
  const activeLabel = navigationLinks.find((link) => link.href === activeHref)?.label
    ?? (locale === "ko" ? "semantic-wrap 소개" : "Introduction");
  const copy = locale === "ko"
    ? { skip: "본문으로 바로가기", explore: "문서 탐색", mobile: "모바일 문서 메뉴", menu: "문서 메뉴" }
    : { skip: "Skip to content", explore: "Explore docs", mobile: "Mobile documentation menu", menu: "Documentation menu" };

  return (
    <div className="docs-page">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <SiteHeader current="docs" locale={locale} />
      <div className="docs-mobile-index docs-width">
        <details>
          <summary><span>{copy.explore}</span><strong>{activeLabel}</strong></summary>
          <DocsNavigation activeHref={activeHref} label={copy.mobile} locale={locale} onNavigate={navigateToHref} />
        </details>
      </div>
      <main className="docs-grid docs-width" id="main-content">
        <aside className="docs-sidebar">
          <DocsNavigation
            activeHref={activeHref}
            centerActive
            label={copy.menu}
            locale={locale}
            onNavigate={navigateToHref}
          />
        </aside>
        {locale === "ko" ? <IntroductionArticle /> : <EnglishIntroductionArticle />}
      </main>
      <SiteFooter />
    </div>
  );
}
