import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  proposeActivePlanAdjustment,
  applyPlanAdjustment,
  undoPlanAdjustment,
  sendChatMessage,
} from '@/services/db'
import type { AdaptationProposal } from '@/services/coach/adapt'
import { ScreenHeader, Card, SectionTitle } from '@/components/ui'
import { useActivePlan, useActiveGoal, useLatestAssessment, useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { formatPaceRange } from '@/lib/formatters'
import { formatLongDate } from '@/lib/dates'

export function CoachScreen() {
  const plan = useActivePlan()
  const goal = useActiveGoal()
  const assessment = useLatestAssessment()
  const units = useUnits()
  const toast = useToast()
  const zones = assessment?.derivedPaceZones

  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), [])
  const recaps = useLiveQuery(() => db.recaps.orderBy('weekStart').reverse().toArray(), [])

  const [proposal, setProposal] = useState<AdaptationProposal | null>(null)
  const [applied, setApplied] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    proposeActivePlanAdjustment().then(setProposal)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages?.length])

  async function accept() {
    if (!proposal) return
    await applyPlanAdjustment(proposal)
    setApplied(true)
    toast.show('Plan updated', 'success')
  }
  async function undo() {
    if (!proposal) return
    await undoPlanAdjustment(proposal.snapshot)
    setApplied(false)
    toast.show('Reverted')
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      await sendChatMessage(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <ScreenHeader title="Coach" subtitle="Offline mode" />

      <div className="px-4">
        {/* Adaptive suggestion */}
        {proposal && (
          <>
            <SectionTitle>This week's adjustment</SectionTitle>
            <Card className="border-l-4 border-accent-500">
              <p className="text-sm text-slate-200 font-medium">{proposal.adjustment.reason}</p>
              <p className="text-sm text-slate-400 mt-1">{proposal.adjustment.summary}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {!applied ? (
                  <>
                    <button className="btn-primary" onClick={accept}>
                      {proposal.offer ? 'Step up' : 'Apply'}
                    </button>
                    <button className="btn-ghost" onClick={() => setProposal(null)}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-session-easy self-center">✓ Applied</span>
                    <button className="btn-ghost" onClick={undo}>
                      Undo
                    </button>
                  </>
                )}
              </div>
            </Card>
          </>
        )}

        {/* Coach chat */}
        <SectionTitle>Ask your coach</SectionTitle>
        <Card className="flex flex-col">
          <div ref={scrollRef} className="flex flex-col gap-2 max-h-72 overflow-y-auto no-scrollbar">
            {(messages ?? []).length === 0 && (
              <p className="text-sm text-slate-500">
                Ask about easy pace, intervals, long runs, tapering, fuelling, or handling a missed week.
              </p>
            )}
            {(messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'self-end bg-accent-500 text-white'
                    : 'self-start bg-ink-700 text-slate-200'
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending && <div className="self-start text-xs text-slate-500 px-1">Coach is typing…</div>}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="How hard should my easy runs be?"
            />
            <button className="btn-primary px-4" onClick={send} disabled={!input.trim() || sending}>
              Send
            </button>
          </div>
        </Card>

        {/* Recap archive */}
        {(recaps ?? []).length > 0 && (
          <>
            <SectionTitle>Weekly recaps</SectionTitle>
            <div className="flex flex-col gap-2">
              {(recaps ?? []).map((r) => (
                <Card key={r.id}>
                  <p className="text-xs text-slate-500 mb-1">Week of {formatLongDate(r.weekStart)}</p>
                  <p className="text-sm text-slate-300">{r.recapText}</p>
                </Card>
              ))}
            </div>
          </>
        )}

        {goal && plan && (
          <>
            <SectionTitle>Current plan</SectionTitle>
            <Card>
              <p className="text-slate-100 font-medium capitalize">
                {goal.type} · {plan.weeks} weeks · {plan.engine === 'template' ? 'template' : 'adaptive (rule)'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {plan.startDate} → {plan.endDate}
              </p>
            </Card>
          </>
        )}

        {zones && (
          <>
            <SectionTitle>Your training paces</SectionTitle>
            <Card className="flex flex-col gap-2">
              <PaceRow label="Easy" range={formatPaceRange(zones.easy, units)} />
              <PaceRow label="Marathon" range={formatPaceRange(zones.marathon, units)} />
              <PaceRow label="Threshold" range={formatPaceRange(zones.threshold, units)} />
              <PaceRow label="Interval" range={formatPaceRange(zones.interval, units)} />
              <PaceRow label="Repetition" range={formatPaceRange(zones.repetition, units)} />
              {assessment?.derivedVdot && (
                <p className="text-xs text-slate-500 mt-1">VDOT {assessment.derivedVdot} · reference targets only</p>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function PaceRow({ label, range }: { label: string; range: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="stat-number text-slate-100">{range}</span>
    </div>
  )
}
