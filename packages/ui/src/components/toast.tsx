'use client';

import {
  Toast as ToastPrimitive,
  type ToastManager as BaseToastManager,
} from '@base-ui/react/toast';
import { cn } from 'cn';

import { Button } from '@trybun/ui/components/button';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import {
  XIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

type ToastManager = BaseToastManager<object>;
type ToastOptions = Parameters<ToastManager['add']>[0];

/** The toasts added while no `Toaster` listens to their manager, and the listening toasters. */
interface ToastQueue {
  manager: ToastManager;
  toasters: number;
  pending: { options: ToastOptions & { id: string }; queuedAt: number }[];
}

/** A toast still waiting for a toaster after this long belongs to a page that has none; dropped. */
const PENDING_TOAST_MAX_AGE_MS = 10_000;

/** By manager; keyed by `object`, as the `Toaster` receives a manager of any data type. */
const queues = new WeakMap<object, ToastQueue>();
let pendingIds = 0;

/**
 * A toast manager that keeps the toasts added before a `Toaster` listens and shows them when it
 * does. Base UI's manager only passes a toast to the toasters listening at that moment, and the
 * toaster of the app mounts after the first paint (`LazyToaster`): an action right after the page
 * appeared – on a slow phone, its confirmation with **Undo** – would otherwise lose its toast.
 */
function createToastManager(): ToastManager {
  const manager = ToastPrimitive.createToastManager<object>();
  const queue: ToastQueue = { manager, toasters: 0, pending: [] };
  const queued: ToastManager = {
    ...manager,
    add: (options) => {
      if (queue.toasters > 0) {
        return manager.add(options);
      }
      pendingIds += 1;
      const id = options.id ?? `toast-pending-${pendingIds}`;
      queue.pending.push({ options: { ...options, id }, queuedAt: Date.now() });
      return id;
    },
    close: (id) => {
      queue.pending =
        id === undefined ? [] : queue.pending.filter((item) => item.options.id !== id);
      manager.close(id);
    },
    update: (id, updates) => {
      queue.pending = queue.pending.map((item) =>
        item.options.id === id
          ? {
              ...item,
              options: {
                ...item.options,
                ...(typeof updates === 'function'
                  ? updates(item.options as Parameters<typeof updates>[0])
                  : updates),
              },
            }
          : item,
      );
      manager.update(id, updates);
    },
  };
  queues.set(queued, queue);
  return queued;
}

const toast = createToastManager();

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

// Above the dialogs, drawers and popups (z-50): their portals come later in the document, so at the
// same layer the bottom sheet of a phone covers a toast added from it (#172). Below the tablet
// breakpoint, where overlays are bottom sheets, the toasts sit at the top below the header, so they
// never cover the actions of a sheet (#207); from the tablet breakpoint up, at the bottom right.
function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'pointer-events-none fixed inset-x-4 top-18 z-60 mx-auto w-auto max-w-sm outline-none md:top-auto md:right-4 md:bottom-4 md:left-auto md:mx-0 md:w-full',
        className,
      )}
      {...props}
    />
  );
}

// `--stack` is the direction the stack grows in: down from the top on phones, up from the bottom
// from the tablet breakpoint up. Swiping towards the nearest edge dismisses a toast.
function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      swipeDirection={isSheet ? ['up', 'right'] : ['down', 'right']}
      className={cn(
        'group/toast pointer-events-auto absolute top-0 right-0 z-[calc(1000-var(--toast-index))] w-full origin-top rounded-2xl border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring md:top-auto md:bottom-0 md:origin-bottom',
        '[--gap-bleed:calc(var(--gap)+1px)] [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc((var(--toast-offset-y)+var(--toast-index)*var(--gap))*var(--stack)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [--stack:1] md:[--stack:-1]',
        'h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--peek)+var(--shrink)*var(--height))*var(--stack)))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]',
        "after:absolute after:bottom-full after:left-0 after:h-(--gap-bleed) after:w-full after:content-[''] md:after:top-full md:after:bottom-auto",
        'data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]',
        'data-limited:opacity-0 data-starting-style:[transform:translateY(calc(var(--stack)*-150%))]',
        '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(calc(var(--stack)*-150%))]',
        'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        'data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        className,
      )}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        'flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('text-sm font-medium', className)}
      {...props}
    />
  );
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  const t = useTranslations('ui');
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label={t('toast.close')}
      render={render}
      className={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}

// The icon repeats the type of the toast, never the only cue: the title says it in words (§13.4).
function ToastIcon({ type }: { type: string | undefined }) {
  let icon: ReactNode = null;

  if (type === 'success') {
    icon = <CircleCheckIcon className="text-success" aria-hidden="true" />;
  }

  if (type === 'info') {
    icon = <InfoIcon className="text-info" aria-hidden="true" />;
  }

  if (type === 'warning') {
    icon = <TriangleAlertIcon className="text-warning" aria-hidden="true" />;
  }

  if (type === 'error') {
    icon = <OctagonXIcon className="text-destructive" aria-hidden="true" />;
  }

  if (type === 'loading') {
    icon = <Loader2Icon className="animate-spin" aria-hidden="true" />;
  }

  if (!icon) {
    return null;
  }

  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  );
}

// Pressing the action – Undo, as a rule – closes its toast at once (the snackbar convention, like
// Sonner's default): the action is done, and a second press must not repeat it. Base UI leaves the
// toast open; while it closes, its button stays in place until the exit motion ends, so it is
// disabled for that time.
function ToastList() {
  const { toasts, close } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction
          disabled={toastItem.transitionStatus === 'ending'}
          onClick={() => close(toastItem.id)}
        />
        <ToastClose />
      </ToastContent>
    </Toast>
  ));
}

function Toaster({ children, toastManager = toast, ...props }: ToastPrimitive.Provider.Props) {
  // After the effect of the provider, which subscribes to the manager: a parent's effects run
  // after its children's.
  useEffect(() => {
    const queue = queues.get(toastManager);
    if (queue === undefined) {
      return;
    }
    queue.toasters += 1;
    const pending = queue.pending;
    queue.pending = [];
    const now = Date.now();
    for (const { options, queuedAt } of pending) {
      if (now - queuedAt <= PENDING_TOAST_MAX_AGE_MS) {
        queue.manager.add(options);
      }
    }
    return () => {
      queue.toasters -= 1;
    };
  }, [toastManager]);
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

const useToastManager = ToastPrimitive.useToastManager;

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
};
