import { docsPath, landingPath, localeFromPath, productionUrl } from "./site-config";

export function siteMetadata(pathname: string) {
  const locale = localeFromPath(pathname);
  const isDocs = /^\/(ko\/)?docs(?:\/|$)/.test(pathname);
  const pagePath = isDocs ? docsPath : landingPath;
  const title = isDocs
    ? locale === "ko" ? "semantic-wrap 소개 | 문서" : "Introduction | semantic-wrap docs"
    : locale === "ko" ? "semantic-wrap — 의미를 지키는 줄바꿈" : "semantic-wrap — line breaks that preserve meaning";
  const description = locale === "ko"
    ? "학습된 모델과 실제 렌더링 결과를 바탕으로 더 자연스러운 줄바꿈을 선택하는 JavaScript 라이브러리"
    : "A JavaScript library that selects natural line breaks from a trained model and the actual rendered layout.";
  const image = `${productionUrl}/og-image.png`;
  const imageAlt = locale === "ko"
    ? "semantic-wrap 로고와 Line breaks, naturally 문구"
    : "semantic-wrap logo and the words Line breaks, naturally.";

  return {
    locale,
    title,
    meta: [
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "semantic-wrap" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${productionUrl}${pagePath(locale)}` },
      { property: "og:locale", content: locale === "ko" ? "ko_KR" : "en_US" },
      { property: "og:locale:alternate", content: locale === "ko" ? "en_US" : "ko_KR" },
      { property: "og:image", content: image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [
      { rel: "canonical", href: `${productionUrl}${pagePath(locale)}` },
      { rel: "alternate", href: `${productionUrl}${pagePath("en")}`, hreflang: "en" },
      { rel: "alternate", href: `${productionUrl}${pagePath("ko")}`, hreflang: "ko" },
      { rel: "alternate", href: `${productionUrl}${pagePath("en")}`, hreflang: "x-default" },
    ],
  };
}
