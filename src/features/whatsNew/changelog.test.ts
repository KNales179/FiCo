import { beforeEach, describe, expect, it } from 'vitest'
import { APP_VERSION, RELEASES, markVersionSeen, unseenReleases } from './changelog'

// Tests run in Node — a tiny in-memory localStorage stands in for the browser's.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

describe("what's new — missed releases", () => {
  beforeEach(() => localStorage.clear())

  it('shows nothing once the current version has been seen', () => {
    markVersionSeen()
    expect(unseenReleases()).toEqual([])
  })

  it('shows every release newer than the last one seen, newest first, in one list', () => {
    const older = RELEASES[RELEASES.length - 1].version
    localStorage.setItem('fico.seenVersion', older)
    const missed = unseenReleases()
    expect(missed.map((r) => r.version)).toEqual(RELEASES.slice(0, -1).map((r) => r.version))
    expect(missed[0].version).toBe(APP_VERSION)
  })

  it('shows all releases to a device that never saw any notes', () => {
    expect(unseenReleases()).toEqual(RELEASES)
  })
})
