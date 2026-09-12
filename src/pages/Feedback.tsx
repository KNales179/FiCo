import { useState, type FormEvent } from 'react'
import { submitFeedback, type FeedbackType } from '../services/feedbackService'
import { PageHeader, Card, Button, Alert } from '../components/ui'

const Feedback = () => {
  const [type, setType] = useState<FeedbackType>('BUG')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSent('')
    setBusy(true)
    try {
      const res = await submitFeedback(type, message)
      setSent(res.message)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Report & feedback"
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
