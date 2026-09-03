import type { SiteLocale } from "./site-config";

export type LineBreakExample = {
  id: string;
  text: string;
  introMeasureEm: number;
  playgroundMeasures: readonly number[];
  nativeDescription: string;
  semanticDescription: string;
};

export type LandingContent = {
  examples: readonly [LineBreakExample, LineBreakExample, LineBreakExample];
  intro: {
    installCommand: string;
    start: string;
    copy: string;
    copied: string;
    copyFailed: string;
    message: readonly [string, string];
    comparisonLabel: string;
    nativeLabel: string;
    semanticLabel: string;
  };
  playground: {
    example: string;
    presetLabel: string;
    browser: string;
    semantic: string;
    lines: (count: number) => string;
    widthLabel: string;
    widthValue: (width: number) => string;
  };
  process: {
    example: string;
    selectionReason: string;
    title: string;
    lead: string;
    ariaLabel: string;
    candidateLabel: string;
    fallbackCandidate: string;
    predictedCandidate: (name: string) => string;
    layoutLabel: string;
    selectionLabel: string;
    measureLoading: string;
    candidateLoading: string;
    selectionLoading: string;
    balanceCost: string;
    semanticCost: string;
    beforeLabel: string;
    afterLabel: string;
    nativeKept: string;
    diagnostic: (candidates: number, predictions: number) => string;
    measurement: (width: number, layouts: number) => string;
    steps: readonly { number: string; title: string; description: string }[];
  };
};

const koreanHeadlines = [
  "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준",
  "사용자 맥락을 이해하고 더 나은 해결책을 만드는 방법",
  "더 나은 제품을 만들기 위해 팀이 버려야 할 습관",
] as const;

const englishHeadlines = [
  "Write clear headlines for readers, not for reviewers",
  "Earn customer trust before asking for more data",
  "Design documentation for people who need to act",
] as const;

