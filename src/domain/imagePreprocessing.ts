/**
 * Pure pixel-math for cleaning up a receipt photo before OCR sees it
 * (Roadmap feedback: "the scanner can only read one type of receipt" — a
 * phone photo's lighting/contrast varies a lot more than a flatbed scan,
 * and Tesseract is far more accurate on a starkly black-on-white image
 * than on a raw photo). Kept separate from the actual canvas/image-decode
 * work (`features/receipts/preprocessImage.ts`, which needs a real DOM) so
 * this part is unit-testable.
 */

/** ITU-R BT.601 luma — one grayscale value per pixel, from an RGBA buffer. */
export const toGrayscale = (rgba: Uint8ClampedArray): Uint8ClampedArray => {
  const gray = new Uint8ClampedArray(rgba.length / 4)
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  }
  return gray
}

/**
 * Otsu's method: the single brightness cutoff that best splits the image
 * into two classes (ink vs. paper) by maximizing the variance *between*
 * them — adapts to how dark or washed-out a given receipt photo actually
 * is, rather than a fixed guess that only happens to suit some receipts.
 */
export const otsuThreshold = (gray: Uint8ClampedArray): number => {
  const histogram = new Array<number>(256).fill(0)
  for (const value of gray) histogram[value] += 1

  const total = gray.length
  if (total === 0) return 128

  let sum = 0
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i]

  let sumBelow = 0
  let weightBelow = 0
  let bestVariance = 0
  let bestThreshold = 0

  for (let i = 0; i < 256; i += 1) {
    weightBelow += histogram[i]
    if (weightBelow === 0) continue
    const weightAbove = total - weightBelow
    if (weightAbove === 0) break

    sumBelow += i * histogram[i]
    const meanBelow = sumBelow / weightBelow
    const meanAbove = (sum - sumBelow) / weightAbove
    const variance = weightBelow * weightAbove * (meanBelow - meanAbove) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      bestThreshold = i
    }
  }

  return bestThreshold
}

/** Pixels brighter than `threshold` become white, everything else black. */
export const binarize = (
  gray: Uint8ClampedArray,
  threshold: number,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(gray.length)
  for (let i = 0; i < gray.length; i += 1) {
    out[i] = gray[i] > threshold ? 255 : 0
  }
  return out
}
