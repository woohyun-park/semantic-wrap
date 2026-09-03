import { SemanticWrap } from "@semantic-wrap/react";
import type { ReactElement } from "react";
import type { SiteLocale } from "./site-config";
import { titleModels } from "./site-models";

export function LocalizedSemanticWrap({
  children,
  locale,
}: {
  children: ReactElement<{ children?: string }>;
  locale: SiteLocale;
}) {
  return <SemanticWrap model={titleModels[locale]}>{children}</SemanticWrap>;
}
