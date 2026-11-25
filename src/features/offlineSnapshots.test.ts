import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSnapshots, loadSnapshot, membersSnapshotKey, saveSnapshot } from './offlineSnapshots'

/** A tiny in-memory localStorage (tests run in Node, which has none). */
const memoryStorage = () => {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

describe('offline snapshots', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the last online copy, with when it was saved', () => {
    saveSnapshot(membersSnapshotKey('space-1'), [{ userId: 'u1' }])
    const snap = loadSnapshot<{ userId: string }[]>(membersSnapshotKey('space-1'))
    expect(snap?.value).toEqual([{ userId: 'u1' }])
    expect(Number.isNaN(Date.parse(snap!.savedAt))).toBe(false)
    expect(loadSnapshot('members.other')).toBeNull()
  })

  it('sign-out wipes every copy (and the old member cache) but nothing else', () => {
    saveSnapshot('activity.space-1.records.all', [1, 2])
    saveSnapshot(membersSnapshotKey('space-1'), [])
    localStorage.setItem('fico.membersCache.space-1', '[]')
    localStorage.setItem('fico.collapsed', '{}')
    clearSnapshots()
    expect(loadSnapshot('activity.space-1.records.all')).toBeNull()
    expect(loadSnapshot(membersSnapshotKey('space-1'))).toBeNull()
    expect(localStorage.getItem('fico.membersCache.space-1')).toBeNull()
    expect(localStorage.getItem('fico.collapsed')).toBe('{}')
  })

  it('never throws when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveSnapshot('x', 1)).not.toThrow()
    expect(loadSnapshot('x')).toBeNull()
    expect(() => clearSnapshots()).not.toThrow()
  })
})
