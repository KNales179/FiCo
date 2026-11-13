import { Component, type ReactNode } from 'react'
import { IconCloudOff, IconRotateCcw } from './icons'

interface State {
  error: Error | null
}

const isChunkError = (error: Error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i.test(
    error.message,
  )

/**
 * Catches a page that fails to load or render, so the app shows a way out
 * instead of a blank screen — the header and navigation stay usable. Reset
 * by remounting (keyed on the route).
 */
class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[fico] page failed:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    const chunk = isChunkError(error)
    const title = chunk
      ? offline
        ? 'This page isn’t on this device yet'
        : 'Fico was just updated'
      : 'This page ran into a problem'
    const body = chunk
      ? offline
        ? 'You haven’t opened it while online yet, so it isn’t saved for offline use. Everything else still works — it’ll open once you’re back online.'
        : 'Reload to get the newest version. Anything you saved is safe.'
      : 'Your records are safe on this device. Try again — and if it keeps happening, let us know through Report & feedback.'

    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-panel-2 text-muted">
          <IconCloudOff size={26} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-5">
          <IconRotateCcw size={15} /> Try again
        </button>
      </div>
    )
  }
}

export default PageErrorBoundary
