// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push }) }));

const { useUnsavedChanges } = await import('./use-unsaved-changes.js');

/** What the router of Next.js keeps in the state of every entry it writes. */
const NEXT_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ['page'] } };

/** The popstate events that reach the listener of Next.js, which is not in the capture phase. */
let routerPops: unknown[] = [];
const onRouterPop = (event: PopStateEvent) => routerPops.push(event.state);

function isGuardEntry() {
  return (
    typeof window.history.state === 'object' &&
    window.history.state !== null &&
    '__trybunUnsavedChanges' in window.history.state
  );
}

function renderGuard(isDirty: boolean) {
  return renderHook((dirty: boolean) => useUnsavedChanges(dirty), { initialProps: isDirty });
}

/** Presses the browser's Back button and waits for its traversal. */
async function pressBack() {
  const href = window.location.href;
  const state: unknown = window.history.state;
  act(() => window.history.back());
  await waitFor(() =>
    expect(window.location.href !== href || window.history.state !== state).toBe(true),
  );
}

beforeEach(() => {
  // The page the person came from, and the page of the form, both written by Next.js.
  window.history.pushState({ ...NEXT_STATE, page: 'previous' }, '', '/tickets');
  window.history.pushState(NEXT_STATE, '', '/tickets/new');
  routerPops = [];
  window.addEventListener('popstate', onRouterPop);
});

afterEach(async () => {
  cleanup();
  // The guard takes its entry back after the last one is gone.
  await waitFor(() => expect(isGuardEntry()).toBe(false));
  window.removeEventListener('popstate', onRouterPop);
  push.mockReset();
});

describe('useUnsavedChanges', () => {
  it('adds no history entry while the text is saved, so Back leaves at once', async () => {
    const length = window.history.length;
    renderGuard(false);

    expect(window.history.length).toBe(length);
    await pressBack();
    expect(window.location.pathname).toBe('/tickets');
    expect(routerPops).toHaveLength(1);
  });

  it('asks when Back is pressed with typed text, and keeps the text and the question on stay', async () => {
    const length = window.history.length;
    const { result } = renderGuard(true);

    expect(window.history.length).toBe(length + 1);
    // A copy of the router's state, so the router can restore the page from either entry.
    expect(window.history.state).toMatchObject(NEXT_STATE);
    await pressBack();

    expect(result.current.isAsking).toBe(true);
    expect(window.location.pathname).toBe('/tickets/new');
    expect(routerPops).toHaveLength(0);

    act(() => result.current.stay());
    expect(result.current.isAsking).toBe(false);
    expect(isGuardEntry()).toBe(true);
    expect(window.history.length).toBe(length + 1);

    await pressBack();
    expect(result.current.isAsking).toBe(true);
    expect(routerPops).toHaveLength(0);
  });

  it('goes back past the page when the person leaves after Back', async () => {
    const { result } = renderGuard(true);
    await pressBack();

    act(() => result.current.leave());

    await waitFor(() => expect(window.location.pathname).toBe('/tickets'));
    expect(routerPops).toEqual([{ ...NEXT_STATE, page: 'previous' }]);
    expect(result.current.isAsking).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('takes its entry back without leaving when the text becomes saved', async () => {
    const { rerender } = renderGuard(true);
    expect(isGuardEntry()).toBe(true);

    rerender(false);

    await waitFor(() => expect(isGuardEntry()).toBe(false));
    expect(window.location.pathname).toBe('/tickets/new');
    expect(window.history.state).toEqual(NEXT_STATE);
    expect(routerPops).toHaveLength(0);
    await pressBack();
    expect(window.location.pathname).toBe('/tickets');
  });

  it('takes its entry back when the component unmounts, e.g. a closed editor', async () => {
    const { unmount } = renderGuard(true);

    unmount();

    await waitFor(() => expect(isGuardEntry()).toBe(false));
    expect(window.location.pathname).toBe('/tickets/new');
    expect(routerPops).toHaveLength(0);
  });

  it('navigates after a save without asking, once its entry is gone', async () => {
    const { result, rerender } = renderGuard(true);

    act(() => result.current.navigate('/tickets/ERP-12'));
    rerender(false);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tickets/ERP-12'));
    expect(isGuardEntry()).toBe(false);
    expect(result.current.isAsking).toBe(false);
    expect(routerPops).toHaveLength(0);
  });

  it('asks before a link of the application leaves, and follows it on leave', async () => {
    const { result } = renderGuard(true);
    const link = document.createElement('a');
    link.href = '/projects?view=list';
    link.textContent = 'Projects';
    document.body.append(link);

    act(() => link.click());
    expect(result.current.isAsking).toBe(true);
    act(() => result.current.leave());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/projects?view=list'));
    expect(isGuardEntry()).toBe(false);
    link.remove();
  });

  it('asks the browser before the tab closes with typed text, and not after a leave', async () => {
    const { result } = renderGuard(true);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await pressBack();
    act(() => result.current.leave());
    const afterLeave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterLeave);
    expect(afterLeave.defaultPrevented).toBe(false);
    await waitFor(() => expect(window.location.pathname).toBe('/tickets'));
  });

  it('keeps one entry for two components with typed text, the latest asking', async () => {
    const length = window.history.length;
    const first = renderGuard(true);
    const second = renderGuard(true);

    expect(window.history.length).toBe(length + 1);
    await pressBack();
    expect(second.result.current.isAsking).toBe(true);
    expect(first.result.current.isAsking).toBe(false);
    act(() => second.result.current.stay());
    expect(isGuardEntry()).toBe(true);
  });
});
