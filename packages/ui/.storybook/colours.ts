// Colour helpers for the story tests: the computed value of a token and the WCAG 2 contrast ratio.

/** The computed `rgb()` value of a colour token, for comparing with computed styles. */
export function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// The relative luminance of WCAG 2 for an opaque computed `rgb(r, g, b)` value.
function luminance(rgb: string): number {
  const channels = rgb.match(/\d+(?:\.\d+)?/g);
  if (!channels || channels.length < 3) throw new Error(`Not an rgb() colour: ${rgb}`);
  const [r, g, b] = channels.slice(0, 3).map((value) => {
    const c = Number(value) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio of two colour tokens (1 to 21). */
export function tokenContrast(foreground: string, background: string): number {
  const [lighter, darker] = [
    luminance(tokenColor(foreground)),
    luminance(tokenColor(background)),
  ].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}
