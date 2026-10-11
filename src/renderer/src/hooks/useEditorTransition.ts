import { useCallback, useEffect, useRef } from 'react'

// A static, inert frame covers asynchronous Monaco mounts without retaining
// editor instances or models. Both tab and comparison-mode switches use it.
export function useEditorTransition() {
  const content = useRef<HTMLDivElement | null>(null)
  const overlay = useRef<HTMLDivElement | null>(null)
  const animation = useRef<Animation | null>(null)

  const prepare = useCallback((): void => {
    const node = overlay.current
    if (!node) return
    if (node.firstChild) {
      // Rapid tab changes may arrive while the next editor is still loading.
      // Keep the last complete frame rather than snapshotting the loading UI.
      animation.current?.cancel()
      animation.current = null
      node.style.opacity = '1'
      return
    }
    const source = content.current?.firstElementChild
    const frame = source?.cloneNode(true) as HTMLElement | undefined
    if (!frame || !source) return
    // cloneNode does not copy canvas pixels (Monaco's minimap).
    const canvases = source.querySelectorAll('canvas')
    frame.querySelectorAll('canvas').forEach((canvas, index) => {
      const original = canvases[index]
      if (original.width > 0 && original.height > 0) canvas.getContext('2d')?.drawImage(original, 0, 0)
    })
    frame.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
    node.replaceChildren(frame)
    node.style.opacity = '1'
  }, [])

  const reveal = useCallback((): void => {
    const node = overlay.current
    if (!node?.firstChild) return
    animation.current?.cancel()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.replaceChildren()
      animation.current = null
      return
    }
    const fade = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
    animation.current = fade
    fade.onfinish = () => {
      node.replaceChildren()
      fade.cancel()
      animation.current = null
    }
  }, [])

  useEffect(() => () => animation.current?.cancel(), [])
  return { content, overlay, prepare, reveal }
}
