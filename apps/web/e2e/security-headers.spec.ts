import { expect, type Page, test } from '@playwright/test';

/** The pages of the application: the team views, the help and the first-run wizard (§13.5). */
const PAGES = ['/', '/help', '/setup'];

/** Collects the Content Security Policy violations of the page from its first script on. */
async function recordViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

test.describe('security headers', () => {
  for (const path of PAGES) {
    test(`of ${path} include the CSP nonce, HSTS, nosniff and no framing`, async ({ page }) => {
      const violations = await recordViolations(page);

      const response = await page.goto(path);
      await page.waitForLoadState('networkidle');

      const headers = response?.headers() ?? {};
      const policy = headers['content-security-policy'] ?? '';
      expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]+=*' 'strict-dynamic'/);
      expect(policy).toContain("frame-ancestors 'none'");
      expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toContain('camera=()');
      // Next.js gives its scripts the nonce of the request, so the page runs without violations.
      // Browsers hide the attribute after parsing; the property keeps the value.
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
      expect(await violations()).toEqual([]);
      expect(
        await page.evaluate(
          (expected) => [...document.scripts].filter((script) => script.nonce === expected).length,
          nonce,
        ),
      ).toBeGreaterThan(0);
    });
  }

  test('use a new nonce for every response', async ({ page }) => {
    const nonces = [];
    for (let index = 0; index < 2; index += 1) {
      const response = await page.goto('/');
      nonces.push(
        /'nonce-([^']+)'/.exec(response?.headers()['content-security-policy'] ?? '')?.[1],
      );
    }

    expect(nonces[0]).toBeDefined();
    expect(nonces[0]).not.toBe(nonces[1]);
  });
});
