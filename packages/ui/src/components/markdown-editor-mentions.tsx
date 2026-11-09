'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from 'cn';
import { useTranslations } from 'next-intl';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '../hooks/use-media-query.js';
import { mentionQueryAt, mentionToken, type MentionQuery } from './markdown-editor-mention.js';

/** A person the editor suggests for a mention (S1-12). */
export interface MentionCandidate {
  id: string;
  displayName: string;
  userKind: 'team' | 'end_user';
}

/** Searches the people to mention for the text typed after `@` (an empty text: everyone). */
export type MentionSearch = (query: string) => Promise<ReadonlyArray<MentionCandidate>>;

/** Short enough to feel immediate, long enough to skip most keystrokes of a name. */
const SEARCH_DELAY_MS = 150;

interface Suggestions extends MentionQuery {
  status: 'loading' | 'done';
  people: ReadonlyArray<MentionCandidate>;
  activeIndex: number;
}

// The CSS properties that place the text of a textarea, copied to a mirror to find a line.
const MIRRORED_PROPERTIES = [
  'box-sizing',
  'width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-stretch',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'text-transform',
  'tab-size',
];

/**
 * The line of the textarea at `position`, as wide as the textarea: a mirror element with its text
 * up to the position measures where that line starts. Clamped to the visible box.
 */
function lineRect(textarea: HTMLTextAreaElement, position: number): DOMRect {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.append(marker);
  document.body.append(mirror);
  const top = marker.offsetTop - textarea.scrollTop;
  const height = marker.offsetHeight;
  mirror.remove();
  const box = textarea.getBoundingClientRect();
  const y = Math.min(Math.max(box.top + top, box.top), box.bottom - height);
  return DOMRect.fromRect({ x: box.left, y, width: box.width, height });
}

/**
 * The @-suggestions of the GFM editor (S1-12): the `@query` at the caret, the debounced search
 * with stale responses ignored, and the keyboard of the list. The textarea keeps the focus and
 * points to the active option with `aria-activedescendant`.
 */
