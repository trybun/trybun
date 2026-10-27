/** The longest key the creation form suggests; a person may type up to 10 characters (§3.1). */
const SUGGESTED_KEY_MAX_LENGTH = 4;

/**
 * The key the creation form suggests for a project name (Q7 of the projects specification,
 * following Jira): the initials of the words for a name of several words, otherwise the first
 * letters, upper case, at most 4 characters. Letters with diacritics lose them; a key starts with
 * a letter, so leading digits are dropped, and initials shorter than the 2 characters of a key
 * give way to the first letters of the first word that starts with a letter. The API still checks
 * the key.
 */
export function suggestKey(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word !== '');
  const key = (words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? ''))
    .replace(/^[0-9]+/, '')
    .slice(0, SUGGESTED_KEY_MAX_LENGTH);
  if (key.length >= 2) {
    return key;
  }
  const firstWord = words.find((word) => /^[A-Z]/.test(word)) ?? key;
  return firstWord.slice(0, SUGGESTED_KEY_MAX_LENGTH);
}

/** What the key field shows while a person types: upper case, only letters and digits. */
export function normalizeKeyInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
