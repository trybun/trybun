'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from 'cn';

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

// The list scrolls horizontally on narrow screens instead of wrapping.
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex w-full items-center justify-start overflow-x-auto border-b border-border',
        className,
      )}
      {...props}
    />
  );
}

// Triggers are 44 px touch targets (§2.9); compact only on desktop with a precise pointer.
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex h-11 shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 xl:pointer-fine:h-8 data-active:border-primary data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
