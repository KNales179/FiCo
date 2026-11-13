import { useRef } from 'react'
import { PageHeader } from '../components/ui'
import CollapsibleCard from '../components/CollapsibleCard'
import { IconSparkles } from '../components/icons'
import { RELEASE_ICONS } from '../components/releaseIcons'
import { APP_VERSION, RELEASES, type Release } from '../features/whatsNew/changelog'
import { EARLY_RELEASES } from '../features/whatsNew/earlyReleases'
import { useStaggerIn } from '../lib/motion'

const longDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

const renderRelease = (release: Release) => (
  <CollapsibleCard
    key={release.version}
    id={`updates.${release.version}`}
    defaultOpen={false}
    title={
      <span className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">
          v{release.version}
        </span>
        {release.title}
        {release.version === APP_VERSION && (
          <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            Current
          </span>
        )}
      </span>
    }
    actions={<span className="hidden text-xs text-muted sm:inline">{longDate(release.date)}</span>}
  >
    <p className="mb-3 text-xs text-muted sm:hidden">{longDate(release.date)}</p>
    <ul className="space-y-3">
      {release.highlights.map((h) => {
        const Icon = RELEASE_ICONS[h.icon]
        return (
          <li key={h.title} className="flex gap-3">
            <span className="card-icon mt-0.5">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{h.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{h.body}</p>
            </div>
          </li>
        )
      })}
    </ul>
  </CollapsibleCard>
)

/**
 * Every Fico release, newest first — each one folded down to its version
 * and title until opened, so the whole history stays easy to scan. Same
 * notes the "What's new" pop-up shows (features/whatsNew/changelog.ts).
 */
const Updates = () => {
  const listRef = useRef<HTMLDivElement>(null)
  useStaggerIn(listRef, 'updates', { y: 12, stagger: 0.05 })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        icon={IconSparkles}
        title="Updates"
        description={`Everything that's changed in Fico. You're on v${APP_VERSION}.`}
      />

      <div ref={listRef} className="space-y-3">
        {RELEASES.map(renderRelease)}

        <h2 className="px-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
          The early days · 1.x
        </h2>
        {EARLY_RELEASES.map(renderRelease)}
      </div>
    </div>
  )
}

export default Updates
