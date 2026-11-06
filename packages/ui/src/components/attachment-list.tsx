'use client';

import { cva } from 'class-variance-authority';
import { cn } from 'cn';
import {
  FileArchiveIcon,
  FileCodeIcon,
  FileHeadphoneIcon,
  FileIcon,
  FileImageIcon,
  FilePlayIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderCircleIcon,
  ScanSearchIcon,
  ShieldAlertIcon,
  ShieldQuestionMarkIcon,
  TrashIcon,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { createContext, use, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button } from '@trybun/ui/components/button';

/**
 * The states of an attachment in a list (§13.3): being uploaded, being checked for malware,
 * available, or removed by the check (`infected`, `rejected`). A rejected upload is no item – its
 * message is a toast of the caller.
 */
type AttachmentState = 'uploading' | 'checking' | 'available' | 'infected' | 'rejected';

const REMOVED_STATES: ReadonlySet<AttachmentState> = new Set(['infected', 'rejected']);

/** The icon of each state that is not `available`; with its text, colour is never the only cue. */
const STATE_ICONS: Record<Exclude<AttachmentState, 'available'>, LucideIcon> = {
  uploading: LoaderCircleIcon,
  checking: ScanSearchIcon,
  infected: ShieldAlertIcon,
  rejected: ShieldQuestionMarkIcon,
};

const TYPE_ICONS = {
  image: FileImageIcon,
  video: FilePlayIcon,
  audio: FileHeadphoneIcon,
  spreadsheet: FileSpreadsheetIcon,
  archive: FileArchiveIcon,
  code: FileCodeIcon,
  text: FileTextIcon,
  other: FileIcon,
} satisfies Record<string, LucideIcon>;

/** The kind of a file by its media type, for its icon; the first match wins. */
const FILE_KINDS: [RegExp, keyof typeof TYPE_ICONS][] = [
  [/^image\//, 'image'],
  [/^video\//, 'video'],
  [/^audio\//, 'audio'],
  [/(?:^text\/csv$)|(?:spreadsheet|excel)/, 'spreadsheet'],
  [/zip|compressed|tar|gzip/, 'archive'],
  [/json|xml|javascript|yaml/, 'code'],
  [/(?:^text\/)|(?:pdf|word|opendocument\.text|rtf)/, 'text'],
];

function fileKind(contentType: string | undefined): keyof typeof TYPE_ICONS {
  return FILE_KINDS.find(([pattern]) => pattern.test(contentType ?? ''))?.[1] ?? 'other';
}

const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** A size in bytes as a value and the unit to show it in, in steps of 1024. */
function fileSize(bytes: number): { value: number; unit: (typeof SIZE_UNITS)[number] } {
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < SIZE_UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  return { value, unit: SIZE_UNITS[index] ?? 'byte' };
}

interface AttachmentListContextProps {
  announce: (message: string) => void;
}

const AttachmentListContext = createContext<AttachmentListContextProps>({ announce: () => {} });

interface Announcement {
  id: number;
  text: string;
}

/**
 * A list of attachments: one column on phones, two from the tablet breakpoint on. Its polite live
 * region announces the state changes of its items ("screenshot.png: Available"), §2.9.
 */
function AttachmentList({ className, children, ...props }: ComponentProps<'ul'>) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // The latest few messages stay, so changes of several items in one update are all read.
  function announce(text: string) {
    setAnnouncements((previous) => [
      ...previous.slice(-4),
      { id: (previous.at(-1)?.id ?? 0) + 1, text },
    ]);
  }

  return (
    <AttachmentListContext value={{ announce }}>
      <ul
        data-slot="attachment-list"
        className={cn('grid grid-cols-1 gap-2 md:grid-cols-2', className)}
        {...props}
      >
        {children}
      </ul>
      <div role="status" aria-live="polite" className="sr-only">
        {announcements.map((announcement) => (
          <p key={announcement.id}>{announcement.text}</p>
        ))}
      </div>
    </AttachmentListContext>
  );
}

const attachmentStateVariants = cva('flex min-w-0 items-center gap-1', {
  variants: {
    state: {
      uploading: 'text-muted-foreground [&>svg]:motion-safe:animate-spin',
      checking: 'text-muted-foreground',
      available: 'text-muted-foreground',
      infected: 'text-destructive',
      rejected: 'text-destructive',
    },
  },
});

interface AttachmentItemProps extends Omit<ComponentProps<'li'>, 'children'> {
  /** The name of the file, shown and used in the accessible names. */
  fileName: string;
  /** The size in bytes, shown in the units of the locale. */
  size: number;
  /** The media type; decides the type icon. */
  contentType?: string;
  /** The stable content path; a link only while the file is `available`. */
  href: string;
  state: AttachmentState;
  /** A thumbnail of an available image (the content path, given by the caller). */
  thumbnailUrl?: string;
  /** Shown only when given – the caller passes it when `allowedActions` contains `delete`. */
  onDelete?: () => void;
}

/**
 * An attachment: type icon or thumbnail, name, size and state as text and icon (§13.4). An
 * available file is a link whose hit area is the whole item; a removed file is no link.
 */
function AttachmentItem({
  fileName,
  size,
  contentType,
  href,
  state,
  thumbnailUrl,
  onDelete,
  className,
  ...props
}: AttachmentItemProps) {
  const t = useTranslations('ui.attachmentList');
  const format = useFormatter();
  const { announce } = use(AttachmentListContext);
  const previousState = useRef(state);
  const status = t(state);

  useEffect(() => {
    if (previousState.current !== state) {
      previousState.current = state;
      announce(t('announcement', { name: fileName, status }));
    }
  }, [announce, fileName, state, status, t]);

  const isAvailable = state === 'available';
  const isRemoved = REMOVED_STATES.has(state);
  const TypeIcon = TYPE_ICONS[fileKind(contentType)];
  const StateIcon = isAvailable ? undefined : STATE_ICONS[state];
  const { value, unit } = fileSize(size);
  const formattedSize = format.number(value, {
    style: 'unit',
    unit,
    // "734 bytes", but "1.5 MB": the short form of a byte is "byte" in English.
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: unit === 'byte' ? 0 : 1,
  });

  return (
    <li
      data-slot="attachment-item"
      data-state={state}
      className={cn(
        'relative flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-2 text-sm text-card-foreground',
        className,
      )}
      {...props}
    >
      {isAvailable && thumbnailUrl !== undefined ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="size-11 shrink-0 rounded-md bg-muted object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <TypeIcon className="size-5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {isAvailable ? (
          // The `after` element stretches the link over the item: a 44 px target (§2.9).
          <a
            href={href}
            className="truncate font-medium text-link underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {fileName}
          </a>
        ) : (
          <span className={cn('truncate font-medium', isRemoved && 'text-muted-foreground')}>
            {fileName}
          </span>
        )}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">{formattedSize}</span>
          {StateIcon !== undefined && (
            <span className={attachmentStateVariants({ state })}>
              <StateIcon aria-hidden="true" className="size-3.5 shrink-0" />
              {status}
            </span>
          )}
        </span>
      </div>
      {onDelete !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('delete', { name: fileName })}
          onClick={onDelete}
        >
          <TrashIcon />
        </Button>
      )}
    </li>
  );
}

export { AttachmentItem, AttachmentList, attachmentStateVariants, type AttachmentState };
