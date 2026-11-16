import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IconCompass, IconX } from './icons'

/**
 * Shown across the top while using the demo account: what it is, a way to
 * make a real account, and a way out (which wipes the demo's data).
 */
const DemoBanner = () => {
  const { demo, logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  if (!demo) return null

  const leave = async (to: string) => {
    setLeaving(true)
    await logout()
    navigate(to, { replace: true })
  }

  return (
    <div data-demo-banner="" className="relative z-30 bg-brand text-brand-ink">
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm sm:px-4 lg:px-6">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <IconCompass size={16} className="shrink-0" />
          <span className="min-w-0">
            <span className="font-semibold">Demo mode</span>
            <span className="hidden opacity-85 sm:inline"> · sample data on this device only — it disappears when you exit.</span>
            <span className="opacity-85 sm:hidden"> · wiped when you exit</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={leaving}
            onClick={() => void leave('/register')}
            className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--brand)] transition-opacity hover:opacity-90"
          >
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Create my account</span>
          </button>
          <button
            type="button"
            disabled={leaving}
            onClick={() => void leave('/login')}
            className="flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/10"
          >
            <IconX size={13} /> Exit demo
          </button>
        </span>
      </div>
    </div>
  )
}

export default DemoBanner
