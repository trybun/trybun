import type { Locator, Page } from '@playwright/test';
import { CATALOGUES, LOCALES, type Locale, type Messages } from '@trybun/i18n/catalogues';
import { isPseudoLocale, PSEUDO_LOCALE, type RequestLocale } from '@trybun/i18n/pseudo';
import { pseudoLocalize } from '@trybun/i18n/pseudo/messages';

/**
 * Every language of the catalogues (§13.1). Width-sensitive checks loop over it instead of naming
 * `en` and `pl`, so a language added to `@trybun/i18n` is tested without changing the tests
 * (#295). The stored states carry no `NEXT_LOCALE` cookie, so the browser language of
 * `test.use({ locale })` is the language of the pages.
 */
export const ALL_LOCALES: readonly Locale[] = LOCALES;

/**
 * The languages of the width-sensitive checks (§2.9): every language of the catalogues and the
 * pseudo-locale `en-XA` – English stretched by the W3C expansion rates (#301) – so a layout that
 * fits today's translations but not a longer future language fails before that language lands.
 * The web server serves the pseudo-locale under `next dev` and with `TRYBUN_PSEUDO_LOCALE`
 * (`playwright.config.ts`). A new width-sensitive check loops over this list.
 */
export const TEST_LOCALES: readonly RequestLocale[] = [...ALL_LOCALES, PSEUDO_LOCALE];

let pseudoMessages: Messages | undefined;

/** The messages of a language, for the names of the elements a test looks up. */
export function messagesOf(locale: RequestLocale): Messages {
  if (isPseudoLocale(locale)) {
    pseudoMessages ??= pseudoLocalize(CATALOGUES.en);
    return pseudoMessages;
  }
  return CATALOGUES[locale];
}

/**
 * `TABLET_MEDIA_QUERY` of `@trybun/ui` (48rem, `md`): the narrowest tablet. The `tablet` project
 * is wider, so a layout that fits there can still overflow at this width (§2.9).
 */
export const NARROWEST_TABLET = { width: 768, height: 1024 } as const;

/**
 * A large tablet, e.g. an iPad in landscape: from `lg` to `xl` the table shows four narrow columns
 * whose labels are not limited in width (§8.1).
 */
export const LARGE_TABLET = { width: 1024, height: 768 } as const;

/** How far an element scrolls sideways: 0 when its content fits. */
export function horizontalOverflow(element: Locator): Promise<number> {
  return element.evaluate((node) => node.scrollWidth - node.clientWidth);
}

/** How far the page itself scrolls sideways: 0 when nothing widens it. */
export function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}
