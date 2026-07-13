// Small namespace-agnostic DOM helpers shared by the GPX and TCX parsers.
// GPX/TCX are namespaced XML (default namespace + gpxtpx/ns3 prefixes for HR).
// We match on the *local* element name, stripping any prefix, so files from
// every watch vendor parse identically. Traversing childNodes (rather than
// getElementsByTagName('*')) keeps this correct across DOM implementations.

const ELEMENT_NODE = 1

/** Local element name with any namespace prefix removed. */
export function localNameOf(el: Element): string {
  const raw = el.localName || el.nodeName || ''
  const colon = raw.indexOf(':')
  return colon >= 0 ? raw.slice(colon + 1) : raw
}

/** All descendant elements with the given local name (document order). */
export function descendantsByLocalName(root: Element | Document, name: string): Element[] {
  const out: Element[] = []
  const visit = (node: Node) => {
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType !== ELEMENT_NODE) continue
      const el = child as Element
      if (localNameOf(el) === name) out.push(el)
      visit(el)
    }
  }
  visit(root)
  return out
}

/** First descendant element with the given local name, if any. */
export function firstDescendantByLocalName(
  root: Element | Document,
  name: string,
): Element | undefined {
  const visit = (node: Node): Element | undefined => {
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType !== ELEMENT_NODE) continue
      const el = child as Element
      if (localNameOf(el) === name) return el
      const found = visit(el)
      if (found) return found
    }
    return undefined
  }
  return visit(root)
}

/** Direct child element with the given local name, if any. */
export function childByLocalName(el: Element, name: string): Element | undefined {
  const children = el.childNodes
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.nodeType === ELEMENT_NODE && localNameOf(child as Element) === name) {
      return child as Element
    }
  }
  return undefined
}

export function num(v: string | null | undefined): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
