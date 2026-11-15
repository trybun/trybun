import { Button } from '@trybun/ui/components/button';
import { CircleHelpIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { APP_HEADER_ICON_CLASS_NAME } from '../../app-shell/components/app-header-icon.js';

/**
 * The button of the help menu (§2.3): the trigger of `HelpMenu`, and the fallback of
 * `LazyHelpMenu` while the menu's code loads, so both take the same place in the header (#311). A
 * module of its own without Base UI's `Menu`, which loads after the first paint (#72).
 * @param props the props of the menu trigger, which renders this button
 */
export function HelpMenuButton(props: Omit<ComponentProps<typeof Button>, 'children'>) {
  const t = useTranslations('help');
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('open')}
      data-tour="app-header-help"
      {...props}
    >
      <CircleHelpIcon aria-hidden className={APP_HEADER_ICON_CLASS_NAME} />
    </Button>
  );
}
