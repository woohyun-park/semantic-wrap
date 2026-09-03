export type ExampleLocale = "en" | "ko";

export type ReferenceLayout = {
  width: number;
  nativeLines: readonly string[];
  semanticLines: readonly string[];
};

export type SemanticExampleCase = {
  id: string;
  text: string;
  semanticPhrase: string;
  nativeDescription: string;
  semanticDescription: string;
  reference: ReferenceLayout;
};

export type LineBreakExample = SemanticExampleCase & {
  introMeasureEm: number;
  playgroundMeasures: readonly number[];
};

export type ProcessExample = {
  case: SemanticExampleCase;
  reference: ReferenceLayout;
  selectionReason: string;
};

const koreanExamples = [
  {
    id: "before",
    text: "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준",
    semanticPhrase: "도입하기 전에",
    introMeasureEm: 13,
    playgroundMeasures: [414, 308, 240],
    nativeDescription: "CSS balance는 ‘전에’를 다음 줄로 밀어 조건을 나타내는 구절을 가릅니다.",
    semanticDescription: "‘도입하기 전에’를 같은 줄에 묶어 하나의 의미 단위로 유지합니다.",
    reference: {
      width: 414,
      nativeLines: ["디자인 시스템을 도입하기", "전에 반드시 확인해야 할 기준"],
      semanticLines: ["디자인 시스템을 도입하기 전에", "반드시 확인해야 할 기준"],
    },
  },
  {
    id: "readable",
    text: "사용자 맥락을 이해하고 더 나은 해결책을 만드는 방법",
    semanticPhrase: "더 나은",
    introMeasureEm: 12,
    playgroundMeasures: [414, 292, 240],
    nativeDescription: "CSS balance는 ‘더’를 앞줄에 남겨 ‘더 나은’이라는 수식 관계를 가릅니다.",
    semanticDescription: "‘더 나은’을 같은 줄에 두어 해결책을 꾸미는 의미를 유지합니다.",
    reference: {
      width: 414,
      nativeLines: ["사용자 맥락을 이해하고 더", "나은 해결책을 만드는 방법"],
      semanticLines: ["사용자 맥락을 이해하고", "더 나은 해결책을 만드는 방법"],
    },
  },
  {
    id: "purpose",
    text: "더 나은 제품을 만들기 위해 팀이 버려야 할 습관",
    semanticPhrase: "만들기 위해",
    introMeasureEm: 11,
    playgroundMeasures: [414, 308, 246],
    nativeDescription: "CSS balance는 ‘만들기’와 ‘위해’를 서로 다른 줄에 두어 목적을 나타내는 표현을 가릅니다.",
    semanticDescription: "‘만들기 위해’를 같은 줄에 묶어 목적을 분명하게 전달합니다.",
    reference: {
      width: 414,
      nativeLines: ["더 나은 제품을 만들기", "위해 팀이 버려야 할 습관"],
      semanticLines: ["더 나은 제품을 만들기 위해", "팀이 버려야 할 습관"],
    },
  },
] as const satisfies readonly [LineBreakExample, LineBreakExample, LineBreakExample];

const koreanProcessCase = {
  id: "meeting-purpose",
  text: "효율적인 회의를 만들기 위해 버려야 할 습관",
  semanticPhrase: "만들기 위해",
  nativeDescription: "CSS balance는 ‘만들기’와 ‘위해’를 나누어 목적을 나타내는 표현을 가릅니다.",
  semanticDescription: "‘만들기 위해’를 같은 줄에 묶어 목적을 분명하게 전달합니다.",
  reference: {
    width: 220,
    nativeLines: ["효율적인 회의를 만들기", "위해 버려야 할 습관"],
    semanticLines: ["효율적인 회의를", "만들기 위해 버려야 할 습관"],
  },
} as const satisfies SemanticExampleCase;

const englishExamples = [
  {
    id: "readers",
    text: "Write clear headlines for readers, not for reviewers",
    semanticPhrase: "for readers, not for reviewers",
    introMeasureEm: 13,
    playgroundMeasures: [418, 308, 246],
    nativeDescription: "CSS balance separates ‘for’ from the audience contrast it introduces.",
    semanticDescription: "The model keeps ‘for readers, not for reviewers’ together as one contrast.",
    reference: {
      width: 418,
      nativeLines: ["Write clear headlines for", "readers, not for reviewers"],
      semanticLines: ["Write clear headlines", "for readers, not for reviewers"],
    },
  },
  {
    id: "trust",
    text: "Earn customer trust before asking for more data",
    semanticPhrase: "before asking for more data",
    introMeasureEm: 12,
    playgroundMeasures: [414, 308, 240],
    nativeDescription: "CSS balance separates ‘before’ from the action it introduces.",
    semanticDescription: "The model keeps ‘before asking’ together as one meaningful phrase.",
    reference: {
      width: 414,
      nativeLines: ["Earn customer trust before", "asking for more data"],
      semanticLines: ["Earn customer trust", "before asking for more data"],
    },
  },
  {
    id: "audience",
    text: "Design documentation for people who need to act",
    semanticPhrase: "for people who need to act",
    introMeasureEm: 12,
    playgroundMeasures: [414, 308, 240],
    nativeDescription: "CSS balance separates ‘for’ from the audience it introduces.",
    semanticDescription: "The model keeps ‘for people who need to act’ together as one audience phrase.",
    reference: {
      width: 414,
      nativeLines: ["Design documentation for", "people who need to act"],
      semanticLines: ["Design documentation", "for people who need to act"],
    },
  },
] as const satisfies readonly [LineBreakExample, LineBreakExample, LineBreakExample];

export const exampleCases = {
  ko: {
    examples: koreanExamples,
    process: {
      case: koreanProcessCase,
      reference: koreanProcessCase.reference,
      selectionReason: "‘만들기 위해’를 한 줄에 묶어 목적을 분명하게 전달합니다.",
    },
    readme: [...koreanExamples, koreanProcessCase],
  },
  en: {
    examples: englishExamples,
    process: {
      case: englishExamples[0],
      reference: {
        width: 345,
        nativeLines: englishExamples[0].reference.nativeLines,
        semanticLines: englishExamples[0].reference.semanticLines,
      },
      selectionReason: "The selected layout keeps the full contrast ‘for readers, not for reviewers’ together without sacrificing balance.",
    },
    readme: englishExamples,
  },
} as const satisfies Record<
  ExampleLocale,
  {
    examples: readonly [LineBreakExample, LineBreakExample, LineBreakExample];
    process: ProcessExample;
    readme: readonly SemanticExampleCase[];
  }
>;
