/** Lowercase, trim, collapse internal whitespace. Matches the server's rule. */
export const normalizeItemName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')