export function useMentionSuggestions({
  textareaRef,
  onMentionSearch,
  onChoose,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onMentionSearch: MentionSearch | undefined;
  /** Replaces the range of the `@query` with the token, like typing. */
  onChoose: (start: number, end: number, insert: string) => void;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  // The `@` whose list Escape closed: it stays closed until the writer types another one. A ref,
  // as a `select` event of the same key press must already see it.
  const dismissedStartRef = useRef<number | null>(null);
  const start = suggestions?.start;
  const query = suggestions?.query;

  useEffect(() => {
    if (onMentionSearch === undefined || start === undefined || query === undefined) {
      return undefined;
    }
    let isCurrent = true;
    const done = (people: ReadonlyArray<MentionCandidate>) => {
      if (isCurrent) {
        setSuggestions((current) =>
          current?.start === start && current.query === query
            ? { ...current, status: 'done', people, activeIndex: 0 }
            : current,
        );
      }
    };
    const timer = setTimeout(() => {
      onMentionSearch(query).then(done, () => done([]));
    }, SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [onMentionSearch, start, query]);

  /** Follows the text and the caret: opens, filters or closes the list. */
  function update() {
    const textarea = textareaRef.current;
    if (onMentionSearch === undefined || textarea === null) {
      return;
    }
    const { selectionStart, selectionEnd, value } = textarea;
    const next =
      selectionStart === selectionEnd ? mentionQueryAt(value, selectionStart) : undefined;
    if (next === undefined || next.start === dismissedStartRef.current) {
      if (next === undefined) {
        dismissedStartRef.current = null;
      }
      setSuggestions(null);
      return;
    }
    setSuggestions((current) =>
      current?.start === next.start && current.query === next.query
        ? current
        : {
            ...next,
            status: 'loading',
            // The previous results stay while the new ones load, so the list does not flicker.
            people: current?.start === next.start ? current.people : [],
            activeIndex: 0,
          },
    );
  }

  function close() {
    setSuggestions(null);
  }

  function choose(person: MentionCandidate) {
    if (suggestions === null) {
      return;
    }
    setSuggestions(null);
    onChoose(
      suggestions.start,
      suggestions.start + 1 + suggestions.query.length,
      mentionToken(person.id),
    );
  }

  /** The keys of an open list; `true` when the key was the list's. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (suggestions === null || event.nativeEvent.isComposing) {
      return false;
    }
    const count = suggestions.people.length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (count === 0) {
          return false;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setSuggestions({
          ...suggestions,
          activeIndex: (suggestions.activeIndex + step + count) % count,
        });
        break;
      }
      case 'Enter': {
        const person = suggestions.people[suggestions.activeIndex];
        if (person === undefined || event.shiftKey) {
          return false;
        }
        choose(person);
        break;
      }
      case 'Escape':
        dismissedStartRef.current = suggestions.start;
        close();
        break;
      default:
        return false;
    }
    // The list's keys move neither the caret nor reach a dialog around the editor.
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const isOpen = suggestions !== null;
  const optionId = (index: number) => `${listId}-${index}`;
  const activeOptionId =
    suggestions !== null && suggestions.people.length > 0
      ? optionId(suggestions.activeIndex)
      : undefined;

  return {
    textareaProps:
      onMentionSearch === undefined
        ? {}
        : {
            'aria-autocomplete': 'list' as const,
            'aria-controls': isOpen ? listId : undefined,
            'aria-activedescendant': activeOptionId,
          },
    update,
    close,
    handleKeyDown,
    listProps: { suggestions, listId, optionId, choose },
  };
}

/** The list of people to mention, anchored to the line of the `@`. */
export function MentionSuggestionList({
  textareaRef,
  suggestions,
  listId,
  optionId,
  choose,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  suggestions: Suggestions | null;
  listId: string;
  optionId: (index: number) => string;
  choose: (person: MentionCandidate) => void;
}) {
  const t = useTranslations('ui.markdownEditor');
  const isTabletOrWider = useMediaQuery(TABLET_MEDIA_QUERY);
  const start = suggestions?.start;
  // Escape hatch of §18.5: the positioner re-registers its anchor when the object changes, so it
  // changes with the `@` and is measured whenever the list is positioned (scrolling, typing).
  const anchor = useMemo(
    () =>
      start === undefined
        ? null
        : {
            getBoundingClientRect: () => {
              const textarea = textareaRef.current;
              return textarea === null ? new DOMRect() : lineRect(textarea, start);
            },
            get contextElement() {
              return textareaRef.current ?? undefined;
            },
          },
    [start, textareaRef],
  );
  const people = suggestions?.people ?? [];
  const status =
    suggestions === null
      ? ''
      : people.length > 0
        ? t('mentionCount', { count: people.length })
        : suggestions.status === 'loading'
          ? t('mentionSearching')
          : t('mentionNone');
  // Options take no focus: the textarea keeps it and the caret stays where the writer types.
  const keepFocus = (event: PointerEvent) => event.preventDefault();

  return (
    <>
      <span role="status" className="sr-only">
        {status}
      </span>
      <PopoverPrimitive.Root
        open={suggestions !== null}
        // The editor closes the list: Escape, blur and moving the caret away from the `@`.
        onOpenChange={() => undefined}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchor}
            // On phones the list opens above the line, so the on-screen keyboard never covers it.
            side={isTabletOrWider ? 'bottom' : 'top'}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="isolate z-50"
          >
            <PopoverPrimitive.Popup
              data-slot="mention-suggestions"
              initialFocus={false}
              finalFocus={false}
              onPointerDown={keepFocus}
              className="max-h-(--available-height) w-72 max-w-(--available-width) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            >
              <div id={listId} role="listbox" aria-label={t('mentionList')}>
                {people.map((person, index) => (
                  <div
                    key={person.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === suggestions?.activeIndex}
                    data-highlighted={index === suggestions?.activeIndex ? '' : undefined}
                    onClick={() => choose(person)}
                    className="flex min-h-11 cursor-default items-center justify-between gap-2 rounded-md px-2 py-1 select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span className="truncate">{person.displayName}</span>
                    <span
                      className={cn(
                        'shrink-0 text-xs text-muted-foreground',
                        index === suggestions?.activeIndex && 'text-accent-foreground',
                      )}
                    >
                      {person.userKind === 'team' ? t('mentionTeam') : t('mentionEndUser')}
                    </span>
                  </div>
                ))}
              </div>
              {people.length === 0 && (
                <p aria-hidden className="px-2 py-3 text-center text-muted-foreground">
                  {suggestions?.status === 'loading' ? t('mentionSearching') : t('mentionNone')}
                </p>
              )}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
