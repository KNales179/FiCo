/**
 * Exaggerated feedback for a wrong answer: the field (or its wrapper)
 * shakes once. Pair with the `field-wrong` class for the red highlight.
 * The animation itself lives in index.css (`.shake`), and is skipped with
 * reduced motion.
 */
export const shake = (el: Element | null | undefined) => {
  if (!el) return
  el.classList.remove('shake')
  // Force a reflow so the animation starts again even if it just ran.
  void (el as HTMLElement).offsetWidth
  el.classList.add('shake')
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true })
}

/** Shake the field with this id (or its closest label/wrapper). */
export const shakeById = (id: string) => {
  const el = document.getElementById(id)
  shake(el?.closest('label') ?? el)
}
