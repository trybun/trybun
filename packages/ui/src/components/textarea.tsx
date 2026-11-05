import { Field as FieldPrimitive } from '@base-ui/react/field';
import { cn } from 'cn';
import type * as React from 'react';

// A Base UI `Field.Control` rendered as a textarea, so `FieldLabel`, `FieldDescription` and
// `FieldError` link to it like to `Input`. It grows with its content up to a maximum height, then
// scrolls; 16 px text on touch devices, so that iOS does not zoom in on focus (§2.9); the focus
// and invalid states are those of `Input`.
function Textarea({ className, value, defaultValue, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <FieldPrimitive.Control
      value={value}
      defaultValue={defaultValue}
      render={
        <textarea
          data-slot="textarea"
          className={cn(
            'flex field-sizing-content max-h-96 min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive dark:bg-input/30 dark:disabled:bg-input/80 xl:pointer-fine:px-2.5 xl:pointer-fine:py-2 xl:pointer-fine:text-sm',
            className,
          )}
          {...props}
        />
      }
    />
  );
}

export { Textarea };
