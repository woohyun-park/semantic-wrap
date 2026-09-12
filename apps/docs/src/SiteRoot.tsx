import { StrictMode, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { MotionConfig } from "motion/react";
import type { PhraseModel } from "@semantic-wrap/core";
import type { SiteLocale } from "./site-config";
import { TitleModelContext } from "./site-models";

export function SiteRoot({ children, locale, model }: {
  children: ReactNode;
  locale: SiteLocale;
  model: PhraseModel;
}) {
  return (
    <StrictMode>
      <TitleModelContext value={{ locale, model }}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </TitleModelContext>
      {__VERCEL_DEPLOYMENT__ ? <Analytics /> : null}
    </StrictMode>
  );
}
