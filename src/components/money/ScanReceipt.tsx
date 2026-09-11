import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useMutationContext } from '../../hooks/useMutationContext'
import { parseReceiptText, type ReceiptLineItem } from '../../domain/receipts'
import { recognizeReceiptText } from '../../features/receipts/ocr'
import { recordScannedReceipt } from '../../features/receipts'
import { addAttachment } from '../../features/attachments'
import { parseAmountToMinor } from '../../domain/money'
import { Button, Card, Input } from '../ui'
import CategoryPicker from './CategoryPicker'

interface DraftItem {
  id: number
  name: string
  quantity: string
  /** '' means blank/unparsed — highlighted until the person fills it in. */
  price: string
}

const toDraftItems = (items: ReceiptLineItem[]): DraftItem[] =>
  items.map((item, i) => ({
    id: i,
    name: item.name,
    quantity: String(item.quantity),
    price: item.priceMinor != null ? (item.priceMinor / 100).toFixed(2) : '',
  }))

/** A field the scan couldn't read gets a visible amber ring, never a guess. */
const flagged = (value: string) =>
  value.trim() === '' ? 'ring-2 ring-warning/60 border-warning' : ''

/**
 * Upload a receipt photo and have Fico read it (Roadmap Phase 26 feedback).
 * OCR runs entirely on this device (Tesseract.js); anything it can't read
 * confidently — including the purchase date — is left blank and flagged
 * rather than guessed, so the person always confirms before saving.
 */
const ScanReceipt = () => {
  const { accounts, defaultAccount, canEdit, refresh } = useMoney()
  const { ctx } = useMutationContext()
  const fileInput = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<'idle' | 'reading' | 'review' | 'saving'>(
    'idle',
  )
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )

  if (!canEdit || activeAccounts.length === 0) return null

  const reset = () => {
    setOpen(false)
    setStage('idle')
    setError('')
    setPhoto(null)
    setTitle('')
    setDate('')
    setAmount('')
    setCategoryId('')
    setItems([])
    if (fileInput.current) fileInput.current.value = ''
  }

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPhoto(file)
    setStage('reading')
    try {
      const text = await recognizeReceiptText(file)
      const parsed = parseReceiptText(text)
      setTitle(parsed.merchant ?? '')
      setDate(parsed.occurredAt ?? '')
      setAmount(
        parsed.totalMinor != null ? (parsed.totalMinor / 100).toFixed(2) : '',
      )
      setItems(toDraftItems(parsed.items))
      setAccountId(defaultAccount?.id ?? activeAccounts[0].id)
      setStage('review')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read that image',
      )
      setStage('idle')
    }
  }

  const updateItem = (id: number, patch: Partial<DraftItem>) =>
    setItems((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )

  const removeItem = (id: number) =>
    setItems((rows) => rows.filter((r) => r.id !== id))

  const addBlankItem = () =>
    setItems((rows) => [
      ...rows,
      { id: (rows.at(-1)?.id ?? -1) + 1, name: '', quantity: '1', price: '' },
    ])

  const save = async () => {
    setError('')

    const amountMinor = parseAmountToMinor(amount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter the receipt total before saving')
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
        categoryId: categoryId || null,
        items: items
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name.trim(),
            quantity: Math.max(1, Number(row.quantity) || 1),
            priceMinor: parseAmountToMinor(row.price),
          })),
      })

      if (photo) {
        await addAttachment(ctx, {
          entityType: 'TRANSACTION',
          entityId: transaction.id,
          file: photo,
        })
      }

      await refresh()
      reset()
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

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="section-title">Scan a receipt</h2>
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
            onChange={(e) => void onPick(e)}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            Reading happens on this device — the photo isn't sent anywhere.
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
            <label className="block flex-1">
              <span className="field-label">Total</span>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className={flagged(amount)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <label className="block flex-1">
              <span className="field-label">Category</span>
              <CategoryPicker
                kind="EXPENSE"
                value={categoryId}
                onChange={setCategoryId}
                className="select"
              />
            </label>
          </div>

          <div>
            <span className="field-label">Items</span>
            <div className="space-y-1.5">
              {items.map((row) => (
                <div key={row.id} className="flex items-center gap-1.5">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      updateItem(row.id, { name: e.target.value })
                    }
                    placeholder="Item"
                    className="input flex-1"
                  />
                  <input
                    value={row.quantity}
                    onChange={(e) =>
                      updateItem(row.id, { quantity: e.target.value })
                    }
                    inputMode="numeric"
                    className="input w-14 text-center"
                    title="Quantity"
                  />
                  <input
                    value={row.price}
                    onChange={(e) =>
                      updateItem(row.id, { price: e.target.value })
                    }
                    inputMode="decimal"
                    placeholder="Price"
                    className={`input w-24 ${flagged(row.price)}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(row.id)}
                    className="text-xs text-muted underline hover:text-ink"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBlankItem}
              className="mt-1.5 text-xs text-muted underline hover:text-ink"
            >
              + add item
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={stage === 'saving'}
          >
            {stage === 'saving' ? 'Saving…' : 'Save receipt'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export default ScanReceipt
