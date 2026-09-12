import { SemanticWrap } from "@semantic-wrap/react";
import type { ReactElement } from "react";
import type { SiteLocale } from "./site-config";
import { useTitleModel } from "./site-models";

export function LocalizedSemanticWrap({
  children,
  locale,
}: {
  children: ReactElement<{ children?: string }>;
  locale: SiteLocale;
}) {
  const model = useTitleModel(locale);
  return <SemanticWrap model={model} initial="native">{children}</SemanticWrap>;
}
