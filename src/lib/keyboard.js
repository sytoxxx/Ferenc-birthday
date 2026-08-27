/**
 * Keeps inputs above the iPhone keyboard without changing app architecture.
 */
export function startKeyboardInsets() {
  const root = document.documentElement

  const apply = () => {
    const viewport = window.visualViewport
    if (!viewport) {
      root.style.setProperty('--keyboard-inset', '0px')
      root.classList.remove('is-keyboard')
      return
    }

    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    root.classList.toggle('is-keyboard', inset > 80)
  }

  window.visualViewport?.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)

  apply()
}
