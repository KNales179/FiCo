import { binarize, otsuThreshold, toGrayscale } from '../../domain/imagePreprocessing'

/** Below this width, upscale — more pixels per character measurably helps
 *  Tesseract on a small/far-away photo. */
const MIN_WIDTH = 1400

/**
 * Cleans up a receipt photo before OCR sees it: grayscale, adaptive
 * (Otsu) black-and-white threshold, and upscaling a small photo — the
 * actual fix for "the scanner can only read one type of receipt": a real
 * phone photo's lighting and contrast vary far more than the one receipt
 * this happened to work well on, and Tesseract is dramatically more
 * accurate on a starkly black-on-white image than on a raw, uneven photo.
 *
 * Falls back to the original image untouched if anything here isn't
 * available (an old browser, an unsupported image type) — this can only
 * help accuracy, never block a scan that would otherwise have worked.
 */
export const preprocessReceiptImage = async (
  image: Blob | File,
): Promise<Blob | File> => {
  try {
    const bitmap = await createImageBitmap(image)
    const scale = bitmap.width < MIN_WIDTH ? MIN_WIDTH / bitmap.width : 1
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return image

    ctx.drawImage(bitmap, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)

    const gray = toGrayscale(imageData.data)
    const blackAndWhite = binarize(gray, otsuThreshold(gray))

    for (let i = 0; i < blackAndWhite.length; i += 1) {
      const v = blackAndWhite[i]
      imageData.data[i * 4] = v
      imageData.data[i * 4 + 1] = v
      imageData.data[i * 4 + 2] = v
    }
    ctx.putImageData(imageData, 0, 0)

    return await new Promise<Blob | File>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? image), 'image/png')
    })
  } catch {
    return image
  }
}
