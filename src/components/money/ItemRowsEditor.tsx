import { formatMoney } from '../../domain/money'
import { parseItemQuantity, rowTotalMinor, type DraftItem } from './draftItems'
import CategoryPicker from './CategoryPicker'

/** A field the scan/entry couldn't fill in gets a visible amber ring, never a guess. */
const flagged = (value: string) =>
  value.trim() === '' ? 'ring-2 ring-warning/60 border-warning' : ''

/**
 * The itemized row editor shared by receipt scanning and Quick Add's batch
 * mode (Roadmap Phase 26 feedback: "when the category is Groceries or
 * Shopping... allow multiple items, just like the Scan receipt").
 */
const ItemRowsEditor = ({
  items,
  onUpdate,
  onRemove,
  onAdd,
  addHint,
}: {
  items: DraftItem[]
  onUpdate: (id: number, patch: Partial<DraftItem>) => void
  onRemove: (id: number) => void
  onAdd: () => void
  addHint?: string
}) => (
  <div>
    <span className="field-label">Items</span>
    <div className="space-y-1.5">
      {items.map((row) => {
        const total = rowTotalMinor(row)
        const qty = parseItemQuantity(row.quantity, row.unit)
        return (
          <div key={row.id} className="flex flex-wrap items-center gap-1.5">
            <input
              value={row.name}
              onChange={(e) => onUpdate(row.id, { name: e.target.value })}
              placeholder="Item"
              className="input min-w-[7rem] flex-1"
            />
            <input
              value={row.quantity}
              onChange={(e) => onUpdate(row.id, { quantity: e.target.value })}
              inputMode="decimal"
              className="input w-14 text-center"
              title={row.unit === 'kg' ? 'Weight (kg)' : 'Quantity'}
            />
            <select
              value={row.unit}
              onChange={(e) => onUpdate(row.id, { unit: e.target.value as DraftItem['unit'] })}
              className="select w-auto"
              title="Unit — pieces or weight"
              aria-label="Unit"
            >
              <option value="pcs">pcs</option>
              <option value="kg">kg</option>
            </select>
            <input
              value={row.price}
              onChange={(e) => onUpdate(row.id, { price: e.target.value })}
              inputMode="decimal"
              placeholder="Price each"
              title="Price per unit"
              className={`input w-24 ${flagged(row.price)}`}
            />
            {total != null && qty !== 1 && (
              <span className="text-xs text-muted" title="Quantity × price each">
                = {formatMoney(total)}
              </span>
            )}
            <CategoryPicker
              kind="EXPENSE"
              value={row.categoryId}
              onChange={(categoryId) => onUpdate(row.id, { categoryId })}
              className="select w-auto"
            />
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              className="text-xs text-muted underline hover:text-ink"
            >
              remove
            </button>
          </div>
        )
      })}
    </div>
    <button
      type="button"
      onClick={onAdd}
      className="mt-1.5 text-xs text-muted underline hover:text-ink"
    >
      + add item
    </button>
    {addHint && <p className="mt-1 text-xs text-muted">{addHint}</p>}
  </div>
)

export default ItemRowsEditor
