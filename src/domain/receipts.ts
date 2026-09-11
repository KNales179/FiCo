/**
 * Turns the raw text an on-device OCR pass reads off a receipt photo into
 * structured fields Fico can pre-fill a transaction with (Roadmap Phase 26
 * feedback — receipt scanning).
 *
 * The owner's rule for this feature: **never guess**. A field the parser
 * isn't confident about comes back `null` so the review screen can leave it
 * blank and visibly flag it, rather than silently filling in a wrong number
 * or — critically — defaulting the purchase date to "today" just because
 * that's when the photo was scanned.
 */

import { parseAmountToMinor } from './money'

export interface ReceiptLineItem {
  name: string
  quantity: number
  /** null when the parser found a name but couldn't confidently read a price. */
  priceMinor: number | null
}

export interface ReceiptParseResult {
  merchant: string | null
  /** ISO date (no time) — only set when unambiguous. Never "today" by default. */
  occurredAt: string | null
  totalMinor: number | null
  taxMinor: number | null
  items: ReceiptLineItem[]
  /** The OCR text this was parsed from, kept so a person can sanity-check it. */
  rawText: string
}

const MONEY = /(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s*$/

/** Pull the trailing money-looking number off a line, in minor units. */
const trailingAmountMinor = (line: string): number | null => {
  const match = MONEY.exec(line.trim())
  if (!match) return null
  const cleaned = match[1].replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '')
  return parseAmountToMinor(cleaned.replace(',', '.'))
}

const nonEmptyLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

// ---------------------------------------------------------------------------
// Total / tax
// ---------------------------------------------------------------------------

const TOTAL_KEYWORDS = /\b(grand\s*total|amount\s*due|total\s*due|total)\b/i
const SUBTOTAL_KEYWORD = /\bsub\s*-?\s*total\b/i
const TAX_KEYWORDS = /\b(vat|gst|tax)\b/i

const findLastMatch = (
  lines: string[],
  keyword: RegExp,
  exclude?: RegExp,
): number | null => {
  let found: number | null = null
  for (const line of lines) {
    if (keyword.test(line) && !(exclude && exclude.test(line))) {
      const amount = trailingAmountMinor(line)
      if (amount !== null) found = amount
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const toIsoDate = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  const fiveYearsOut = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000
  if (date.getTime() > fiveYearsOut) return null
  return date.toISOString().slice(0, 10)
}

const fullYear = (y: number) => (y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y)

/**
 * Finds a purchase date in the OCR text. Only returns a value when the
 * format is unambiguous (a 4-digit year in ISO order, or a month name) — a
 * bare numeric date like "05/06/2026" could be 5 June or 6 May depending on
 * locale, so it's treated as unread rather than guessed.
 */
const findDate = (lines: string[]): string | null => {
  for (const line of lines) {
    // YYYY-MM-DD or YYYY/MM/DD — unambiguous.
    const iso = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(line)
    if (iso) {
      const found = toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
      if (found) return found
    }

    // "5 Jan 2026", "Jan 5, 2026", "5 January 2026" — the month name disambiguates.
    const named =
      /(\d{1,2})\s+([A-Za-z]{3,9})[,.]?\s+(\d{2,4})/.exec(line) ??
      /([A-Za-z]{3,9})\s+(\d{1,2})[,.]?\s+(\d{2,4})/.exec(line)
    if (named) {
      const [, a, b, y] = named
      const monthWord = (/[A-Za-z]/.test(a) ? a : b).slice(0, 3).toLowerCase()
      const day = Number(/[A-Za-z]/.test(a) ? b : a)
      const month = MONTH_NAMES[monthWord]
      if (month) {
        const found = toIsoDate(fullYear(Number(y)), month, day)
        if (found) return found
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------

const looksLikeAddressOrPhone = (line: string) =>
  (line.match(/\d/g)?.length ?? 0) >= 6

/** The receipt header usually names the store in the first couple of lines. */
const findMerchant = (lines: string[]): string | null => {
  for (const line of lines.slice(0, 3)) {
    if (line.length < 2 || line.length > 40) continue
    if (!/[A-Za-z]/.test(line)) continue
    if (looksLikeAddressOrPhone(line)) continue
    if (TOTAL_KEYWORDS.test(line) || TAX_KEYWORDS.test(line)) continue
    return line
  }
  return null
}

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

const SKIP_LINE =
  /\b(total|subtotal|sub-total|tax|vat|gst|change|cash|card|balance|thank you|receipt|invoice|cashier|qty|quantity|date|time|payment|amount due|approved|reference|terminal)\b/i

const ITEM_LINE =
  /^(?:(\d+(?:\.\d+)?)\s*[xX]\s*)?(.{2,40}?)\s{1,}(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)\s*$/

/**
 * Best-effort line items. Conservative on purpose: a line has to look like
 * "name ... price" (optionally "2 x name ... price") to be treated as an
 * item at all — anything else (store hours, addresses, a header) is simply
 * not included, rather than added as a wrong guess. A name found without a
 * readable trailing price still becomes a row, with `priceMinor: null`, so
 * the person reviewing sees exactly what needs filling in.
 */
const findItems = (lines: string[]): ReceiptLineItem[] => {
  const items: ReceiptLineItem[] = []
  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue
    const match = ITEM_LINE.exec(line)
    if (!match) continue

    const [, qtyRaw, nameRaw, priceRaw] = match
    const name = nameRaw.trim()
    if (!name || !/[A-Za-z]/.test(name)) continue

    const cleanedPrice = priceRaw.replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '')
    const priceMinor = parseAmountToMinor(cleanedPrice.replace(',', '.'))
    const quantity = qtyRaw ? Math.max(1, Math.round(Number(qtyRaw))) : 1

    items.push({ name, quantity, priceMinor })
  }
  return items
}

/** Parse OCR text off a receipt photo into fields to pre-fill a transaction with. */
export const parseReceiptText = (rawText: string): ReceiptParseResult => {
  const lines = nonEmptyLines(rawText)

  return {
    merchant: findMerchant(lines),
    occurredAt: findDate(lines),
    totalMinor: findLastMatch(lines, TOTAL_KEYWORDS, SUBTOTAL_KEYWORD),
    taxMinor: findLastMatch(lines, TAX_KEYWORDS),
    items: findItems(lines),
    rawText,
  }
}
