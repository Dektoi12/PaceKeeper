import type { SessionType } from '@/services/db/types'

export interface SessionMeta {
  label: string
  color: string // hex, mirrors tailwind session.* tokens
  icon: string // emoji glyph for lightweight visual coding
  why: string // one-paragraph education blurb (spec §3.1)
}

export const SESSION_META: Record<SessionType, SessionMeta> = {
  easy: {
    label: 'Easy',
    color: '#3BB273',
    icon: '🌿',
    why: 'Easy runs build your aerobic engine and capillary network with minimal stress. They should feel conversational — if you can’t chat in full sentences, slow down.',
  },
  tempo: {
    label: 'Tempo',
    color: '#F5A623',
    icon: '🔥',
    why: 'Tempo (threshold) running trains your body to clear lactate faster, raising the pace you can hold for long efforts. It should feel “comfortably hard”.',
  },
  intervals: {
    label: 'Intervals',
    color: '#E5484D',
    icon: '⚡',
    why: 'Intervals push you near VO₂max to sharpen speed and running economy. Hit the target pace on each rep, then recover fully before the next.',
  },
  hills: {
    label: 'Hills',
    color: '#B368E5',
    icon: '⛰️',
    why: 'Hill repeats build strength and power with less impact than flat speedwork. Drive with the arms, stay tall, and jog down to recover.',
  },
  fartlek: {
    label: 'Fartlek',
    color: '#F06595',
    icon: '🎲',
    why: '“Speed play” mixes surges of faster running into an easy run. It develops pace variety and mental toughness in a relaxed, unstructured way.',
  },
  long: {
    label: 'Long run',
    color: '#2E8BFF',
    icon: '🛣️',
    why: 'The long run is the cornerstone of endurance — it builds fatigue resistance, fat metabolism, and mental durability. Keep it easy and steady.',
  },
  strength: {
    label: 'Strength',
    color: '#8B95A5',
    icon: '💪',
    why: 'Runner-specific strength work reduces injury risk and improves economy. Focus on control and full range of motion over speed.',
  },
  mobility: {
    label: 'Mobility',
    color: '#4CC9C0',
    icon: '🧘',
    why: 'Mobility work keeps hips, ankles, and thoracic spine supple so you move efficiently and recover well between hard sessions.',
  },
  rest: {
    label: 'Rest',
    color: '#5B6470',
    icon: '😴',
    why: 'Rest is when adaptation happens. Sleep, hydrate, and let the training you’ve done turn into fitness.',
  },
}
