import { createContext, useContext } from "react";
import type { PhraseModel } from "@semantic-wrap/core";
import type { SiteLocale } from "./site-config";

export const TitleModelContext = createContext<{ locale: SiteLocale; model: PhraseModel } | null>(null);

export function useTitleModel(locale: SiteLocale): PhraseModel {
  const context = useContext(TitleModelContext);
  if (!context || context.locale !== locale) throw new Error(`Missing title model for ${locale}`);
  return context.model;
}
