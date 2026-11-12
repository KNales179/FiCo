import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { deleteAvatar, uploadAvatar } from '../../services/authService'
import { openSection } from '../../lib/sections'
import { scrollToAndHighlight } from '../../lib/motion'
import { Alert } from '../ui'
import { IconCalendar, IconCamera, IconCheck, IconPlus, IconTrash, IconWallet } from '../icons'
import { ABOUT_SECTION_ID, daysUntil, isBirthdayToday, nextBirthday, paydayLabel } from '../../features/profile'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024


const paydaySummary = (paydays: number[]) =>
  paydays.length === 0 ? null : `Payday: ${paydays.map((p) => (p >= 31 ? 'last day' : paydayLabel(p))).join(' & ')}`

/**
 * The top of the Account page: photo (tap to change), name, @username and
 * email, plus little chips for the optional "About you" details — or a
 * gentle invitation to add them.
 */
const ProfileHeader = () => {
  const { user, refreshUser } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null
  const name = user.displayName || user.username
  const initial = name.charAt(0).toUpperCase()

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image is larger than 5 MB')
      return
    }
    void run(() => uploadAvatar(file), 'Could not upload that image')
  }

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    setBusy(true)
    try {
      await action()
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const goToAbout = () => {
    openSection(ABOUT_SECTION_ID)
    requestAnimationFrame(() => {
      const el = document.getElementById(ABOUT_SECTION_ID)
      if (el) scrollToAndHighlight(el)
    })
  }

  const birthday = user.birthday
  const next = birthday ? nextBirthday(birthday) : null
  const birthdayChip = birthday && next
    ? isBirthdayToday(birthday)
      ? 'Happy birthday today!'
      : `Birthday in ${daysUntil(next)} day${daysUntil(next) === 1 ? '' : 's'}`
    : null
  const payChip = paydaySummary(user.paydays ?? [])

  return (
    <section className="hero-card">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-brand/25" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-bold text-brand-ink ring-4 ring-brand/25">
              {initial}
            </span>
          )}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            aria-label={user.avatarUrl ? 'Change photo' : 'Upload photo'}
            title={user.avatarUrl ? 'Change photo' : 'Upload photo'}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--panel)] bg-brand text-brand-ink shadow-md transition-transform hover:scale-105 disabled:opacity-60"
          >
            <IconCamera size={16} />
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-extrabold tracking-tight text-ink">{name}</h2>
          <p className="truncate text-sm text-muted">
            @{user.username}
            {user.email && ` · ${user.email}`}
            {user.emailVerified && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs font-medium text-success">
                <IconCheck size={12} /> verified
              </span>
            )}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            {birthdayChip && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1 text-xs font-medium text-brand">
                <IconCalendar size={13} /> {birthdayChip}
              </span>
            )}
            {payChip && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1 text-xs font-medium text-brand">
                <IconWallet size={13} /> {payChip}
              </span>
            )}
            {(!birthdayChip || !payChip) && (
              <button
                type="button"
                onClick={goToAbout}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted transition-colors hover:border-brand hover:text-brand"
              >
                <IconPlus size={13} />
                {!birthdayChip && !payChip ? 'Add birthday & payday' : !birthdayChip ? 'Add birthday' : 'Add payday'}
                <span className="opacity-70">· optional</span>
              </button>
            )}
            {user.avatarUrl && (
              <button
                type="button"
                onClick={() => void run(deleteAvatar, 'Could not remove that image')}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:text-danger"
              >
                <IconTrash size={13} /> Remove photo
              </button>
            )}
          </div>
          {busy && <p className="mt-2 text-xs text-muted">Updating your photo…</p>}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </section>
  )
}

export default ProfileHeader
