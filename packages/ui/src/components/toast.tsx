'use client';

import { Toast as ToastPrimitive } from '@base-ui/react/toast';
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
import type { ReactNode } from 'react';

const toast = ToastPrimitive.createToastManager();

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

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ));
}

function Toaster({ children, toastManager = toast, ...props }: ToastPrimitive.Provider.Props) {
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

const createToastManager = ToastPrimitive.createToastManager;
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
