import 'fake-indexeddb/auto'
import { afterEach, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { closeDB } from '../db/database'
import { __resetInitDBForTests } from '../db/bootstrap'

/**
 * Give every test a clean IndexedDB. `closeDB()` drops the cached connection
 * so the next `getDB()` reopens against the fresh factory.
 */
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  __resetInitDBForTests()
})

afterEach(async () => {
  await closeDB()
  __resetInitDBForTests()
})

/** Minimal File polyfill for attachment tests (Node has Blob, not File). */
if (typeof globalThis.File === 'undefined') {
  class NodeFile extends Blob {
    name: string
    lastModified: number
    constructor(
      bits: BlobPart[],
      name: string,
      options?: FilePropertyBag,
    ) {
      super(bits, options)
      this.name = name
      this.lastModified = options?.lastModified ?? Date.now()
    }
  }
  globalThis.File = NodeFile as unknown as typeof File
}
