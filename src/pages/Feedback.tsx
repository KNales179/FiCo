import { useState, type FormEvent } from 'react'
import { submitFeedback, type FeedbackType } from '../services/feedbackService'
import { PageHeader, Card, Button, Alert } from '../components/ui'
import { IconMessage } from '../components/icons'
import { useAuth } from '../hooks/useAuth'
import { APP_PAGES } from '../features/feedback/appSections'

const Feedback = () => {
  const [type, setType] = useState<FeedbackType>('BUG')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  // Optional tags: which page, then which section of it.
  const [page, setPage] = useState('')
  const [section, setSection] = useState('')
  const { user } = useAuth()
  const pages = APP_PAGES.filter((p) => !p.adminOnly || user?.role === 'ADMIN')
  const sections = pages.find((p) => p.name === page)?.sections ?? []

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSent('')
    setBusy(true)
    try {
      const res = await submitFeedback(type, message, { page, section })
      setSent(res.message)
      setMessage('')
      setPage('')
      setSection('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Report & feedback"
        icon={IconMessage}
        description="Something broken, or an idea for Fico — goes straight to the admin."
      />

      <Card>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm font-medium">
          {(['BUG', 'SUGGESTION'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`px-4 py-1.5 transition-colors ${
                type === option
                  ? 'bg-brand text-brand-ink'
                  : 'bg-panel text-muted hover:bg-panel-2'
              }`}
            >
              {option === 'BUG' ? 'Report a bug' : 'Suggest something'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Which page? (optional)</span>
              <select
                value={page}
                onChange={(e) => {
                  setPage(e.target.value)
                  setSection('')
                }}
                className="select"
              >
                <option value="">Choose a page…</option>
                {pages.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {page && sections.length > 0 && (
              <label className="block">
                <span className="field-label">Which part of {page}?</span>
                <select value={section} onChange={(e) => setSection(e.target.value)} className="select">
                  <option value="">The whole page / not sure</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {page && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Tagged:</span>
              <span className="rounded-full bg-brand/12 px-2.5 py-0.5 font-medium text-brand">{page}</span>
              {section && <span className="rounded-full bg-brand/12 px-2.5 py-0.5 font-medium text-brand">{section}</span>}
            </div>
          )}

          <label className="block">
            <span className="field-label">
              {type === 'BUG' ? "What happened, and what did you expect instead?" : 'What would you like to see?'}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              autoFocus
              className="input mt-1 w-full"
              placeholder={
                type === 'BUG'
                  ? 'e.g. I tried to pay a bill and…'
                  : 'e.g. It would help if Fico could…'
              }
            />
          </label>

          {error && <Alert>{error}</Alert>}
          {sent && <p className="text-sm text-success">{sent}</p>}

          <Button type="submit" variant="primary" disabled={busy || !message.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default Feedback
