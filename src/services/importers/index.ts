import { parseGpx } from './gpx'
import { parseTcx } from './tcx'
import type { RunImport } from './types'

export type { RunImport } from './types'
export { findDuplicate } from './dedupe'

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * Parse any supported activity file into a normalized RunImport. FIT parsing is
 * dynamically imported so the (heavy) binary SDK stays out of the main bundle.
 */
export async function parseFile(file: File): Promise<RunImport> {
  const ext = extensionOf(file.name)
  switch (ext) {
    case 'gpx':
      return parseGpx(await file.text(), file.name)
    case 'tcx':
      return parseTcx(await file.text(), file.name)
    case 'fit': {
      const { parseFit } = await import('./fit')
      return parseFit(await file.arrayBuffer(), file.name)
    }
    default:
      throw new Error(`Unsupported file type: .${ext}. Use GPX, TCX, or FIT.`)
  }
}