export const landingContent: Record<SiteLocale, LandingContent> = {
  ko: {
    examples: [
      {
        id: "before",
        text: koreanHeadlines[0],
        introMeasureEm: 11,
        playgroundMeasures: [414, 308, 240],
        nativeDescription: "CSS balance는 ‘전에’를 다음 줄로 밀어 조건을 나타내는 구절을 가릅니다.",
        semanticDescription: "‘도입하기 전에’를 같은 줄에 묶어 하나의 의미 단위로 유지합니다.",
      },
      {
        id: "readable",
        text: koreanHeadlines[1],
        introMeasureEm: 11,
        playgroundMeasures: [414, 292, 240],
        nativeDescription: "CSS balance는 ‘더’를 앞줄에 남겨 ‘더 나은’이라는 수식 관계를 가릅니다.",
        semanticDescription: "‘더 나은’을 같은 줄에 두어 해결책을 꾸미는 의미를 유지합니다.",
      },
      {
        id: "purpose",
        text: koreanHeadlines[2],
        introMeasureEm: 11,
        playgroundMeasures: [414, 308, 240],
        nativeDescription: "CSS balance는 ‘만들기’와 ‘위해’를 서로 다른 줄에 두어 목적을 나타내는 표현을 가릅니다.",
        semanticDescription: "‘만들기 위해’를 같은 줄에 묶어 목적을 분명하게 전달합니다.",
      },
    ],
    intro: {
      installCommand: "npm i @semantic-wrap/react @semantic-wrap/ko",
      start: "시작하기",
      copy: "npm 설치 명령 복사",
      copied: "복사됨",
      copyFailed: "복사하지 못했습니다",
      message: ["줄바꿈을", "자연스럽게"],
      comparisonLabel: "CSS balance와 semantic-wrap 줄바꿈 비교",
      nativeLabel: "CSS balance 줄바꿈",
      semanticLabel: "semantic-wrap 의미 줄바꿈",
    },
    playground: {
      example: "예시",
      presetLabel: "예시 제목 선택",
      browser: "CSS balance",
      semantic: "semantic-wrap",
      lines: (count) => `${count}줄`,
      widthLabel: "제목 컨테이너 너비",
      widthValue: (width) => `${width}픽셀`,
    },
    process: {
      example: "효율적인 회의를 만들기 위해 버려야 할 습관",
      selectionReason: "‘만들기 위해’를 한 줄에 묶어 목적을 분명하게 전달합니다.",
      title: "모델이 제안하고, 브라우저가 검증합니다.",
      lead: "모델이 찾은 의미 경계와 실제 렌더링 너비를 함께 비교해, 바꿀 가치가 있는 줄바꿈만 적용합니다.",
      ariaLabel: "작동 방식 실시간 미리보기",
      candidateLabel: "실제 모델이 찾은 줄바꿈 후보",
      fallbackCandidate: "공백 기반 보조 후보",
      predictedCandidate: (name) => `${name} 예측 후보`,
      layoutLabel: "실제로 측정한 레이아웃 후보",
      selectionLabel: "실제로 측정한 현재 CSS 결과와 semantic-wrap 선택 결과",
      measureLoading: "현재 글꼴과 너비를 측정하고 있습니다…",
      candidateLoading: "실제 후보를 계산하고 있습니다…",
      selectionLoading: "실제 선택 결과를 계산하고 있습니다…",
      balanceCost: "균형 비용",
      semanticCost: "의미 비용",
      beforeLabel: "BEFORE · 현재 CSS",
      afterLabel: "AFTER · semantic-wrap 적용 결과",
      nativeKept: "현재 CSS 줄바꿈이 이미 가장 적합해 변경하지 않았습니다.",
      diagnostic: (candidates, predictions) => `실제 진단 · 후보 ${candidates}개 · 모델 예측 ${predictions}개`,
      measurement: (width, layouts) => `${width}px 실측 · 현재 CSS안 포함 ${layouts}개 레이아웃`,
      steps: [
        { number: "01", title: "경계를 찾고", description: "언어 모델이 문장 안에서 자연스럽게 끊을 수 있는 후보를 예측합니다." },
        { number: "02", title: "실제로 재고", description: "현재 글꼴과 컨테이너 너비로 가능한 레이아웃을 브라우저에서 측정합니다." },
        { number: "03", title: "더 나은 쪽을 고릅니다", description: "의미 비용이 낮고 줄 균형도 허용 범위 안인 결과만 실제 화면에 적용합니다." },
      ],
    },
  },
  en: {
    examples: [
      {
        id: "readers",
        text: englishHeadlines[0],
        introMeasureEm: 12,
        playgroundMeasures: [414, 308, 240],
        nativeDescription: "CSS balance separates ‘for’ from the audience contrast it introduces.",
        semanticDescription: "The model keeps ‘for readers, not for reviewers’ together as one contrast.",
      },
      {
        id: "trust",
        text: englishHeadlines[1],
        introMeasureEm: 12,
        playgroundMeasures: [414, 308, 240],
        nativeDescription: "CSS balance separates ‘before’ from the action it introduces.",
        semanticDescription: "The model keeps ‘before asking’ together as one meaningful phrase.",
      },
      {
        id: "audience",
        text: englishHeadlines[2],
        introMeasureEm: 12,
        playgroundMeasures: [414, 308, 240],
        nativeDescription: "CSS balance separates ‘for’ from the audience it introduces.",
        semanticDescription: "The model keeps ‘for people who need to act’ together as one audience phrase.",
      },
    ],
    intro: {
      installCommand: "npm i @semantic-wrap/react @semantic-wrap/en",
      start: "Get started",
      copy: "Copy npm install command",
      copied: "Copied",
      copyFailed: "Copy failed",
      message: ["Line breaks,", "naturally"],
      comparisonLabel: "CSS balance and semantic-wrap line break comparison",
      nativeLabel: "CSS balanced wrapping",
      semanticLabel: "semantic-wrap wrapping",
    },
    playground: {
      example: "Example",
      presetLabel: "Choose an example headline",
      browser: "CSS balance",
      semantic: "semantic-wrap",
      lines: (count) => `${count} ${count === 1 ? "line" : "lines"}`,
      widthLabel: "Headline container width",
      widthValue: (width) => `${width} pixels`,
    },
    process: {
      example: "Write clear headlines for readers, not for reviewers",
      selectionReason: "The selected layout keeps the full contrast ‘for readers, not for reviewers’ together without sacrificing balance.",
      title: "The model proposes. The browser verifies.",
      lead: "semantic-wrap compares model-predicted boundaries with real rendered widths, then changes only the line breaks worth changing.",
      ariaLabel: "Live preview of how semantic-wrap works",
      candidateLabel: "Line-break candidates found by the model",
      fallbackCandidate: "Whitespace fallback candidate",
      predictedCandidate: (name) => `${name} model candidate`,
      layoutLabel: "Layouts measured in the browser",
      selectionLabel: "Measured comparison between current CSS and semantic-wrap",
      measureLoading: "Measuring the current font and width…",
      candidateLoading: "Calculating actual candidates…",
      selectionLoading: "Calculating the selected result…",
      balanceCost: "Balance cost",
      semanticCost: "Semantic cost",
      beforeLabel: "BEFORE · current CSS",
      afterLabel: "AFTER · semantic-wrap result",
      nativeKept: "The current CSS wrap is already the best fit, so it was left unchanged.",
      diagnostic: (candidates, predictions) => `Live diagnostics · ${candidates} candidates · ${predictions} model predictions`,
      measurement: (width, layouts) => `${width}px measured · ${layouts} layouts including current CSS`,
      steps: [
        { number: "01", title: "Find boundaries", description: "A language model predicts natural places where the sentence can break." },
        { number: "02", title: "Measure layouts", description: "The browser measures possible layouts with the current font and container width." },
        { number: "03", title: "Choose the better result", description: "Only a result with stronger semantics and acceptable visual balance reaches the screen." },
      ],
    },
  },
};
