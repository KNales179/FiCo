import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Button, Card, SkeletonRow } from '../components/ui'
import {
  IconBell,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCloudOff,
  IconMessage,
  IconRotateCcw,
  IconShield,
  IconSparkles,
} from '../components/icons'
import {
  markNotificationsRead,
  refreshNotifications,
  useNotifications,
  type AppNotification,
} from '../features/notifications'

const KIND_LOOK: Record<AppNotification['kind'], { icon: typeof IconBell; tone: string; label: string; fallbackTitle: string }> = {
  FEEDBACK_DONE: { icon: IconSparkles, tone: 'bg-success/15 text-success', label: 'Your feedback', fallbackTitle: 'An update on your feedback' },
  ADMIN_NOTICE: { icon: IconMessage, tone: 'bg-brand/12 text-brand', label: 'Message', fallbackTitle: 'A notice from the Fico Admin Team' },
  ADMIN_ACTION: { icon: IconShield, tone: 'bg-warning/15 text-warning', label: 'Your account', fallbackTitle: 'An update about your account' },
  SYNC_REJECTED: { icon: IconCloudOff, tone: 'bg-danger/12 text-danger', label: 'Sync', fallbackTitle: 'A change couldn’t be saved' },
  SYNC_OVERWRITTEN: { icon: IconRotateCcw, tone: 'bg-warning/15 text-warning', label: 'Sync', fallbackTitle: 'An offline edit was replaced' },
}

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const linkLabel = (link: string) => (link === '/updates' ? 'Go check Updates' : 'Open')

/**
 * Everything Fico has told you: suggestions or bug reports marked done,
 * messages from the admin team, changes an admin made to your account, and
 * sync problems on this device. Each shows just its title; tap to open it.
 */
const Notifications = () => {
  const { items, unread, loaded } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    void refreshNotifications()
  }, [])

  const toggle = (n: AppNotification) => {
    if (!n.readAt) void markNotificationsRead([n.id])
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(n.id)) next.delete(n.id)
      else next.add(n.id)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Notifications"
        icon={IconBell}
        description={unread ? `${unread} unread` : 'You’re all caught up.'}
        actions={
          unread > 0 ? (
            <Button size="sm" onClick={() => void markNotificationsRead('all')}>
              <IconCheck size={15} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {!loaded && items.length === 0 && (
        <Card>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {loaded && items.length === 0 && (
        <Card className="py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-panel-2 text-muted">
            <IconBell size={24} />
          </span>
          <p className="mt-3 font-semibold text-ink">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            When the Fico team finishes something you suggested, fixes a bug you reported, or sends you a message,
            you’ll find it here.
          </p>
        </Card>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((n) => {
            const look = KIND_LOOK[n.kind] ?? KIND_LOOK.ADMIN_NOTICE
            const Icon = look.icon
            const expanded = open.has(n.id)
            const title = n.title?.trim() || look.fallbackTitle
            return (
              <li key={n.id} className={`card overflow-hidden p-0 ${n.readAt ? '' : 'border-brand/40'}`}>
                <button
                  type="button"
                  onClick={() => toggle(n)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2/60 ${
                    n.readAt ? '' : 'bg-brand/[0.04]'
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${look.tone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${n.readAt ? 'font-medium' : 'font-bold'} text-ink`}>{title}</span>
                    <span className="block text-xs text-muted">
                      {look.label} · {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  <IconChevronDown size={16} className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {expanded && (
                  <div className="border-t border-line px-4 py-3">
                    {n.body && <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>}

                    {n.sections && n.sections.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {n.sections.map((section, i) => (
                          <div key={i} className="rounded-xl border border-line bg-panel-2 px-3 py-2">
                            <p className="text-sm font-semibold text-ink">{section.heading}</p>
                            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
                              {section.lines.map((line, j) => (
                                <div key={j} className="contents">
                                  <dt className="text-muted">{line.label}</dt>
                                  <dd className="break-words text-ink">{line.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {n.senderName && <span>from {n.senderName}</span>}
                      {n.link && n.link !== '/notifications' && (
                        <button
                          type="button"
                          onClick={() => navigate(n.link!)}
                          className="ml-auto inline-flex items-center gap-0.5 font-semibold text-brand hover:underline"
                        >
                          {linkLabel(n.link)} <IconChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Notifications
