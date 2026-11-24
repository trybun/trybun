// Set-up file of the unit and component tests: in the DOM tests, TanStack Query notifies its
// observers inside React's `act()` (#496).
//
// By default `notifyManager` runs the batch of observer notifications in a `setTimeout(0)`, which
// may come after the `act()` of a test: a check right after a refetch then sees the render before
// it – an outcome that should appear is missing, one that must not appear is missing anyway, and the
// test passes or fails by timing. The documentation of `notifyManager` names both settings below
// for this: the batch runs in a microtask, which `act()` flushes, and each notification is wrapped
// in `act()`, so React renders the outcome and runs its effects before the check.
//
// Tests in the Node environment read queries without rendering anything and keep the defaults.
import { notifyManager } from '@tanstack/react-query';

if (typeof document !== 'undefined') {
  const { act } = await import('@testing-library/react');
  notifyManager.setScheduler(queueMicrotask);
  notifyManager.setNotifyFunction((callback) => {
    act(callback);
  });
}
