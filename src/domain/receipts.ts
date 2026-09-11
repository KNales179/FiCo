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
  /** Positive magnitude already reflected in `totalMinor` — shown for reference, not subtracted again. */
  discountMinor: number | null
  /** The receipt's own printed item count (e.g. "ITEM/S PURCHASED : 8"), for
   *  cross-checking against how many rows actually got parsed below — not
   *  the same thing, and never used as a price. */
  itemCount: number | null
  items: ReceiptLineItem[]
  /** The OCR text this was parsed from, kept so a person can sanity-check it. */
  rawText: string
}

// Requires an explicit 2-digit cents suffix — a bare digit run ("02530" from
// a TIN, "8" from an item count) is common receipt boilerplate, not money,
// and real printed amounts almost always carry ".00".
const MONEY = /(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*$/

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
// A receipt's tax breakdown often lists "Vat Exempt Sale" / "Vatable Sale"
// alongside the real "VAT (12%)" line — none of those are the tax amount.
const TAX_EXCLUDE = /\b(exempt|zero[\s-]?rated|vatable)\b/i
const DISCOUNT_KEYWORDS = /\b(discount|promo)\b/i
const ITEM_COUNT_KEYWORDS = /\bitem.?s?\b/i

/** Trailing whole number — no decimal required, since a count is never money. */
const trailingInteger = (line: string): number | null => {
  const match = /(\d+)\s*$/.exec(line.trim())
  return match ? Number(match[1]) : null
}

/** The receipt's own printed item count, e.g. "ITEM/S PURCHASED : 8". */
const findItemCount = (lines: string[]): number | null => {
  for (const line of lines) {
    if (ITEM_COUNT_KEYWORDS.test(line) && !TOTAL_KEYWORDS.test(line)) {
      const count = trailingInteger(line)
      if (count !== null) return count
    }
  }
  return null
}

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

/** Sums every matching line rather than taking the last — a receipt can stack more than one promo/discount line. */
const sumMatches = (lines: string[], keyword: RegExp): number | null => {
  let sum: number | null = null
  for (const line of lines) {
    if (keyword.test(line)) {
      const amount = trailingAmountMinor(line)
      if (amount !== null) sum = (sum ?? 0) + amount
    }
  }
  return sum
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
  /\b(total|subtotal|sub-total|tax|vat|gst|discount|promo|change|cash|card|balance|thank you|receipt|invoice|cashier|qty|quantity|purchased|item.?s|date|time|payment|amount due|approved|reference|terminal|vatable|exempt|zero.rated|tin|permit|accredtn|invoice no)\b/i

// A serial/TIN/reference number is a long run of digits with no separators —
// six or more in a row is never a printed price (those break into groups of
// three with a comma, or carry two decimal places at most). Checked
// separately from SKIP_LINE's keyword list because these numbers show up
// next to labels this parser has never seen before.
const LOOKS_LIKE_A_CODE = /\d{6,}/

// Decimals are optional here (unlike `MONEY` above) — OCR noise sometimes
// drops a trailing digit or the decimal point itself, and losing a real
// item is worse than the rare reference number this doesn't otherwise catch
// (guarded against separately via `LOOKS_LIKE_A_CODE`).
const ITEM_LINE =
  /^(?:(\d+(?:\.\d+)?)\s*[xX]\s*)?(.{2,40}?)\s{1,}(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)\s*$/

/** A standalone "qty*unitPrice" line, printed above the item's name on some
 *  receipts (e.g. Philippine retail format: "3*15.000" then "EMBORG… 105.00"). */
const QTY_PRICE_LINE = /^(\d+(?:\.\d+)?)\s*[x×*]\s*\d+(?:[.,]\d+)?\s*$/i

/**
 * Best-effort line items. Conservative on purpose: a line has to look like
 * "name ... price" (optionally "2 x name ... price", or a standalone
 * "qty*price" line right before the name — a common receipt layout) to be
 * treated as an item at all. Anything else (store hours, an address, a
 * discount line) is simply not included, rather than added as a wrong
 * guess. A name found without a readable trailing price still becomes a
 * row, with `priceMinor: null`, so the person reviewing sees exactly what
 * needs filling in.
 */
const findItems = (lines: string[]): ReceiptLineItem[] => {
  const items: ReceiptLineItem[] = []
  let pendingQuantity: number | null = null

  for (const line of lines) {
    const qtyOnly = QTY_PRICE_LINE.exec(line)
    if (qtyOnly) {
      pendingQuantity = Math.max(1, Math.round(Number(qtyOnly[1])))
      continue
    }

    if (SKIP_LINE.test(line) || LOOKS_LIKE_A_CODE.test(line)) {
      pendingQuantity = null
      continue
    }

    const match = ITEM_LINE.exec(line)
    if (!match) continue

    const [, qtyRaw, nameRaw, priceRaw] = match
    const name = nameRaw.trim()
    if (!name || !/[A-Za-z]/.test(name)) continue

    const cleanedPrice = priceRaw.replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '')
    const priceMinor = parseAmountToMinor(cleanedPrice.replace(',', '.'))
    const quantity = qtyRaw
      ? Math.max(1, Math.round(Number(qtyRaw)))
      : pendingQuantity ?? 1
    pendingQuantity = null

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
    taxMinor: findLastMatch(lines, TAX_KEYWORDS, TAX_EXCLUDE),
    discountMinor: sumMatches(lines, DISCOUNT_KEYWORDS),
    itemCount: findItemCount(lines),
    items: findItems(lines),
    rawText,
  }
}
