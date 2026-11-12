/**
 * Receipt scanning is switched off for now (owner report: on real receipts
 * the on-device OCR returns gibberish). The code is kept as-is; flip this
 * back to true once reading is reliable — every entry point checks it.
 */
export const RECEIPT_SCAN_ENABLED = false
