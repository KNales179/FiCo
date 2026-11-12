import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { PageHeader, Button, Card, SkeletonRow } from '../components/ui'
import { IconBell, IconCheck, IconChevronRight, IconMessage, IconShield, IconSparkles } from '../components/icons'
import {
  markNotificationsRead,
  refreshNotifications,
  useNotifications,
  type AppNotification,
} from '../features/notifications'

const KIND_LOOK: Record<AppNotification['kind'], { icon: typeof IconBell; tone: string; label: string }> = {
  FEEDBACK_DONE: { icon: IconSparkles, tone: 'bg-success/15 text-success', label: 'Your feedback' },
  ADMIN_NOTICE: { icon: IconMessage, tone: 'bg-brand/12 text-brand', label: 'Message' },
  ADMIN_ACTION: { icon: IconShield, tone: 'bg-warning/15 text-warning', label: 'Your account' },
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
 * messages from the admin team, and changes an admin made to your account.
 */
const Notifications = () => {
  const { items, unread, loaded } = useNotifications()
  const navigate = useNavigate()

  useEffect(() => {
    void refreshNotifications()
  }, [])

  const open = (n: AppNotification) => {
    if (!n.readAt) void markNotificationsRead([n.id])
    if (n.link && n.link !== '/notifications') navigate(n.link)
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
        <ul className="space-y-2.5">
          {items.map((n) => {
            const look = KIND_LOOK[n.kind] ?? KIND_LOOK.ADMIN_NOTICE
            const Icon = look.icon
            const clickable = Boolean(n.link && n.link !== '/notifications') || !n.readAt
            return (
              <li key={n.id}>
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => open(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open(n)
                    }
                  }}
                  className={`card flex gap-3 transition-colors ${clickable ? 'cursor-pointer hover:border-brand/40' : ''} ${
                    n.readAt ? '' : 'border-brand/40 bg-brand/[0.04]'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${look.tone}`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${n.readAt ? 'font-medium' : 'font-bold'} text-ink`}>{n.title}</p>
                      {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{look.label}</span>
                      {n.senderName && <span>· from {n.senderName}</span>}
                      <span>· {timeAgo(n.createdAt)}</span>
                      {n.link && n.link !== '/notifications' && (
                        <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-brand">
                          {linkLabel(n.link)} <IconChevronRight size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Notifications
