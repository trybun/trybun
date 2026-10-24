import { expect, test } from '@playwright/test';

/** A rendered component of @trybun/ui: its `data-slot` and whether it holds a memo cache. */
interface RenderedComponent {
  slot: string;
  isCompiled: boolean;
}

declare global {
  interface Window {
    reactRoots?: Set<{ current: Fiber }>;
  }
}

/** The fields of a React fiber that React DevTools reads to mark a component as compiled. */
interface Fiber {
  type: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  memoizedProps: Record<string, unknown> | null;
  updateQueue: { memoCache?: unknown } | null;
}

// `@trybun/ui` is consumed as source, so the build of the web application has to compile it with
// the React Compiler (§18.5). React DevTools marks a component as compiled (✨) when its fiber
// holds the memo cache of `react/compiler-runtime`; this test reads the same field through the
// DevTools hook.
test('compiles the components of @trybun/ui with the React Compiler', async ({ page }) => {
  await page.addInitScript(() => {
    const roots = new Set<{ current: Fiber }>();
    window.reactRoots = roots;
    Object.assign(window, {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        supportsFiber: true,
        renderers: new Map(),
        inject: () => 1,
        onCommitFiberRoot: (_id: number, root: { current: Fiber }) => roots.add(root),
        onCommitFiberUnmount: () => undefined,
        onPostCommitFiberRoot: () => undefined,
        checkDCE: () => undefined,
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

  const components = await page.evaluate(() => {
    const found: RenderedComponent[] = [];
    for (const root of window.reactRoots ?? []) {
      const fibers: (Fiber | null)[] = [root.current];
      for (let fiber = fibers.pop(); fiber !== undefined; fiber = fibers.pop()) {
        if (fiber === null) {
          continue;
        }
        // A component of @trybun/ui renders its primitive with its `data-slot` (§18.6); a
        // primitive that passes the `data-slot` it received on to its own child is not one.
        const slot = fiber.child?.memoizedProps?.['data-slot'];
        const isUiComponent =
          typeof fiber.type === 'function' &&
          typeof slot === 'string' &&
          fiber.memoizedProps?.['data-slot'] !== slot;
        if (isUiComponent) {
          found.push({ slot, isCompiled: fiber.updateQueue?.memoCache != null });
        }
        fibers.push(fiber.child, fiber.sibling);
      }
    }
    return found;
  });

  expect(components).toContainEqual({ slot: 'button', isCompiled: true });
  expect(components.filter((component) => !component.isCompiled)).toEqual([]);
});
