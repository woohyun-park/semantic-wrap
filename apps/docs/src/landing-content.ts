export const demoHeadlines = [
  "디자인 시스템을 도입하기 전에 반드시 확인해야 할 기준",
  "사용자를 이해하고, 더 나은 해결책을 만드는 방법",
  "효율적인 회의를 만들기 위해 버려야 할 습관",
] as const;

export type LineBreakExample = {
  id: string;
  text: string;
  pieces: readonly string[];
  nativeBreakAfter: number;
  semanticBreakAfter: number;
  focusIndex: number;
  nativeDescription: string;
  semanticDescription: string;
};

export const lineBreakExamples: readonly LineBreakExample[] = [
  {
    id: "before",
    text: demoHeadlines[0],
    pieces: ["디자인 시스템을 도입하기", "전에", "반드시 확인해야 할 기준"],
    nativeBreakAfter: 0,
    semanticBreakAfter: 1,
    focusIndex: 1,
    nativeDescription: "‘전에’가 다음 줄로 밀려 조건을 나타내는 구절이 갈라집니다.",
    semanticDescription: "‘도입하기 전에’를 같은 줄에 묶어 하나의 의미 단위로 유지합니다.",
  },
  {
    id: "readable",
    text: demoHeadlines[1],
    pieces: ["사용자를 이해하고,", "더 나은", "해결책을 만드는 방법"],
    nativeBreakAfter: 1,
    semanticBreakAfter: 0,
    focusIndex: 1,
    nativeDescription: "‘더 나은’이 서로 다른 줄에 놓여 수식 관계가 끊깁니다.",
    semanticDescription: "쉼표 뒤에서 줄을 나눠 ‘더 나은’을 함께 읽도록 만듭니다.",
  },
  {
    id: "purpose",
    text: demoHeadlines[2],
    pieces: ["효율적인 회의를", "만들기", "위해 버려야 할 습관"],
    nativeBreakAfter: 1,
    semanticBreakAfter: 0,
    focusIndex: 1,
    nativeDescription: "‘만들기’와 ‘위해’가 서로 다른 줄에 놓여 목적을 나타내는 표현이 갈라집니다.",
    semanticDescription: "‘만들기 위해’를 한 줄에 묶어 목적을 분명하게 전달합니다.",
  },
];
