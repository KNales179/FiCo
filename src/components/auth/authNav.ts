import { createContext, useContext } from 'react'

export type AuthNav = {
  /** Slide the current card out, then go to another sign-in screen. */
  go: (to: string) => void
  /** Animate a change inside the same screen (e.g. password step → 2FA code step). */
  swap: (update: () => void, direction?: 1 | -1) => void
}

const fallback: AuthNav = {
  go: (to) => window.location.assign(to),
  swap: (update) => update(),
}

export const AuthNavContext = createContext<AuthNav>(fallback)

export const useAuthNav = () => useContext(AuthNavContext)
