import { useMemo } from 'react'
import { useMoney } from '../../hooks/useMoney'
import type { CategoryKind } from '../../types/models'

/** A dropdown of the space's categories for the given kind, plus "no category". */
const CategoryPicker = ({
  kind,
  value,
  onChange,
  className = 'select w-auto',
}: {
  kind: CategoryKind
  value: string
  onChange: (categoryId: string) => void
  className?: string
}) => {
  const { categories } = useMoney()

  const options = useMemo(
    () =>
      categories
        .filter((c) => c.kind === kind && !c.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, kind],
  )

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label="Category"
    >
      <option value="">No category</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

export default CategoryPicker
