/**
 * The e-mail domains of a text with several, separated by commas, semicolons or spaces (Rule 2):
 * trimmed, without empty entries and repetitions. The API normalizes and checks each (§7.3).
 */
export function splitDomains(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((domain) => domain.trim())
        .filter((domain) => domain !== ''),
    ),
  ];
}
