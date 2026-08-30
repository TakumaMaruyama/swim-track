/** Removes Unicode whitespace only; all non-whitespace characters remain exact. */
export function normalizeFullName(value: string): string {
  return value.replace(/[\p{White_Space}\u200B]/gu, "");
}