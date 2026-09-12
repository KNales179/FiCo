import { createWorker, PSM, type Worker } from 'tesseract.js'
import { preprocessReceiptImage } from './preprocessImage'

/**
 * Reads text off a receipt photo entirely on this device — Tesseract runs in
 * a Web Worker via WASM (Roadmap Phase 26 feedback). The engine's own
 * program/language files are fetched once (from a CDN, cached by the browser
 * after) the first time this runs; the receipt photo itself is never sent
 * anywhere — recognition happens locally.
 *
 * Kept out of the pure `domain/receipts.ts` parser on purpose: this is I/O
 * (a worker, WASM, network for the engine files) and isn't something a unit
 * test should have to spin up. `parseReceiptText` is what's tested.
 */

let workerPromise: Promise<Worker> | null = null

const getWorker = (): Promise<Worker> => {
  if (!workerPromise) {
    workerPromise = createWorker('eng').then(async (worker) => {
      // A receipt is a single narrow column of variable-size text (a big
      // total, small item lines) — closer to what Tesseract's own docs mean
      // by "single column" than its default "fully automatic" mode, which
      // was mis-segmenting real receipts (Jollibee/SM Store, not just the
      // one receipt shape this had been tried against).
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
      return worker
    })
  }
  return workerPromise
}

export const recognizeReceiptText = async (
  image: Blob | File,
): Promise<string> => {
  const worker = await getWorker()
  const cleaned = await preprocessReceiptImage(image)
  const { data } = await worker.recognize(cleaned)
  return data.text
}

/** Free the worker once no more scans are expected (e.g. leaving the page). */
export const terminateOcrWorker = async (): Promise<void> => {
  if (!workerPromise) return
  const worker = await workerPromise
  workerPromise = null
  await worker.terminate()
}
