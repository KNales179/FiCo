import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useMutationContext } from '../../hooks/useMutationContext'
import {
  parseReceiptText,
  type ReceiptLineItem,
  type ReceiptParseResult,
} from '../../domain/receipts'
import { recognizeReceiptText } from '../../features/receipts/ocr'
import { recordScannedReceipt } from '../../features/receipts'
import { suggestForName } from '../../features/items'
import { addAttachment } from '../../features/attachments'
import { formatMoney, parseAmountToMinor } from '../../domain/money'
import { Button, Card, Input } from '../ui'
import ItemRowsEditor from './ItemRowsEditor'
import {
  newBlankItem,
  sumItemPricesMinor,
  toScannedReceiptItems,
  type DraftItem,
} from './draftItems'

/** A field the scan couldn't read gets a visible amber ring, never a guess. */
const flagged = (value: string) =>
  value.trim() === '' ? 'ring-2 ring-warning/60 border-warning' : ''

/**
 * Upload one or more receipt photos and have Fico read them (Roadmap Phase
 * 26 feedback). OCR runs entirely on this device (Tesseract.js); anything it
 * can't read confidently — including the purchase date — is left blank and
 * flagged rather than guessed, so the person always confirms before saving.
 * Each item keeps its own specific category (suggested from past purchases
 * of that item, never invented). The amount recorded is the running sum of
 * the item rows — the same rule a manually completed shopping trip uses —
 * so it updates live as rows are fixed up or added.
 */
