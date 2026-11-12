/**
 * Google Identity Services ("Sign in with Google"), loaded on demand. Off
 * entirely unless VITE_GOOGLE_CLIENT_ID is set at build time — the backend
 * needs the same id as GOOGLE_CLIENT_ID.
 */

type GoogleCredentialResponse = { credential?: string }

type GoogleAccountsId = {
  initialize: (options: Record<string, unknown>) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

export const GOOGLE_CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim()

let loading: Promise<GoogleAccountsId> | null = null

const loadGoogleIdentity = (): Promise<GoogleAccountsId> => {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => {
      loading = null // allow a retry next time (e.g. after coming back online)
      script.remove()
      reject(new Error('Google sign-in did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

// Google's library is initialised once; each mounted button just swaps in
// the handler that should receive the next credential.
let handler: ((credential: string) => void) | null = null
let initialized = false

export const renderGoogleButton = async (
  parent: HTMLElement,
  options: Record<string, unknown>,
  onCredential: (credential: string) => void,
) => {
  const id = await loadGoogleIdentity()
  handler = onCredential
  if (!initialized) {
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: GoogleCredentialResponse) => {
        if (response.credential) handler?.(response.credential)
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_button: true,
    })
    initialized = true
  }
  parent.replaceChildren()
  id.renderButton(parent, options)
}

export const clearGoogleHandler = (fn: (credential: string) => void) => {
  if (handler === fn) handler = null
}
