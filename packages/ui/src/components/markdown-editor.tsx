'use client';

import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar';
import { attachmentContentPath, type MentionedPerson } from '@trybun/markdown';
import { cn } from 'cn';
import {
  BoldIcon,
  CodeIcon,
  EllipsisIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PaperclipIcon,
  TextQuoteIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '../hooks/use-media-query.js';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import {
  escapeLinkText,
  filesInsert,
  type FormatAction,
  formatMarkdown,
  textEdit,
} from './markdown-editor-format.js';
import {
  MentionSuggestionList,
  useMentionSuggestions,
  type MentionCandidate,
  type MentionSearch,
} from './markdown-editor-mentions.js';
import { Markdown } from './markdown.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { Textarea } from './textarea.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.js';

/** An uploaded file the editor links in the text (ADR 0008). */
export interface AddedFile {
  id: string;
  name: string;
  isImage: boolean;
}

interface FormatButton {
  action: FormatAction;
  icon: LucideIcon;
  /** The key with Ctrl (Cmd on macOS), as `KeyboardEvent.code`; `undefined` for no shortcut. */
  code?: string;
  isShift?: boolean;
  /** Shown on phones; the others are in the "More formatting" menu (Rule 9). */
  isOnPhone: boolean;
}

// The toolbar of §6.2 in its order, with GitHub's shortcuts.
const FORMAT_BUTTONS: FormatButton[] = [
  { action: 'heading', icon: HeadingIcon, isOnPhone: false },
  { action: 'bold', icon: BoldIcon, code: 'KeyB', isOnPhone: true },
  { action: 'italic', icon: ItalicIcon, code: 'KeyI', isOnPhone: true },
  { action: 'quote', icon: TextQuoteIcon, code: 'Period', isShift: true, isOnPhone: false },
  { action: 'code', icon: CodeIcon, code: 'KeyE', isOnPhone: false },
  { action: 'link', icon: LinkIcon, code: 'KeyK', isOnPhone: true },
  { action: 'bulletedList', icon: ListIcon, code: 'Digit8', isShift: true, isOnPhone: true },
  {
    action: 'numberedList',
    icon: ListOrderedIcon,
    code: 'Digit7',
    isShift: true,
    isOnPhone: false,
  },
  { action: 'taskList', icon: ListTodoIcon, code: 'KeyL', isShift: true, isOnPhone: true },
];

const KEY_NAMES: Record<string, string> = {
  KeyB: 'B',
  KeyI: 'I',
  KeyE: 'E',
  KeyK: 'K',
  KeyL: 'L',
  Period: '.',
  Digit7: '7',
  Digit8: '8',
};

function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Whether shortcuts use Cmd (macOS, iOS) instead of Ctrl; Ctrl on the server. */
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    isApplePlatform,
    () => false,
  );
}

/** The shortcut for `aria-keyshortcuts` and the shortcut shown with a button. */
function shortcut({ code, isShift }: FormatButton, isApple: boolean) {
  if (code === undefined) {
    return undefined;
  }
  const key = KEY_NAMES[code] ?? code;
  return {
    aria: [isApple ? 'Meta' : 'Control', isShift ? 'Shift' : undefined, key]
      .filter(Boolean)
      .join('+'),
    label: isApple ? `${isShift ? '⇧' : ''}⌘${key}` : `Ctrl+${isShift ? 'Shift+' : ''}${key}`,
  };
}

/** Replaces a range without focusing the textarea: an upload that finishes while the writer is in
 * another field or the Preview tab must not move the focus or type there. No undo entry. */
