import { useRef } from 'react'
import { useTour } from '../hooks/useTour'
import { useStaggerIn } from '../lib/motion'
import { PageHeader } from '../components/ui'
import { IconBook, IconChevronRight } from '../components/icons'
import { TOURS } from '../components/tour/steps'

/**
 * "How Fico works": one guided tour per part of the app. Picking one opens
 * that page and walks through it with the spotlight — over the temporary
 * Sample Finance, so even a brand-new account has something to point at.
 */
const Tutorial = () => {
  const { startTour, running } = useTour()
  const listRef = useRef<HTMLUListElement>(null)
  useStaggerIn(listRef, 'tours', { y: 14, stagger: 0.05 })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        icon={IconBook}
        title="How Fico works"
        description="Pick a guided tour — it opens the page and points out each part. Tours show sample data, so nothing of yours changes."
      />

      <ul ref={listRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOURS.map((tour) => {
          const TourIcon = tour.icon
          return (
            <li key={tour.id}>
              <button
                type="button"
                disabled={running}
                onClick={() => startTour(tour.id)}
                className="card group flex h-full w-full flex-col items-start gap-3 text-left transition hover:-translate-y-0.5 hover:border-brand/40 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-brand-ink">
                  <TourIcon size={21} />
                </span>
                <span>
                  <span className="block text-base font-semibold text-ink">{tour.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{tour.description}</span>
                </span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Start tour · {tour.steps.length} steps
                  <IconChevronRight size={15} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default Tutorial
