// A browser driven over HTTP through Keycloak's pages (§18.7): it keeps cookies by path, as one
// Keycloak serves several realms whose cookies share names, and follows redirects until it leaves
// Keycloak for the web application.
import { WEB_URL } from './keycloak.js';

export interface Browser {
  /** Sends a GET, or a POST of a form, and follows redirects within Keycloak. */
  open(url: string, form?: Record<string, string>): Promise<Page>;
}

export interface Page {
  /** The last response: a page of Keycloak, or the redirect to the web application. */
  status: number;
  /** Where the browser was sent last, e.g. the callback of the web application with its code. */
  location: string | null;
  html: string;
  /** The action of the first form of the page. */
  formAction: string;
  /** The value of a hidden field of the page, e.g. `totpSecret`. */
  field(name: string): string | undefined;
}

export function browser(): Browser {
  /** Cookies by path and name. */
  const cookies = new Map<string, Map<string, string>>();

  function cookieHeader(url: URL): string {
    return [...cookies]
      .filter(([path]) => url.pathname.startsWith(path))
      .flatMap(([, byName]) => [...byName].map(([name, value]) => `${name}=${value}`))
      .join('; ');
  }

  function store(url: URL, response: Response): void {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = cookie.split(';');
      const index = pair.indexOf('=');
      const path =
        attributes
          .map((attribute) => attribute.trim())
          .find((attribute) => attribute.toLowerCase().startsWith('path='))
          ?.slice(5) ?? url.pathname.replace(/\/[^/]*$/, '/');
      const byName = cookies.get(path) ?? new Map<string, string>();
      byName.set(pair.slice(0, index), pair.slice(index + 1));
      cookies.set(path, byName);
    }
  }

  async function send(url: string, form?: Record<string, string>): Promise<Response> {
    const target = new URL(url);
    const response = await fetch(target, {
      method: form === undefined ? 'GET' : 'POST',
      redirect: 'manual',
      headers: { cookie: cookieHeader(target) },
      body: form === undefined ? undefined : new URLSearchParams(form),
    });
    store(target, response);
    return response;
  }

  return {
    async open(url, form) {
      let response = await send(url, form);
      let location = response.headers.get('location');
      while (location !== null && !location.startsWith(WEB_URL)) {
        await response.body?.cancel();
        response = await send(new URL(location, url).href);
        location = response.headers.get('location');
      }
      const html = await response.text();
      return {
        status: response.status,
        location,
        html,
        formAction: (/<form[^>]*action="([^"]+)"/.exec(html)?.[1] ?? '').replaceAll('&amp;', '&'),
        field: (name) =>
          new RegExp(`name="${name}"[^>]*value="([^"]*)"`).exec(html)?.[1] ??
          new RegExp(`value="([^"]*)"[^>]*name="${name}"`).exec(html)?.[1],
      };
    },
  };
}
