import { cn } from '@trybun/ui/lib/utils';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * The brand of Trybun in a header: its icon and wordmark, shared by the application shell and the
 * public pages so the two cannot drift apart.
 */
export function Brand({ wordmarkClassName }: { wordmarkClassName?: string }) {
  const t = useTranslations('app');
  return (
    <>
      <Image src="/icons/trybun-icon.svg" alt="" width={32} height={32} unoptimized priority />
      <span className={cn('text-lg font-extrabold lowercase', wordmarkClassName)}>
        {t('title')}
      </span>
    </>
  );
}