function replaceRangeQuietly(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
  insert: string,
) {
  textarea.setRangeText(insert, start, end, 'preserve');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Replaces a range of the textarea like typing, so Ctrl+Z undoes it (§6.2). */
function replaceRange(textarea: HTMLTextAreaElement, start: number, end: number, insert: string) {
  textarea.focus();
  if (document.activeElement !== textarea) {
    replaceRangeQuietly(textarea, start, end, insert);
    return;
  }
  textarea.setSelectionRange(start, end);
  // `insertText` keeps the browser's undo history (as GitHub's markdown-toolbar-element does). An
  // empty insert deletes the selection, which `insertText` does not do in every browser.
  const isDone =
    insert === ''
      ? document.execCommand('delete', false)
      : document.execCommand('insertText', false, insert);
  if (!isDone) {
    // Fallback without undo: the `input` event updates the field's value.
    textarea.setRangeText(insert, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function linkMarkdown({ id, name, isImage }: AddedFile): string {
  return `${isImage ? '!' : ''}[${escapeLinkText(name)}](${attachmentContentPath(id)})`;
}

interface MarkdownEditorProps extends Omit<
  ComponentProps<'textarea'>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'ref'
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Marks the field invalid (`aria-invalid`), e.g. from the form's field state. */
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
  /** IDs of the attachments the preview shows as images (§13.3). */
  attachmentImageIds?: readonly string[];
  /**
   * Uploads files dropped, pasted or chosen with "Attach files" and returns, per file, the
   * uploaded attachment. Without it, the editor has no "Attach files" button and ignores files.
   */
  onFilesAdd?: (files: File[]) => Promise<AddedFile>[];
  /** The people whose tokens `@{<id>}` the preview shows as `@Name` (S1-12). */
  mentions?: ReadonlyArray<MentionedPerson>;
  /**
   * Searches the people to mention for the text typed after `@` (S1-12). With it, typing `@` at
   * the start or after whitespace opens a list of suggestions; choosing a person writes the token
   * `@{<id>}`. Without it, the editor suggests nobody.
   */
  onMentionSearch?: MentionSearch;
  /** Classes of the editor's outer element. */
  className?: string;
}

/**
 * The GFM editor of descriptions, comments and notes (§6.2): a textarea with a toolbar, keyboard
 * shortcuts and Write/Preview tabs, as on GitHub. Presentational (§18.6): uploading is the form's.
 */
function MarkdownEditor({
  value,
  defaultValue = '',
  onValueChange,
  invalid,
  ref,
  attachmentImageIds,
  onFilesAdd,
  mentions,
  onMentionSearch,
  className,
  disabled,
  readOnly,
  onKeyDown,
  onPaste,
  onDrop,
  onSelect,
  onBlur,
  ...props
}: MarkdownEditorProps) {
  const t = useTranslations('ui.markdownEditor');
  const isApple = useIsApplePlatform();
  const isTabletOrWider = useMediaQuery(TABLET_MEDIA_QUERY);
  const [ownValue, setOwnValue] = useState(defaultValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const text = value ?? ownValue;
  const mention = useMentionSuggestions({
    textareaRef,
    onMentionSearch: disabled === true || readOnly === true ? undefined : onMentionSearch,
    onChoose: (start, end, insert) => {
      const textarea = textareaRef.current;
      if (textarea !== null) {
        replaceRange(textarea, start, end, insert);
      }
    },
  });

  function change(next: string) {
    setOwnValue(next);
    onValueChange?.(next);
  }

  function format(action: FormatAction) {
    const textarea = textareaRef.current;
    if (textarea === null || disabled === true || readOnly === true) {
      return;
    }
    const before = textarea.value;
    const result = formatMarkdown(action, before, {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
    const edit = textEdit(before, result.text);
    replaceRange(textarea, edit.start, edit.end, edit.insert);
    textarea.setSelectionRange(result.selection.start, result.selection.end);
  }

  /** Replaces the first occurrence of a placeholder, keeping the writer's cursor. */
  function replacePlaceholder(placeholder: string, insert: string) {
    const textarea = textareaRef.current;
    const start = textarea?.value.indexOf(placeholder) ?? -1;
    if (textarea === null || start === -1) {
      return;
    }
    if (document.activeElement !== textarea) {
      replaceRangeQuietly(textarea, start, start + placeholder.length, insert);
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    const shift = (position: number) =>
      position > start ? position + insert.length - placeholder.length : position;
    replaceRange(textarea, start, start + placeholder.length, insert);
    textarea.setSelectionRange(shift(selectionStart), shift(selectionEnd));
  }

  function addFiles(files: File[]) {
    const textarea = textareaRef.current;
    if (onFilesAdd === undefined || textarea === null || files.length === 0) {
      return;
    }
    const placeholders = files.map(
      (file) => `[${escapeLinkText(t('uploading', { name: file.name }))}]()`,
    );
    const { selectionStart, selectionEnd } = textarea;
    replaceRange(
      textarea,
      selectionStart,
      selectionEnd,
      filesInsert(textarea.value, { start: selectionStart, end: selectionEnd }, placeholders),
    );
    onFilesAdd(files).forEach((upload, index) => {
      const placeholder = placeholders[index]!;
      upload.then(
        (file) => replacePlaceholder(placeholder, linkMarkdown(file)),
        () => replacePlaceholder(placeholder, ''),
      );
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (!event.defaultPrevented && mention.handleKeyDown(event)) {
      return;
    }
    const isModifier = isApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (event.defaultPrevented || !isModifier || event.altKey) {
      return;
    }
    // Letters by the character, as on GitHub, so Ctrl+B is Bold on every keyboard layout; the
    // shifted keys by their position, because Shift changes their character.
    const button = FORMAT_BUTTONS.find(({ code, isShift = false }) =>
      code?.startsWith('Key') === true && !isShift
        ? event.key.toLowerCase() === code.slice(3).toLowerCase() && !event.shiftKey
        : code === event.code && isShift === event.shiftKey,
    );
    if (button === undefined) {
      return;
    }
    // The shortcut edits this text only: Ctrl+K never reaches the command palette (§8.4, §18.5).
    event.preventDefault();
    event.stopPropagation();
    format(button.action);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    onPaste?.(event);
    const files = [...event.clipboardData.files];
    // Office applications put an image of a copied range next to its text: the text is pasted.
    const hasText = event.clipboardData.getData('text/plain') !== '';
    if (event.defaultPrevented || onFilesAdd === undefined || files.length === 0 || hasText) {
      return;
    }
    event.preventDefault();
    addFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    onDrop?.(event);
    if (event.defaultPrevented) {
      return;
    }
    const files = [...event.dataTransfer.files];
    if (files.length > 0) {
      // Without onFilesAdd the files are ignored, instead of the browser opening them.
      event.preventDefault();
      addFiles(files);
    }
  }

  const visibleButtons = FORMAT_BUTTONS.filter(({ isOnPhone }) => isTabletOrWider || isOnPhone);
  const menuButtons = FORMAT_BUTTONS.filter(({ isOnPhone }) => !isTabletOrWider && !isOnPhone);

  return (
    <div data-slot="markdown-editor" className={cn('flex w-full flex-col', className)}>
      <Tabs value={tab} onValueChange={(next: 'write' | 'preview') => setTab(next)}>
        <div className="flex flex-col-reverse gap-1 md:flex-row md:items-end md:justify-between">
          <TabsList className="md:w-auto">
            <TabsTrigger value="write">{t('write')}</TabsTrigger>
            <TabsTrigger value="preview">{t('preview')}</TabsTrigger>
          </TabsList>
          {tab === 'write' && (
            <ToolbarPrimitive.Root
              aria-label={t('toolbar')}
              disabled={disabled === true || readOnly === true}
              className="-mx-1 flex flex-wrap items-center gap-0.5 md:mx-0"
            >
              {visibleButtons.map((button) => {
                const keys = shortcut(button, isApple);
                const Icon = button.icon;
                return (
                  <Tooltip key={button.action}>
                    <TooltipTrigger
                      render={
                        <ToolbarPrimitive.Button
                          render={<Button type="button" variant="ghost" size="icon" />}
                          aria-label={t(button.action)}
                          aria-keyshortcuts={keys?.aria}
                          onClick={() => format(button.action)}
                        />
                      }
                    >
                      <Icon aria-hidden />
                    </TooltipTrigger>
                    <TooltipContent>
                      {keys === undefined
                        ? t(button.action)
                        : `${t(button.action)} (${keys.label})`}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {menuButtons.length > 0 && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <ToolbarPrimitive.Button
                          render={
                            <DropdownMenuTrigger
                              render={<Button type="button" variant="ghost" size="icon" />}
                            />
                          }
                          aria-label={t('moreFormatting')}
                        />
                      }
                    >
                      <EllipsisIcon aria-hidden />
                    </TooltipTrigger>
                    <TooltipContent>{t('moreFormatting')}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-auto">
                    {menuButtons.map((button) => {
                      const Icon = button.icon;
                      const keys = shortcut(button, isApple);
                      return (
                        <DropdownMenuItem
                          key={button.action}
                          aria-keyshortcuts={keys?.aria}
                          onClick={() => format(button.action)}
                        >
                          <Icon aria-hidden />
                          {t(button.action)}
                          {keys !== undefined && (
                            <DropdownMenuShortcut>{keys.label}</DropdownMenuShortcut>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {onFilesAdd !== undefined && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ToolbarPrimitive.Button
                        render={<Button type="button" variant="ghost" size="icon" />}
                        aria-label={t('attachFiles')}
                        onClick={() => fileInputRef.current?.click()}
                      />
                    }
                  >
                    <PaperclipIcon aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent>{t('attachFiles')}</TooltipContent>
                </Tooltip>
              )}
            </ToolbarPrimitive.Root>
          )}
        </div>
        <TabsContent value="write" keepMounted className="pt-1">
          <Textarea
            ref={(element: HTMLTextAreaElement | null) => {
              textareaRef.current = element;
              if (typeof ref === 'function') {
                ref(element);
              } else if (ref) {
                ref.current = element;
              }
            }}
            value={text}
            onChange={(event) => {
              change(event.currentTarget.value);
              mention.update();
            }}
            onSelect={(event) => {
              onSelect?.(event);
              mention.update();
            }}
            onBlur={(event) => {
              onBlur?.(event);
              mention.close();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={invalid === true ? true : undefined}
            {...mention.textareaProps}
            {...props}
          />
          <MentionSuggestionList textareaRef={textareaRef} {...mention.listProps} />
        </TabsContent>
        <TabsContent value="preview" className="min-h-24 pt-3">
          {text.trim() === '' ? (
            <p className="text-muted-foreground">{t('nothingToPreview')}</p>
          ) : (
            <Markdown attachmentImageIds={attachmentImageIds} mentions={mentions}>
              {text}
            </Markdown>
          )}
        </TabsContent>
      </Tabs>
      {onFilesAdd !== undefined && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            addFiles([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
      )}
    </div>
  );
}

export { MarkdownEditor };
export type { MarkdownEditorProps, MentionCandidate, MentionSearch };
