# Focus colour preview – console snippet

Supports the change specification [`2026-11-01-brand-interactive-colour.md`](../implemented/2026-11-01-brand-interactive-colour.md).

1. Start the local environment (`sh .ai/scripts/test-env-up.sh` or `pnpm dev`) and sign in on <http://localhost:3000>.
2. Open DevTools (F12) → **Console**. Chrome asks you to type `allow pasting` the first time.
3. Paste the snippet below and press Enter. A panel appears at the bottom left: **Kolor** (colour variant), **Grubość** (thickness), **Motyw** (light or dark theme).
4. Press **Tab** to move the keyboard focus. The panel's buttons never take the focus.

The snippet only overrides CSS in this tab; it uses a constructable style sheet, which the page's CSP allows. A page reload removes it. Inside the application, navigating between pages keeps it.

```js
// Trybun – podgląd wariantów koloru fokusu (#177). Wklej w konsoli DevTools na http://localhost:3000.
(() => {
  const COLORS = {
    'Obecny (Ink)': ['#141a2e', '#ffffff'],
    'Stary (Vermilion)': ['#b8341c', '#e0482c'],
    'A Błękit': ['#2563eb', '#60a5fa'],
    'B Morski': ['#0f766e', '#2dd4bf'],
    'C Indygo': ['#4f46e5', '#a5b4fc'],
  };
  const WIDTHS = ['3 px (obecnie)', '2 px (ramka + 1 px)', '2 px z odstępem'];
  const state = { color: 'A Błękit', width: '2 px (ramka + 1 px)', dark: false };
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const RING = '[class*="focus-visible:ring-3"]:focus-visible, [class*="has-[:focus-visible]:ring-3"]:has(:focus-visible)';
  const FIELD = ':is(input, textarea, [role=combobox])[class*="focus-visible:border-ring"]:focus-visible:not([aria-invalid=true])';
  const shadow = (w) => `var(--tw-ring-inset,) 0 0 0 calc(${w} + var(--tw-ring-offset-width, 0px)) var(--tw-ring-color, currentcolor) !important`;
  function apply() {
    const [light, dark] = COLORS[state.color];
    let css = `:root { --ring: ${light} !important; } .dark { --ring: ${dark} !important; }`;
    if (state.width === WIDTHS[1]) css += `${RING} { --tw-ring-shadow: ${shadow('1px')}; }`;
    if (state.width === WIDTHS[2])
      css += `${RING} { --tw-ring-offset-width: 2px !important; --tw-ring-offset-shadow: var(--tw-ring-inset,) 0 0 0 2px var(--background) !important; --tw-ring-shadow: ${shadow('2px')}; }
        ${FIELD} { border-color: var(--input) !important; }`;
    css += `#tb-preview { position: fixed; z-index: 2147483647; left: 8px; bottom: 8px; display: flex; flex-direction: column; gap: 6px;
        padding: 10px; border-radius: 12px; background: #fff; color: #141a2e; font: 12px/1.3 system-ui, sans-serif;
        box-shadow: 0 4px 20px rgb(0 0 0 / 25%); max-width: calc(100vw - 16px); }
      #tb-preview div { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
      #tb-preview b { width: 58px; }
      #tb-preview button { padding: 4px 8px; border: 1px solid #8a8c96; border-radius: 6px; background: #fff; color: #141a2e; cursor: pointer; }
      #tb-preview button[aria-pressed=true] { background: #141a2e; color: #fff; }
      #tb-preview i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }`;
    sheet.replaceSync(css);
    document.documentElement.classList.toggle('dark', state.dark);
    render();
  }
  const panel = document.createElement('div');
  panel.id = 'tb-preview';
  function row(label, options, key, swatch) {
    const r = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = label;
    r.append(b);
    for (const o of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1;
      if (swatch) {
        const dot = document.createElement('i');
        dot.style.background = COLORS[o][state.dark ? 1 : 0];
        btn.append(dot);
      }
      btn.append(String(o));
      btn.setAttribute('aria-pressed', String(state[key] === (key === 'dark' ? o === 'Ciemny' : o)));
      btn.onmousedown = (e) => e.preventDefault();
      btn.onclick = () => {
        state[key] = key === 'dark' ? o === 'Ciemny' : o;
        apply();
      };
      r.append(btn);
    }
    return r;
  }
  function render() {
    panel.replaceChildren(
      row('Kolor', Object.keys(COLORS), 'color', true),
      row('Grubość', WIDTHS, 'width'),
      row('Motyw', ['Jasny', 'Ciemny'], 'dark'),
    );
  }
  document.getElementById('tb-preview')?.remove();
  document.body.append(panel);
  apply();
})();
```
