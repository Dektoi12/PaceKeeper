import type { Zone, PaceRange, Units } from '@/services/db/types'
import { formatPaceRange } from '@/lib/formatters'
import { Chip } from './ui'

const ZONE_COLOR: Record<Zone, string> = {
  Z1: '#5B6470',
  Z2: '#3BB273',
  Z3: '#4CC9C0',
  Z4: '#F5A623',
  Z5: '#E5484D',
}

export function ZoneChip({
  zone,
  pace,
  units,
}: {
  zone?: Zone
  pace?: PaceRange
  units: Units
}) {
  if (!zone && !pace) return null
  const color = zone ? ZONE_COLOR[zone] : '#2E8BFF'
  return (
    <Chip color={color}>
      {zone && <span className="font-semibold">{zone}</span>}
      {pace && <span>· {formatPaceRange(pace, units)}</span>}
    </Chip>
  )
}
