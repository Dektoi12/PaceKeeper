import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { EXERCISE_BY_ID } from '@/services/strength/library'
import { DEMO_CREDITS, FRAME_DEMOS } from './manifest'
import { demoKind, frameSrc, videoSrc } from './media'

const DEMO_DIR = new URL('../../../public/demos/', import.meta.url)
const filePath = (name: string) => new URL(name, DEMO_DIR)

describe('demo media', () => {
  it('addresses demos by exercise id', () => {
    expect(frameSrc('bw-squat', 0)).toBe('/demos/bw-squat-0.jpg')
    expect(frameSrc('bw-squat', 1)).toBe('/demos/bw-squat-1.jpg')
    expect(videoSrc('bw-squat')).toBe('/demos/bw-squat.mp4')
  })

  it('resolves the right kind per exercise', () => {
    expect(demoKind('bw-squat')).toBe('frames')
    expect(demoKind('bird-dog')).toBe('none')
    expect(demoKind(undefined)).toBe('none')
  })

  // The manifest is generated, so drift means someone edited it or deleted a file.
  it('has both frames on disk for every manifest entry', () => {
    const missing: string[] = []
    for (const id of FRAME_DEMOS) {
      for (const frame of [0, 1]) {
        const name = `${id}-${frame}.jpg`
        if (!existsSync(filePath(name))) missing.push(name)
      }
    }
    expect(missing, `missing demo frames: ${missing.join(', ')}`).toEqual([])
  })

  it('only lists exercises that exist in the library', () => {
    for (const id of FRAME_DEMOS) {
      expect(EXERCISE_BY_ID[id], `manifest lists unknown exercise ${id}`).toBeDefined()
    }
  })

  it('has no demo file that maps to an unknown exercise', () => {
    const orphans = readdirSync(DEMO_DIR)
      .filter((f) => /\.(jpg|mp4|gif)$/i.test(f))
      .map((f) => f.replace(/-[01]\.jpg$/i, '').replace(/\.(jpg|mp4|gif)$/i, ''))
      .filter((id, i, a) => a.indexOf(id) === i)
      .filter((id) => !EXERCISE_BY_ID[id])
    expect(orphans, `demo files matching no exercise: ${orphans.join(', ')}`).toEqual([])
  })

  // CC BY-SA 4.0 obliges us to credit every image we ship.
  it('credits every bundled demo', () => {
    for (const id of FRAME_DEMOS) {
      expect(DEMO_CREDITS[id], `no attribution recorded for ${id}`).toBeTruthy()
    }
  })
})
