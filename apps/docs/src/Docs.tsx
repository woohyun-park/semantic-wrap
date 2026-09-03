import {
  useCallback,
  useEffect,
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
import { copyText, repositoryUrl } from "./site-config";

const introductionPath = "/ko/docs/introduction";
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

const navigationGroups = [
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

const navigationLinks = navigationGroups.flatMap((group) => group.links);

function useActiveDocsHref() {
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
  }, []);

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
  onNavigate,
}: {
  activeHref: string;
  centerActive?: boolean;
  label: string;
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
      {navigationGroups.map((group) => (
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
}: {
  label: string;
  language: "sh" | "ts" | "tsx";
  children: string;
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
        <button type="button" onClick={copyCode} aria-label={`${label} 코드 복사`}>
          <CopyIcon />
          <span aria-live="polite">{copied ? "복사됨" : "복사"}</span>
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
  title,
}: {
  children: ReactNode;
  id: string;
  index: string;
  title: ReactNode;
}) {
  const heading = <h2 id={`${id}-title`}>{title}</h2>;
  const isPlainKoreanTitle =
    typeof title === "string" && /[\uac00-\ud7a3]/u.test(title);

  return (
    <section className="docs-section docs-anchor" id={id} aria-labelledby={`${id}-title`}>
      <p className="docs-section-index">{index}</p>
      {isPlainKoreanTitle ? (
        <KoreanSemanticWrap>{heading}</KoreanSemanticWrap>
      ) : heading}
      {children}
    </section>
  );
}

function DocsSubheading({ children }: { children: string }) {
  return (
    <KoreanSemanticWrap>
      <h3>{children}</h3>
    </KoreanSemanticWrap>
  );
}

function IntroductionArticle() {
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

export function DocsApp() {
  const { activeHref, navigateToHref } = useActiveDocsHref();
  const activeLabel = navigationLinks.find((link) => link.href === activeHref)?.label ?? "semantic-wrap 소개";

  useEffect(() => {
    document.title = "semantic-wrap 소개 | 문서";
  }, []);

  return (
    <div className="docs-page">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <SiteHeader current="docs" />
      <div className="docs-mobile-index docs-width">
        <details>
          <summary><span>문서 탐색</span><strong>{activeLabel}</strong></summary>
          <DocsNavigation activeHref={activeHref} label="모바일 문서 메뉴" onNavigate={navigateToHref} />
        </details>
      </div>
      <main className="docs-grid docs-width" id="main-content">
        <aside className="docs-sidebar">
          <DocsNavigation
            activeHref={activeHref}
            centerActive
            label="문서 메뉴"
            onNavigate={navigateToHref}
          />
        </aside>
        <IntroductionArticle />
      </main>
      <SiteFooter />
    </div>
  );
}
