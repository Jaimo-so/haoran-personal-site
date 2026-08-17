export type MenuPlacement = 'top' | 'bottom'

function isClippingElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return [style.overflow, style.overflowY].some((value) =>
    ['auto', 'scroll', 'hidden', 'clip'].includes(value),
  )
}

export function resolveMenuPlacement(
  trigger: HTMLElement,
  estimatedMenuHeight: number,
  preferred: MenuPlacement | 'auto' = 'auto',
): MenuPlacement {
  if (preferred !== 'auto') return preferred

  const triggerRect = trigger.getBoundingClientRect()
  let clippingTop = 0
  let clippingBottom = window.innerHeight
  let ancestor = trigger.parentElement

  while (ancestor && ancestor !== document.body) {
    if (isClippingElement(ancestor)) {
      const ancestorRect = ancestor.getBoundingClientRect()
      clippingTop = Math.max(clippingTop, ancestorRect.top)
      clippingBottom = Math.min(clippingBottom, ancestorRect.bottom)
    }
    ancestor = ancestor.parentElement
  }

  const spaceAbove = Math.max(0, triggerRect.top - clippingTop)
  const spaceBelow = Math.max(0, clippingBottom - triggerRect.bottom)

  return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
}
