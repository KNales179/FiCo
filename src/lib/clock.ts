/**
 * The server's clock, as seen from this device. Edit times decide which of
 * two conflicting changes wins, so they're stamped with *server* time —
 * a phone whose clock is wrong would otherwise win or lose edits unfairly.
 * The offset is learned from every server response and kept for offline use.
 */

const KEY = 'fico.clockOffsetMs'
// Ignore differences smaller than this — network delay noise.
const NOISE_MS = 2_000
// A bigger jump than this is a mis-read, not a real clock difference.
const MAX_OFFSET_MS = 365 * 24 * 3600_000

let offsetMs = (() => {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
})()

/** Learn the offset from a response's X-Server-Time (ms since epoch), taken mid-request. */
export const noteServerTime = (serverMs: number, sentAt: number, receivedAt: number) => {
  if (!Number.isFinite(serverMs)) return
  const local = (sentAt + receivedAt) / 2
  const next = serverMs - local
  if (Math.abs(next) > MAX_OFFSET_MS) return
  const settled = Math.abs(next) < NOISE_MS ? 0 : Math.round(next)
  if (settled === offsetMs) return
  offsetMs = settled
  try {
    localStorage.setItem(KEY, String(offsetMs))
  } catch {
    // ignore
  }
}

/** Now, by the server's clock. */
export const serverNow = () => Date.now() + offsetMs

export const serverNowIso = () => new Date(serverNow()).toISOString()
