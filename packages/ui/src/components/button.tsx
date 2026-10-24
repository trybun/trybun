import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

// Touch targets are 44 px (§2.9); the compact sizes apply only on desktop with a precise pointer.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-11 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 xl:pointer-fine:h-8 xl:pointer-fine:px-2.5 xl:pointer-fine:has-data-[icon=inline-end]:pr-2 xl:pointer-fine:has-data-[icon=inline-start]:pl-2',
        xs: "h-11 gap-1 px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 xl:pointer-fine:h-6 xl:pointer-fine:rounded-md xl:pointer-fine:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 xl:pointer-fine:h-7 xl:pointer-fine:rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-11 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 xl:pointer-fine:h-9',
        icon: 'size-11 xl:pointer-fine:size-8',
        'icon-xs':
          "size-11 in-data-[slot=button-group]:rounded-lg xl:pointer-fine:size-6 xl:pointer-fine:rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-11 in-data-[slot=button-group]:rounded-lg xl:pointer-fine:size-7 xl:pointer-fine:rounded-md',
        'icon-lg': 'size-11 xl:pointer-fine:size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
