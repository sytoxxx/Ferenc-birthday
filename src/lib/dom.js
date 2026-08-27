/**
 * Small DOM helpers used by UI modules.
 * Avoids innerHTML for untrusted values such as participant names.
 */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  const { dataset, style, ...rest } = props

  for (const [key, value] of Object.entries(rest)) {
    if (value == null || value === false) continue

    if (key === 'className' || key === 'class') {
      node.className = value
    } else if (key === 'textContent') {
      node.textContent = value
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase()
      node.addEventListener(eventName, value)
    } else if (key.startsWith('aria-') || key.startsWith('data-')) {
      node.setAttribute(key, value === true ? '' : String(value))
    } else if (key in node && key !== 'list') {
      node[key] = value
    } else {
      node.setAttribute(key, value === true ? '' : String(value))
    }
  }

  if (dataset) {
    Object.assign(node.dataset, dataset)
  }

  if (style && typeof style === 'object') {
    Object.assign(node.style, style)
  }

  for (const child of [].concat(children)) {
    if (child == null || child === false) continue
    node.append(child)
  }

  return node
}

export function clear(node) {
  node.replaceChildren()
}
