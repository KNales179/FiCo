import { describe, expect, it } from 'vitest'
import { binarize, otsuThreshold, toGrayscale } from './imagePreprocessing'

/** Applying the chosen threshold should sort every pixel back into its own original cluster. */
const separates = (gray: Uint8ClampedArray, darkCount: number): boolean => {
  const bw = binarize(gray, otsuThreshold(gray))
  const dark = bw.slice(0, darkCount)
  const light = bw.slice(darkCount)
  return dark.every((v) => v === 0) && light.every((v) => v === 255)
}

describe('toGrayscale', () => {
  it('averages RGB into one value per pixel using ITU-R BT.601 luma', () => {
    // Pure white and pure black, one pixel each.
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    const gray = toGrayscale(rgba)
    expect(gray).toHaveLength(2)
    expect(gray[0]).toBe(255)
    expect(gray[1]).toBe(0)
  })
})

describe('otsuThreshold', () => {
  it('splits a clearly bimodal image (dark text, light paper) between the two clusters', () => {
    // 100 near-black "ink" pixels, 100 near-white "paper" pixels.
    const gray = new Uint8ClampedArray([
      ...new Array(100).fill(20),
      ...new Array(100).fill(230),
    ])
    expect(separates(gray, 100)).toBe(true)
  })

  it('adapts to a darker, low-contrast photo rather than using a fixed cutoff', () => {
    // Same two clusters, but the whole photo is dimmer overall — a fixed
    // cutoff like 128 would wrongly call every pixel here "dark".
    const dim = new Uint8ClampedArray([
      ...new Array(100).fill(10),
      ...new Array(100).fill(120),
    ])
    expect(separates(dim, 100)).toBe(true)
  })

  it('never throws on a blank (all-one-value) image', () => {
    const blank = new Uint8ClampedArray(50).fill(255)
    expect(() => otsuThreshold(blank)).not.toThrow()
  })
})

describe('binarize', () => {
  it('pushes every pixel to pure black or pure white around the threshold', () => {
    const gray = new Uint8ClampedArray([10, 100, 150, 240])
    const out = binarize(gray, 128)
    expect(Array.from(out)).toEqual([0, 0, 255, 255])
  })
})
