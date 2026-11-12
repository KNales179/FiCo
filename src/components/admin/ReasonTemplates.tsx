import { useState } from 'react'
import { removeTemplate, saveTemplate, templatesFor, type TemplateKind } from '../../features/admin/reasonTemplates'
import { IconPlus, IconX } from '../icons'

/**
 * Quick-pick wording above an admin's reason/message box: tap a template to
 * fill it in (then edit as needed), or save what's typed as a new one.
 */
const ReasonTemplates = ({
  kind,
  value,
  onPick,
}: {
  kind: TemplateKind
  value: string
  onPick: (text: string) => void
}) => {
  const [, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)
  const list = templatesFor(kind)
  const canSave = value.trim().length >= 3 && !list.some((t) => t.text === value.trim())

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Templates</span>
      <div className="flex flex-wrap gap-1.5">
        {list.map((t) => (
          <span
            key={t.id}
            className={`group inline-flex items-center overflow-hidden rounded-full border text-xs transition-colors ${
              value.trim() === t.text ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand/50 hover:text-ink'
            }`}
          >
            <button type="button" onClick={() => onPick(t.text)} title={t.text} className="px-2.5 py-1">
              {t.label}
            </button>
            {t.custom && (
              <button
                type="button"
                onClick={() => {
                  removeTemplate(kind, t.id)
                  bump()
                }}
                aria-label={`Remove template ${t.label}`}
                title="Remove this template"
                className="py-1 pr-2 opacity-60 hover:text-danger hover:opacity-100"
              >
                <IconX size={11} />
              </button>
            )}
          </span>
        ))}
        {canSave && (
          <button
            type="button"
            onClick={() => {
              saveTemplate(kind, value)
              bump()
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/50 px-2.5 py-1 text-xs text-brand hover:bg-brand/10"
          >
            <IconPlus size={11} /> Save as template
          </button>
        )}
      </div>
    </div>
  )
}

export default ReasonTemplates
