import { useCallback, useEffect, useMemo, useState } from 'react'
import { listUsers, type AdminUser } from '../services/adminService'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Alert, SkeletonRow } from '../components/ui'
import { IconChevronRight, IconMessage, IconSearch, IconShield } from '../components/icons'

const Admin = () => {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listUsers()
      setUsers(res.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!users) return []
    if (!q) return users
    return users.filter((u) =>
      [u.username, u.email, u.displayName ?? ''].some((v) => v.toLowerCase().includes(q)),
    )
  }, [users, query])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Admin"
        icon={IconShield}
        description="Manage every account — not to be confused with a shared Finance's own owner."
      />

      <Link to="/admin/feedback" className="btn inline-flex">
        <IconMessage size={16} />
        Report & feedback
      </Link>

      {error && <Alert>{error}</Alert>}
      {users === null && !error && (
        <Card>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {users && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">
              Users <span className="font-normal text-muted">· {users.length}</span>
            </h2>
            <label className="relative w-full sm:w-64">
              <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, username, email"
                className="input py-1.5 pl-9 text-sm"
              />
            </label>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {shown.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/admin/users/${u.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-panel-2"
                >
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                      {(u.displayName || u.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-semibold text-ink">{u.displayName || u.username}</span>
                      {u.isSelf && <span className="text-xs text-muted">(you)</span>}
                      {u.role === 'ADMIN' && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">admin</span>
                      )}
                      {u.restricted && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">restricted</span>
                      )}
                      {u.status !== 'ACTIVE' && (
                        <span className="rounded-full bg-danger/12 px-2 py-0.5 text-[11px] font-medium text-danger">deleted</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      @{u.username} · {u.email} · joined {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <IconChevronRight size={18} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
            {shown.length === 0 && <li className="py-3 text-sm text-muted">No one matches “{query}”.</li>}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default Admin
