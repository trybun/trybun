'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { cn } from 'cn';
import { CheckIcon } from 'lucide-react';

// The box is 16 px; the `after` element extends the hit area to 44 px on phones and tablets
// (§2.9). On desktop with a precise pointer the box is the hit area. Inside a choice card – a
// `FieldLabel` around a `Field` – the whole card is the hit area and shows the focus; the card
// rules are important, because the group selector is weaker than `focus-visible:*`.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors outline-none group-has-[:focus-visible]/field-label:ring-0! group-has-[:focus-visible]/field-label:ring-offset-0! group-has-[:focus-visible]/field-label:not-data-checked:border-input! after:absolute after:-inset-4 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive aria-invalid:aria-checked:border-primary dark:bg-input/30 xl:pointer-fine:after:content-none data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