const ScanReceipt = () => {
  const { accounts, defaultAccount, categories, canEdit, refresh } =
    useMoney()
  const { ctx } = useMutationContext()
  const fileInput = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<'idle' | 'reading' | 'review' | 'saving'>(
    'idle',
  )
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [discountMinor, setDiscountMinor] = useState<number | null>(null)
  /** The receipt's own printed count — cross-checked against the item rows, never used to compute the amount. */
  const [printedItemCount, setPrintedItemCount] = useState<number | null>(
    null,
  )
  /** The exact text the OCR pass produced — shown so a mis-read can be
   *  reported precisely instead of guessed at from the parsed result. */
  const [rawText, setRawText] = useState('')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  /** True while `amount` is following the item-price sum automatically; a
   *  manual edit turns this off so typing doesn't get clobbered. */
  const [amountAuto, setAmountAuto] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  /** Several photos picked at once (Roadmap Phase 26 feedback) — each is its
   *  own receipt/transaction, reviewed one at a time. */
  const [queue, setQueue] = useState<File[]>([])
  const [queueIndex, setQueueIndex] = useState(0)

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )
  const itemTypeCount = items.length
  const itemPieceCount = useMemo(
    () => items.reduce((n, r) => n + (Number(r.quantity) || 0), 0),
    [items],
  )
  const computedTotalMinor = useMemo(() => sumItemPricesMinor(items), [items])
  // The amount field follows the item-price sum until the person types
  // something different themselves — computed at render time so it can
  // never lag a stale effect by a tick.
  const displayedAmount = amountAuto
    ? computedTotalMinor > 0
      ? (computedTotalMinor / 100).toFixed(2)
      : ''
    : amount

  if (!canEdit || activeAccounts.length === 0) return null

  const reset = () => {
    setOpen(false)
    setStage('idle')
    setError('')
    setPhoto(null)
    setDiscountMinor(null)
    setPrintedItemCount(null)
    setRawText('')
    setTitle('')
    setDate('')
    setAmount('')
    setAmountAuto(true)
    setItems([])
    setQueue([])
    setQueueIndex(0)
    if (fileInput.current) fileInput.current.value = ''
  }

  /** Suggest a category per item from what Fico already knows about it —
   *  reusing a past decision, never guessing a new one. */
  const toDraftItems = async (
    spaceId: string,
    parsedItems: ReceiptLineItem[],
  ): Promise<DraftItem[]> =>
    Promise.all(
      parsedItems.map(async (item, i) => {
        const suggestion = await suggestForName(spaceId, item.name)
        // The receipt prints this line's total, not a per-unit price — the
        // item row now edits a unit price (quantity × price is what gets
        // recorded), so back it out here. Exact whenever the total divides
        // evenly by the quantity, which real per-unit pricing almost always
        // does; reviewable and editable either way before saving.
        const unitMinor =
          item.priceMinor != null
            ? Math.round(item.priceMinor / item.quantity)
            : null
        return {
          id: i,
          name: item.name,
          quantity: String(item.quantity),
          price: unitMinor != null ? (unitMinor / 100).toFixed(2) : '',
          categoryId: suggestion?.categoryId ?? '',
        }
      }),
    )

  const loadReceipt = async (file: File) => {
    if (!ctx) return
    setError('')
    setPhoto(file)
    setStage('reading')
    try {
      const text = await recognizeReceiptText(file)
      const parsed: ReceiptParseResult = parseReceiptText(text)
      setTitle(parsed.merchant ?? '')
      setDate(parsed.occurredAt ?? '')
      setDiscountMinor(parsed.discountMinor)
      setPrintedItemCount(parsed.itemCount)
      setRawText(parsed.rawText)
      setItems(await toDraftItems(ctx.spaceId, parsed.items))
      setAmountAuto(true)
      setAccountId(defaultAccount?.id ?? activeAccounts[0].id)
      setStage('review')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read that image',
      )
      setStage('idle')
    }
  }

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0 || !ctx) return
    setQueue(files)
    setQueueIndex(0)
    await loadReceipt(files[0])
  }

  /** Move to the next queued photo, or close out once they're all done. */
  const advanceQueue = async () => {
    const next = queueIndex + 1
    if (next < queue.length) {
      setQueueIndex(next)
      await loadReceipt(queue[next])
    } else {
      reset()
    }
  }

  const updateItem = (id: number, patch: Partial<DraftItem>) =>
    setItems((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )

  const removeItem = (id: number) =>
    setItems((rows) => rows.filter((r) => r.id !== id))

  const addBlankItem = () => setItems((rows) => [...rows, newBlankItem(rows)])

  const save = async () => {
    setError('')

    const amountMinor = parseAmountToMinor(displayedAmount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Add at least one priced item, or enter the total by hand')
      return
    }
    if (!date) {
      setError("Enter the purchase date — it wasn't readable on the receipt")
      return
    }
    if (!title.trim()) {
      setError("Enter who this was paid to — it wasn't readable on the receipt")
      return
    }
    if (!ctx) {
      setError('No active space')
      return
    }

    setStage('saving')
    try {
      const { transaction } = await recordScannedReceipt(ctx, {
        accountId: accountId || defaultAccount?.id || activeAccounts[0].id,
        title,
        occurredAt: new Date(date).toISOString(),
        amountMinor,
        items: toScannedReceiptItems(items, categoryNameById),
      })

      if (photo) {
        await addAttachment(ctx, {
          entityType: 'TRANSACTION',
          entityId: transaction.id,
          file: photo,
        })
      }

      await refresh()
      await advanceQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('review')
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>📷 Scan a receipt</Button>
    )
  }

  const inQueue = queue.length > 1

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="section-title">
          Scan a receipt
          {inQueue && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({queueIndex + 1} of {queue.length})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted underline hover:text-ink"
        >
          cancel
        </button>
      </div>

      {stage === 'idle' && (
        <div className="mt-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => void onPick(e)}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            Reading happens on this device — the photo isn't sent anywhere.
            Pick more than one to go through several receipts (different
            stores, same trip) one after another.
          </p>
        </div>
      )}

      {stage === 'reading' && (
        <p className="mt-3 muted">Reading the receipt…</p>
      )}

      {(stage === 'review' || stage === 'saving') && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Anything outlined in amber couldn't be read off the receipt —
            fill it in before saving.
          </p>

          <label className="block">
            <span className="field-label">Paid to</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={flagged(title)}
              placeholder="Store or merchant name"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="block flex-1">
              <span className="field-label">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`input ${flagged(date)}`}
              />
            </label>
            <div className="block flex-1">
              <span className="field-label">Items bought</span>
              <p className="input flex items-center text-muted">
                {itemTypeCount} item{itemTypeCount === 1 ? '' : 's'},{' '}
                {itemPieceCount} piece{itemPieceCount === 1 ? '' : 's'}
              </p>
            </div>
            <label className="block flex-1">
              <span className="field-label">Paid from</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="select"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {printedItemCount != null && printedItemCount !== itemPieceCount && (
            <p className="text-xs text-warning">
              The receipt itself says {printedItemCount} — doesn't match{' '}
              {itemPieceCount} above; some items may be missing.
            </p>
          )}

          <ItemRowsEditor
            items={items}
            onUpdate={updateItem}
            onRemove={removeItem}
            onAdd={addBlankItem}
            addHint="For anything bought at the same time but not on this receipt (a different shop on the same trip)."
          />

          {discountMinor != null && (
            <p className="text-xs text-muted">
              The receipt shows a discount of {formatMoney(discountMinor)} —
              make sure the item prices above already reflect it.
            </p>
          )}

          <div className="flex items-end justify-between gap-2 border-t border-line pt-3">
            <label className="block flex-1">
              <span className="field-label">Total amount</span>
              <Input
                value={displayedAmount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setAmountAuto(false)
                }}
                inputMode="decimal"
                className={flagged(displayedAmount)}
              />
            </label>
            {!amountAuto && (
              <button
                type="button"
                onClick={() => setAmountAuto(true)}
                className="pb-2 text-xs text-muted underline hover:text-ink"
              >
                use sum of items
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Adds up the priced items above — edit it directly if it needs to
            differ (e.g. a discount the items don't already reflect).
          </p>

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={stage === 'saving'}
            >
              {stage === 'saving'
                ? 'Saving…'
                : inQueue
                  ? `Save & next (${queueIndex + 1}/${queue.length})`
                  : 'Save receipt'}
            </Button>
            {inQueue && (
              <button
                type="button"
                onClick={() => void advanceQueue()}
                className="text-xs text-muted underline hover:text-ink"
              >
                skip this one
              </button>
            )}
          </div>

          {rawText && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">
                Show what the scan actually read
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-panel-2 p-2 text-[11px]">
                {rawText}
              </pre>
            </details>
          )}
        </div>
      )}
    </Card>
  )
}

export default ScanReceipt
