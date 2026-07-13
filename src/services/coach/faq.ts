// Curated offline FAQ for the rule-based coach chat. Matching is keyword-based
// and deliberately simple — the goal is to answer common training questions
// helpfully and to be honest when a question needs the (later) AI coach.

interface FaqEntry {
  keywords: string[]
  answer: string
}

const FAQ: FaqEntry[] = [
  {
    keywords: ['easy', 'slow', 'conversational', 'zone 2'],
    answer:
      'Easy runs should feel conversational — you could talk in full sentences. Most of your weekly volume (roughly 80%) should sit here. If you can only gasp a few words, you\'re going too hard.',
  },
  {
    keywords: ['tempo', 'threshold', 'comfortably hard'],
    answer:
      'Tempo/threshold runs are "comfortably hard" — sustainable for about an hour in a race. They lift the pace you can hold before fatigue builds. Keep them controlled; they should feel strong, not all-out.',
  },
  {
    keywords: ['interval', 'speed', 'vo2', 'reps', 'track'],
    answer:
      'Intervals develop VO2 max and top-end speed. Run the work portions hard but repeatable, and take the full recovery — the recovery is what lets you hit quality on every rep.',
  },
  {
    keywords: ['long run', 'long', 'endurance'],
    answer:
      'The long run builds aerobic endurance and fatigue resistance. Keep it easy — time on feet matters more than pace. Build distance gradually (about 10% per week) and fuel if it runs past ~90 minutes.',
  },
  {
    keywords: ['rest', 'recovery', 'day off', 'sore'],
    answer:
      'Rest is where adaptation happens. Take your rest days seriously, prioritise sleep, and if you\'re unusually sore or run-down, swapping a hard day for easy or rest is smart, not weak.',
  },
  {
    keywords: ['taper', 'race week', 'before race'],
    answer:
      'In the final 1–2 weeks, cut volume by 30–50% while keeping a little intensity so you stay sharp. You should arrive at the start line feeling almost restless — that\'s a good taper.',
  },
  {
    keywords: ['injury', 'hurt', 'pain', 'niggle'],
    answer:
      'Sharp or worsening pain means stop and assess — pushing through injury costs far more training than a few easy days. General niggles often settle with easy running, but persistent pain is worth a professional opinion.',
  },
  {
    keywords: ['fuel', 'eat', 'nutrition', 'gel', 'carb'],
    answer:
      'For runs under ~75 minutes, water is usually enough. Beyond that, aim for 30–60 g of carbohydrate per hour and practise your race-day fuelling in training so nothing is a surprise.',
  },
  {
    keywords: ['pace', 'how fast', 'target pace'],
    answer:
      'Your target paces come from your VDOT estimate — check the training paces on this screen. Match each run to its zone: easy days easy, hard days hard. The magic is in the contrast, not in running everything medium.',
  },
  {
    keywords: ['missed', 'skip', 'behind', 'missed a run'],
    answer:
      'Missing a run or two won\'t derail you — don\'t try to cram them back in. Pick up the plan where it is. If you miss a lot, the weekly recap will suggest easing the next week so you rebuild safely.',
  },
]

const FALLBACK =
  "I’m your offline coach, so I stick to common training questions — easy vs tempo vs intervals, long runs, rest, tapering, fuelling, pacing, and handling missed sessions. Ask me about any of those. Deeper, personalised coaching arrives when you enable the AI coach in Settings."

/** Best-effort answer from the local FAQ, or a labelled offline fallback. */
export function answerFaq(question: string): string {
  const q = question.toLowerCase()
  let best: { entry: FaqEntry; hits: number } | null = null
  for (const entry of FAQ) {
    const hits = entry.keywords.filter((k) => q.includes(k)).length
    if (hits > 0 && (!best || hits > best.hits)) best = { entry, hits }
  }
  return best ? best.entry.answer : FALLBACK
}
