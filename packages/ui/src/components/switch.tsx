'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from 'cn';

// The track is 24 px high; the `after` element extends the hit area to 44 px on phones and
// tablets (§2.9). On desktop with a precise pointer the track is the hit area.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 xl:pointer-fine:after:content-none data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-[1.375rem]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
