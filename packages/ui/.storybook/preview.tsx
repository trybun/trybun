import { withThemeByClassName } from '@storybook/addon-themes';
import type { Decorator, Preview } from '@storybook/react-vite';
import { CATALOGUES, LOCALES, type Locale } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import { VIEWPORTS } from './viewports.js';
import './preview.css';

/** Texts of the components in the language chosen in the toolbar (§18.6). */
const withMessages: Decorator = (story, { globals }) => {
  const locale = globals.locale as Locale;
  return (
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="Europe/Warsaw">
      {story()}
    </NextIntlClientProvider>
  );
};

const preview: Preview = {
  decorators: [
    withMessages,
    withThemeByClassName({ themes: { light: '', dark: 'dark' }, defaultTheme: 'light' }),
  ],
  globalTypes: {
    locale: {
      description: 'Language of the component texts',
      toolbar: { icon: 'globe', items: [...LOCALES], dynamicTitle: true },
    },
  },
  initialGlobals: {
    locale: 'en',
    // The story tests run once per theme (vitest.config.ts).
    theme: import.meta.env.STORYBOOK_THEME ?? 'light',
  },
  parameters: {
    layout: 'padded',
    viewport: { options: VIEWPORTS },
    // Every story fails its test on an accessibility violation (§13.4).
    a11y: {
      test: 'error',
      // The focus guards of Base UI popups (visually hidden, `aria-hidden`, focusable) move the
      // focus back into the popup and are never read; axe reports them as `aria-hidden-focus`.
      context: { include: ['body'], exclude: ['[data-base-ui-focus-guard]'] },
      // The rule tags of the accessibility gate (§2.14).
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    },
  },
};

export default preview;
