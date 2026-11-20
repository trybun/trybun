import { expect, type Page } from '@playwright/test';

/**
 * The router of Next.js in the browser, which it exposes once the page is hydrated – "for debugging
 * purposes" (`next/dist/esm/client/components/app-router-instance.js`, Next.js 16.4): a test aid,
 * never application code. A Next.js upgrade that drops it fails `navigateInApp()` on its first wait.
 */
interface WindowWithRouter {
  next?: { router?: { push(href: string): void } };
}

/**
 * Navigates inside the application without loading a document, as a `<Link>` does: through
 * `router.push()` of the Next.js router in the browser (`window.next.router`). An address no page
 * links to – a ticket that does not exist – is reached the way a link to a deleted record would
 * reach it (#404).
 */
export async function navigateInApp(page: Page, href: string): Promise<void> {
  await page.waitForFunction(() => (window as WindowWithRouter).next?.router !== undefined);
  const documents: string[] = [];
  const onDocument = (request: { resourceType(): string; url(): string }) => {
    if (request.resourceType() === 'document') {
      documents.push(request.url());
    }
  };
  page.on('request', onDocument);
  await page.evaluate((target) => {
    (window as WindowWithRouter).next?.router?.push(target);
  }, href);
  await expect(page).toHaveURL(href);
  page.off('request', onDocument);
  // A client-side navigation loads no document.
  expect(documents).toEqual([]);
}
