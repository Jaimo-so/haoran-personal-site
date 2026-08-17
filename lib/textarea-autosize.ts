import { useEffect, type RefObject } from 'react'

export function resizeTextareaHeight(element: HTMLTextAreaElement | null) {
  if (!element) return

  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

export function useAutoResizeTextarea(ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    const scheduleResize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => resizeTextareaHeight(element))
    }

    scheduleResize()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleResize)
      : null

    resizeObserver?.observe(element)
    if (element.parentElement) {
      resizeObserver?.observe(element.parentElement)
    }

    window.addEventListener('resize', scheduleResize)
    document.fonts?.ready.then(scheduleResize).catch(() => {})

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleResize)
    }
  }, [ref])
}
