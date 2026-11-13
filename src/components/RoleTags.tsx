import { useState } from 'react'
import type { MembershipRole } from '../types/models'
import { ROLE_LABEL, ROLE_ORDER } from '../features/spaces/roles'
import { IconChevronDown } from './icons'

/**
 * "Owner · 2", "Admin · 1", "Member · 3", "Viewer · 1" — one tag per role
 * this person holds in shared Finances. Tap a tag to see which Finances.
 */
const RoleTags = ({
  finances,
  align = 'start',
}: {
  finances: { name: string; role: MembershipRole }[]
  align?: 'start' | 'center'
}) => {
  const [open, setOpen] = useState<MembershipRole | null>(null)
  const groups = ROLE_ORDER.map((role) => ({ role, names: finances.filter((f) => f.role === role).map((f) => f.name) })).filter(
    (g) => g.names.length > 0,
  )
  if (groups.length === 0) return null
  const openGroup = groups.find((g) => g.role === open)

  return (
    <div className={`flex flex-col gap-2 ${align === 'center' ? 'items-center sm:items-start' : 'items-start'}`}>
      <div className={`flex flex-wrap gap-1.5 ${align === 'center' ? 'justify-center sm:justify-start' : ''}`}>
        {groups.map(({ role, names }) => {
          const active = open === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => setOpen(active ? null : role)}
              aria-expanded={active}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                active ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-panel/70 text-ink hover:border-brand/50'
              }`}
            >
              {ROLE_LABEL[role]} <span className={active ? 'opacity-90' : 'text-muted'}>· {names.length}</span>
              <IconChevronDown size={12} className={`transition-transform ${active ? 'rotate-180' : ''}`} />
            </button>
          )
        })}
      </div>
      {openGroup && (
        <ul className="rounded-xl border border-line bg-panel/80 px-3 py-2 text-left text-sm">
          <li className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {ROLE_LABEL[openGroup.role]} of
          </li>
          {openGroup.names.map((name) => (
            <li key={name} className="text-ink">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default RoleTags
