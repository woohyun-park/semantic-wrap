import type { SiteLocale } from "./site-config";
import { exampleCases, type LineBreakExample } from "./example-cases";

export type { LineBreakExample } from "./example-cases";

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
    semanticPhrase: string;
    measureWidth: number;
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

export const landingContent: Record<SiteLocale, LandingContent> = {
  ko: {
    examples: exampleCases.ko.examples,
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
      example: exampleCases.ko.process.case.text,
      semanticPhrase: exampleCases.ko.process.case.semanticPhrase,
      measureWidth: exampleCases.ko.process.reference.width,
      selectionReason: exampleCases.ko.process.selectionReason,
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
    examples: exampleCases.en.examples,
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
      example: exampleCases.en.process.case.text,
      semanticPhrase: exampleCases.en.process.case.semanticPhrase,
      measureWidth: exampleCases.en.process.reference.width,
      selectionReason: exampleCases.en.process.selectionReason,
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
