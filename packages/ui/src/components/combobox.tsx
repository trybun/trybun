'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { cn } from 'cn';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * A searchable choice from a long list (shadcn/ui Combobox on Base UI): the input filters the
 * `items` of the root as the person types. Adapted from base-nova: 44 px input and items on touch
 * devices, 16 px text below the desktop breakpoint (§2.9), theme tokens only.
 *
 * Two layouts: `ComboboxInput` in the page with `ComboboxItem` (a single choice), or a button
 * (`ComboboxTrigger`) that opens `ComboboxContent` with `ComboboxPopupInput` on top and
 * `ComboboxCheckboxItem` rows – the picker of several values (`multiple`).
 */
const Combobox = ComboboxPrimitive.Root;

/**
 * The input with a button that opens the list. Base UI keeps the button out of the tab order: the
 * keyboard opens the list from the input with the arrow keys.
 */
function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  const t = useTranslations('ui');
  return (
    <div data-slot="combobox-input-group" className={cn('relative w-full', className)}>
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-11 pl-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive dark:bg-input/30 xl:pointer-fine:h-8 xl:pointer-fine:pr-8 xl:pointer-fine:pl-2.5 xl:pointer-fine:text-sm"
        {...props}
      />
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 xl:pointer-fine:w-8"
      >
        <ChevronDownIcon aria-hidden className="pointer-events-none size-4" />
        <span className="sr-only">{t('combobox.show')}</span>
      </ComboboxPrimitive.Trigger>
    </div>
  );
}

/**
 * The button that opens the list when the input sits in the popup (`ComboboxPopupInput`). Render
 * it as a `Button` (`render={<Button variant="outline" />}`); it gets the focus back on close.
 * Base UI gives it the `combobox` role, which takes no name from its content: pass an
 * `aria-label` that contains the visible text (WCAG 2.5.3), or `aria-labelledby`. The popup then
 * has the `dialog` role and needs a name too – `aria-label` on `ComboboxContent`.
 */
function ComboboxTrigger(props: ComboboxPrimitive.Trigger.Props) {
  return <ComboboxPrimitive.Trigger data-slot="combobox-trigger" {...props} />;
}

function ComboboxContent({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, 'side' | 'align' | 'sideOffset'>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

/** The list of the matching items; it needs an accessible name (`aria-label`). */
function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        'max-h-72 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        'relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground xl:pointer-fine:min-h-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon aria-hidden className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/**
 * The search input at the top of `ComboboxContent`. Base UI moves the focus into it when the
 * popup opens with a mouse or the keyboard – on touch it focuses the popup instead, so the
 * on-screen keyboard does not cover the list until the person taps the input. It needs an
 * accessible name (`aria-label`). Unlike `ComboboxInput`, `className` goes to the input itself:
 * there is no button beside it.
 */
function ComboboxPopupInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div data-slot="combobox-popup-input-group" className="relative border-b border-border p-1">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground xl:pointer-fine:left-3.5"
      />
      <ComboboxPrimitive.Input
        data-slot="combobox-popup-input"
        className={cn(
          'h-11 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pr-3 pl-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 xl:pointer-fine:h-8 xl:pointer-fine:pl-8 xl:pointer-fine:text-sm',
          className,
        )}
        {...props}
      />
    </div>
  );
}

/**
 * An item of a multiple choice (`multiple` on the root): a checkbox-styled box before the label,
 * checked while the item is selected. The box is decorative – the list is `aria-multiselectable`
 * and every item carries `aria-selected`; the tick, not only the colour, shows the state. The box
 * follows `aria-selected`: the `data-selected` variant of shadcn's CSS wants `"true"`, Base UI
 * writes an empty attribute.
 */
function ComboboxCheckboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-checkbox-item"
      className={cn(
        'group/combobox-checkbox-item relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground xl:pointer-fine:min-h-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-slot="combobox-checkbox-item-box"
        className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-input text-primary-foreground transition-colors group-aria-selected/combobox-checkbox-item:border-primary group-aria-selected/combobox-checkbox-item:bg-primary dark:bg-input/30 dark:group-aria-selected/combobox-checkbox-item:bg-primary"
      >
        <ComboboxPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" />
        </ComboboxPrimitive.ItemIndicator>
      </span>
      {children}
    </ComboboxPrimitive.Item>
  );
}

/**
 * A polite live region in the popup for what the list cannot say itself: loading, "type to find
 * more". Keep it mounted and change only its children, so screen readers announce each change;
 * it hides itself while empty. An error with an action is an `Alert` instead.
 */
function ComboboxStatus({ className, ...props }: ComboboxPrimitive.Status.Props) {
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn(
        'px-2 py-3 text-center text-sm text-muted-foreground empty:hidden empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

/** Shown instead of the list when no item matches the input. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        'px-2 py-3 text-center text-sm text-muted-foreground empty:hidden empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxPopupInput,
  ComboboxList,
  ComboboxItem,
  ComboboxCheckboxItem,
  ComboboxStatus,
  ComboboxEmpty,
};
