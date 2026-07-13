# Running Coach Web App — Detailed Build Plan

**Working title:** *PaceKeeper* (placeholder — rename anytime)
**Owner:** Dexter · Single-user · Phone-only · Local-first
**Inspiration:** Runna (plan generation, structured workouts, clean UI) — without Strava integration
**Date:** July 2026

---

## 1. Product Overview

A personal, phone-only web app that generates an adaptive running training plan, guides structured workouts, logs runs (manually or via watch-file import), and tracks long-term progress. It is a **planning dashboard**, not a live run tracker — actual runs are recorded on your watch, then exported (GPX/TCX/FIT) and imported into the app, or logged by hand.

### Core loop
1. Onboard once → app knows your level, goal, and schedule
2. Each week the plan shows structured sessions (paces, steps, targets)
3. You run with your watch → export the file → import it (or type it in)
4. The app matches the run to the planned session, updates stats/PRs
5. Weekly recap reviews the week; adaptive engine adjusts the coming weeks

### Locked decisions (from scoping)
| Decision | Choice |
|---|---|
| Platform | Web app, **phone-only**, installable PWA |
| Users | Single user (Dexter), no auth |
| Data | **Local-first** — Dexie.js / IndexedDB on-device |
| Run data source | Manual entry + **GPX / TCX / FIT import** from watch (Zepp export) |
| AI | Adaptive plans + AI coach chat + weekly recap — **API integration deferred** (no Anthropic credits yet). Built behind an abstraction with a rule-based fallback so the app works fully without AI. |
| HR zones | **Reference targets only** (calculated, never measured in-app) |
| Plans | Both **adaptive (AI)** and **fixed templates** paths |
| Map/elevation | Shown **only when a GPS file was imported**; stats-only summary for manual entries |

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite | Fast, familiar from GritKm |
| UI | React 18 + TypeScript | Familiar stack |
| Styling | Tailwind CSS | Rapid, consistent, dark-mode built-in (`dark:` variants) |
| Local DB | Dexie.js (IndexedDB wrapper) | Proven in GritKm; typed tables, live queries via `dexie-react-hooks` |
| Charts | Recharts | Proven in DexBudget |
| Map | Leaflet + OpenStreetMap tiles (`react-leaflet`) | Free, no API key, only loaded on runs with GPS data (lazy import) |
| File parsing | `@garmin/fitsdk` (FIT), custom lightweight parsers for GPX/TCX (both are XML — `DOMParser`, no dependency needed) | Keep bundle small |
| Routing | React Router v6 | Standard |
| Dates | `date-fns` | Light, tree-shakeable |
| State | React context + Dexie live queries | No Redux needed at this scale |
| PWA | `vite-plugin-pwa` | Installable, offline shell, enables notifications |
| Hosting | Vercel (static) | Free tier; ready to add one Edge Function later for the AI proxy |
| AI (later) | Anthropic API via a single Vercel Edge Function | Keeps key server-side; added only when credits exist |

**Bundle discipline:** Leaflet and the FIT parser are code-split (`React.lazy` / dynamic import) so the everyday dashboard stays fast on mobile data.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│                PHONE (PWA)                  │
│                                             │
│  React UI (mobile-first, dark mode)         │
│    │                                        │
│  Service layer (pure TS modules)            │
│    ├── planEngine/      plan gen + adapt    │
│    ├── coach/           AI abstraction      │
│    ├── importers/       GPX / TCX / FIT     │
│    ├── zones/           pace + HR zones     │
│    ├── stats/           PRs, trends, preds  │
│    └── notifications/   local reminders     │
│    │                                        │
│  Dexie.js  ──►  IndexedDB (all data)        │
│                                             │
│  Export/Import: full-data JSON backup       │
└─────────────────┬───────────────────────────┘
                  │ (Phase: LATER, when credits exist)
                  ▼
        Vercel Edge Function  ──►  Anthropic API
        (only the coach/ module calls this)
```

**Key principle:** everything except AI calls runs 100% on-device. The `coach/` module is the *only* thing that will ever touch a network endpoint, and it ships with a rule-based implementation first.

### 3.1 AI abstraction (build now, wire API later)

```ts
interface CoachEngine {
  generatePlan(profile: Profile, assessment: Assessment): Promise<TrainingPlan>;
  adaptPlan(plan: TrainingPlan, recentRuns: Run[], compliance: Compliance): Promise<PlanAdjustment>;
  weeklyRecap(week: WeekSummary): Promise<RecapText>;
  chat(history: ChatMessage[], context: CoachContext): Promise<string>;
}
```

Two implementations:
- **`RuleBasedCoach` (ships in v1):** deterministic plan generation from proven training logic (see §6.2), template-driven recaps ("You hit 3/4 sessions, mileage +8% vs last week…"), and a chat that answers from a small local FAQ / canned-guidance set (clearly labeled as offline mode).
- **`ClaudeCoach` (later):** same interface, calls the Edge Function. A settings toggle switches engines. Nothing else in the app changes.

This means **zero rework** when you add credits — you write one Edge Function and flip a flag.

---

## 4. Data Model (Dexie tables)

```ts
// db.ts — Dexie schema v1

profile            // singleton row
  { id, name, age, weightKg, units: 'km'|'mi',
    maxHR?, restingHR?, preferredRunDays: number[],   // 0–6
    experience: 'beginner'|'intermediate'|'advanced',
    createdAt, updatedAt }

goals
  { id, type: '5k'|'10k'|'half'|'full'|'ultra'|'fitness',
    targetDate?, targetTime?, status: 'active'|'done'|'abandoned' }

assessments        // fitness baselines over time
  { id, date, method: 'recentRace'|'weeklyMileage'|'benchmarkRun',
    distanceKm?, timeSec?, weeklyKm?, notes,
    derivedVdot?, derivedZones: PaceZones }

plans
  { id, goalId, engine: 'rule'|'ai'|'template',
    templateId?, startDate, endDate, weeks: number,
    status: 'active'|'completed'|'archived',
    generatedAt, lastAdaptedAt? }

sessions           // every planned session in a plan
  { id, planId, date, weekNumber, dayOfWeek,
    type: 'easy'|'tempo'|'intervals'|'hills'|'fartlek'|'long'|'strength'|'mobility'|'rest',
    title, description,
    steps: WorkoutStep[],          // §6.3.3
    targetPaceRange?, targetZone?, plannedDistanceKm?, plannedDurationMin?,
    status: 'upcoming'|'completed'|'skipped'|'moved',
    linkedRunId?, completedAt? }

runs               // actual logged runs
  { id, date, source: 'manual'|'gpx'|'tcx'|'fit',
    distanceKm, durationSec, avgPaceSecPerKm,
    feel?: 1|2|3|4|5, effortRPE?: 1..10, notes?,
    splits?: Split[],              // per-km/mi
    avgHR?, maxHR?,                // from file if present
    elevationGainM?, track?: LatLng[] (compressed),
    rawFileName?, matchedSessionId? }

records            // PRs, auto-maintained
  { id, kind: 'fastest5k'|'fastest10k'|'fastestHalf'|'fastestFull'|
          'longestRun'|'biggestWeek'|'longestStreak',
    value, runId?, achievedAt }

achievements
  { id, badgeId, unlockedAt }

recaps             // weekly check-ins
  { id, weekStart, summary: WeekSummary, recapText, engine: 'rule'|'ai' }

chatMessages       // AI coach conversation (persists locally)
  { id, role: 'user'|'coach', text, createdAt }

settings           // theme, notifications, engine toggle, etc.
```

**Storage safety (important, local-first risk):**
- `navigator.storage.persist()` requested on first launch → asks the browser not to evict IndexedDB.
- **JSON backup:** Settings → "Export all data" produces a single `pacekeeper-backup-YYYY-MM-DD.json`; matching import restores everything. This is your insurance against phone loss / browser data clearing. Prompt a backup reminder monthly.
- GPS tracks are stored polyline-encoded (Google polyline algorithm) to keep IndexedDB small (~90% smaller than raw lat/lng arrays).

---

## 5. Screens & Navigation (mobile-first)

Bottom tab bar, 5 tabs — the Runna pattern:

```
┌──────────────────────────────┐
│  Today │ Plan │ + Log │ Stats │ Coach  │
└──────────────────────────────┘
```

| Screen | Contents |
|---|---|
| **Today** (home) | Today's session focus card (§6.2.5), quick stats strip (week mileage, streak), "next 3 days" mini-preview, weekly recap card on Mondays |
| **Plan** | Week view (default) ↔ month calendar toggle; tap a session → detail sheet; long-press → move/swap/skip |
| **+ Log** (center FAB) | Two paths: "Enter manually" or "Import file (GPX/TCX/FIT)" |
| **Stats** | Run history list, PRs, mileage charts, race predictor, badges |
| **Coach** | Chat UI (rule-based v1, Claude later), weekly recaps archive, plan settings (regenerate/adapt) |

Plus: **Onboarding wizard** (first launch only) and **Settings** (profile edit, units, dark mode, zones, backup, notifications, AI engine toggle).

---

## 6. Feature Specifications

### 6.1 Onboarding & Profile

**1.1 Multi-step onboarding wizard** — 7 steps, one question per screen (Runna/Runna-style, swipe/next):
1. Name + age + weight
2. Experience level (beginner / intermediate / advanced — with plain-language descriptions)
3. Goal (1.2): 5K / 10K / Half / Full / Ultra / Just stay fit
4. Target race date (optional; skipped for "stay fit") + target time (optional)
5. Fitness assessment (1.3) — pick ONE method:
   - Recent race/run result (distance + time)
   - Typical weekly mileage + longest recent run
   - "I'll do a benchmark run" → app schedules a 20-min best-effort test as session #1 and generates the plan after it's logged
6. Weekly availability: how many run days (2–6) + which days (preferred run days)
7. Review screen → "Generate my plan" → plan engine runs → land on Today

Progress dots, back navigation, all answers editable later in Settings. State held in a wizard context, committed to Dexie only at the final step.

**1.4 Pace/HR zone calculation**
- **Pace zones:** VDOT-style derivation from the assessment (race result → equivalent performances → training paces). Produces: Easy, Marathon, Threshold, Interval, Repetition pace ranges. Stored on the assessment; every session's target pace references these.
- **HR zones (reference only):** Max HR = user-entered or `211 − 0.64 × age` (Nes formula); zones Z1–Z5 as % of max (or Karvonen if resting HR entered). Displayed on session cards as a secondary target ("Z2 · 5:50–6:20 /km"). Clearly labeled *reference* — the app never measures HR, though imported FIT/TCX files that contain HR will display avg/max HR on the run summary for comparison.

**1.5 Editable profile** — Settings screen; changing age/assessment offers to recalculate zones; changing preferred days offers to re-flow future sessions.

### 6.2 Training Plans

**2.1 Auto-generated personalized plan (rule engine v1)**
Deterministic generator, inputs: goal, target date, experience, assessment (VDOT), run days/week.
- Plan length: from target date (capped 8–20 weeks) or default per goal (5K: 8w, 10K: 10w, Half: 12w, Full: 16w, Fitness: rolling 4-week blocks).
- Structure: base → build → peak → taper phases; weekly mileage progression capped at **+10%/week**; every 4th week is a cutback week (−25%).
- Weekly skeleton by run days (e.g., 4 days = easy / quality / easy / long). Quality session rotates tempo → intervals → hills/fartlek through the build phase.
- Long run grows toward goal-appropriate max (e.g., Half peaks at 18–20 km).
- All paces pulled from the user's zones.

**2.2 Adaptive plan**
Adaptation triggers evaluated at weekly recap time (and on-demand from Coach tab):
- **Missed sessions** (≥2 in a week): next week repeats or reduces load rather than progressing; long-run growth pauses.
- **Crushed sessions** (runs consistently ≥15 s/km faster than target at reported easy effort, 2+ weeks): offer zone bump (re-derive VDOT +1) — always *offer*, never silently change.
- **Struggling** (feel ≤2 on multiple runs, or paces >20 s/km slow): insert extra recovery, cut quality volume 20%.
- Rule engine handles all of the above deterministically in v1; `ClaudeCoach` later replaces the *decision* layer with richer reasoning but writes changes through the same `PlanAdjustment` structure (auditable, shown to user as "Coach adjusted next week: …" with accept/undo).

**2.3 Fixed templates** — 5–6 hand-authored JSON templates (Couch-to-5K, 10K in 10 weeks, Half 12w, Full 16w, Base-building 6w). Chosen at onboarding ("Keep it simple") or from Coach tab. Never auto-adapts; manual edits still allowed.

**2.4 Calendar view** — Week strip (horizontal, default) and month grid. Color-coded by session type; completed = filled dot, skipped = struck through, today highlighted. Tap → session detail bottom sheet.

**2.5 Today's session card** — Hero card on home: type badge, title, distance/duration, target pace + zone chip, first 2 steps preview, buttons: *View workout* / *Log this run* / *Skip*. Rest days get a rest/mobility card. If a session was missed yesterday, a gentle "Yesterday's tempo wasn't logged — move it or skip it?" prompt.

**2.6 Manual plan editing** — Long-press (or ⋮ menu) on any session: **Move** (pick new date within the week or drag in week view), **Swap** with another session this week, **Skip** (marks skipped, feeds adaptation), **Edit** (change distance/steps for one-off tweaks). Guard: warns if moving a quality session adjacent to the long run.

**2.7 Strength & mobility woven in** — Each plan week includes 1–2 non-running sessions from a small built-in library (runner's strength A/B: ~8 bodyweight exercises each — squats, lunges, calf raises, planks, glute bridges, etc. — matching your calisthenics level; 15-min mobility routine for rest days). Rendered as checklist-style sessions with per-exercise sets/reps; completing them counts toward streaks.

### 6.3 Workouts & Guidance

**3.1 Structured workout types** — easy, tempo, intervals, hills, fartlek, long (+ strength/mobility/rest). Each type has an icon, color, and a one-paragraph "why this session matters" education blurb (Runna does this well — worth copying the *pattern*).

**3.2 Per-session targets** — every running session shows target pace range (from zones) + HR zone chip + expected RPE ("should feel: comfortable, conversational").

**3.3 Step-by-step breakdown** — sessions store an ordered `WorkoutStep[]`:

```ts
type WorkoutStep =
  | { kind: 'warmup'|'cooldown'; durationMin: number; zone: 'Z1'|'Z2' }
  | { kind: 'run'; distanceKm?: number; durationMin?: number; targetPace: PaceRange; zone: Zone }
  | { kind: 'recover'; durationMin: number; mode: 'jog'|'walk'|'rest' }
  | { kind: 'repeat'; times: number; steps: WorkoutStep[] }   // nested reps
```

Rendered as a clean vertical timeline (warmup → 6× [800m @ 4:45 + 90s jog] → cooldown) with total distance/time computed. This is what you glance at before heading out and set up on your watch manually.

### 6.4 Run Tracking & Logging

**4.2 Manual entry** — form: date, distance, duration (pace auto-computed live), **feel** (5 emoji scale — this is a first-class field, it drives adaptation), RPE (1–10 optional), notes, optional manual splits. Pre-fills distance/date from today's planned session if one exists.

**4.3 GPX / TCX / FIT import** — the "+ Log → Import file" path:
- File picker accepts `.gpx`, `.tcx`, `.fit` (covers Zepp/Amazfit and virtually every watch export).
- **GPX:** XML — extract trackpoints (lat/lng/ele/time), derive distance (haversine), duration, pace, per-km splits, elevation gain (smoothed). HR only if `gpxtpx` extensions present.
- **TCX:** XML — same, plus native HR/laps/calories.
- **FIT:** binary — parsed with `@garmin/fitsdk` (lazy-loaded); records + laps + session summary; richest HR data.
- Post-parse **preview screen**: computed stats + mini map, user adds feel/RPE/notes, confirms save. Dedupe check by date+distance+duration to avoid double imports.
- Parsing failures fall back gracefully: "Couldn't read splits — save as manual entry with these totals?"

**4.4 Post-run summary** — run detail screen:
- Always: distance, duration, avg pace, feel/RPE, notes, splits table (with fastest/slowest highlighting), pace-per-split bar chart, HR avg/max if present, vs-target comparison when matched to a session ("Target 5:30–5:50 → you ran 5:38 ✅").
- **Only for imported files:** route map (Leaflet, lazy-loaded) + elevation profile chart. Manual runs simply omit these sections — no empty placeholders.

**4.5 Session matching** — on save, auto-match to a planned session: same-day session of compatible type/distance (±25%) → auto-link + mark completed, with a toast ("Matched to today's Tempo — nice one") and an *unlink* option. If no match: "Log as extra run" or manual "attach to a session" picker. Matching a run also stamps actual-vs-planned data used by adaptation.

### 6.5 Progress & Stats

**5.1 Run history** — reverse-chron list, month section headers, each row: date, type icon (if matched), distance, pace, feel emoji, source icon (✍️/📁). Filters: type, date range. Tap → run detail.

**5.2 Personal records** — auto-maintained on every save: fastest 5K/10K/Half/Full (from best matching-distance runs ±2%, and best rolling-window efforts within longer imported runs — v1 keeps it simple: whole-run distances only, rolling-window PRs listed under Future), longest run, biggest week, longest streak. PR unlock → celebration toast + badge.

**5.3 Charts (Recharts)** — weekly mileage bar chart (12-week window, planned-vs-actual overlay), monthly totals, avg pace trend line for easy runs (fitness proxy), training-load consistency calendar heatmap (GitHub-style).

**5.4 Race-time prediction** — VDOT equivalent-performance table from your best recent result (recomputed as new PRs land): predicted 5K/10K/Half/Full times + required goal pace vs current predicted pace ("You're 12 s/km away from your 1:59 half goal"). Shown on Stats and referenced in weekly recaps.

**5.5 Achievements/badges/streaks** — local badge definitions (JSON): first run, first import, 7-day streak, 50/100/500 km lifetime, first sub-X 5K, 4-week plan compliance ≥80%, cutback-week respected, etc. Streak = consecutive weeks hitting ≥75% of planned sessions (weekly streak is kinder than daily for a runner). Badge wall on Stats tab.

### 6.6 Coaching Intelligence

**6.1 AI coach chat** *(added per your update — API deferred)* — chat UI on Coach tab. v1 `RuleBasedCoach` answers from a curated local knowledge set (pacing questions, "should I run if sore?", plan-mechanics help) and clearly says when a question is beyond offline mode. When Anthropic credits exist: flip the settings toggle → `ClaudeCoach` sends chat + compact context (profile, current week, last 5 runs, goal) through the Edge Function. Conversation history persists locally either way.

**6.3 Weekly check-in / recap** — generated every Monday (or first open of the week): sessions planned vs done, mileage vs last week, best moment (fastest split / longest run), feel-score average, adaptation decision + reasoning ("Next week holds steady — you skipped the long run"), one focus for the coming week. Rule-templated text in v1; Claude-written later. Recap card on Today, archive on Coach tab.

### 6.7 App Shell & Platform

**7.4 Notifications/reminders** — requires PWA install (which is the plan anyway):
- Local scheduled reminders via service worker + Notification API: evening-before reminder ("Tomorrow: 6 km tempo") and morning-of ("Today: …") at user-set times; weekly recap ping Monday morning; monthly backup reminder.
- Honest limitation: without a push server, scheduled notifications on iOS Safari PWAs are unreliable; on Android/Chrome, the Notification Triggers / periodic sync path works reasonably. Ship Android-first behavior; if you're on iOS, reminders degrade to in-app banners. (You can add a free push service later if this matters.)

**7.5 Dark mode + Runna-style UI**
- Design direction: near-black background (#0B0E11-ish), one saturated accent (Runna uses lime — pick your own, e.g. electric orange to echo your other brand work or a mint/lime), big numeric typography for stats (Inter Tight display + Inter text — you already own this pairing), generous cards with 16–20px radius, session-type color coding, subtle micro-animations (Framer Motion for sheet transitions and PR celebrations).
- Dark mode default; light mode via Tailwind `dark:` class toggle in Settings.
- Everything thumb-reachable: bottom nav, bottom sheets over modals, FAB for logging.

---

## 7. Build Phases

Sequenced so the app is *usable end-to-end early*, then deepens. Each phase is a shippable checkpoint.

**Phase 0 — Foundation (setup)**
Vite + React + TS + Tailwind + Router + Dexie schema + dark theme tokens + bottom-nav shell with empty screens. PWA plugin configured (installable shell).
*Done when: app installs to home screen, tabs navigate, DB opens.*

**Phase 1 — Onboarding + rule-based plan generation**
Wizard (1.1–1.3, 1.5), zone engine (1.4), rule plan generator (2.1), fixed templates (2.3), plan storage.
*Done when: finishing onboarding produces a full multi-week plan in Dexie.*

**Phase 2 — Plan surfaces**
Today card (2.5), week/month calendar (2.4), session detail with steps/targets (3.1–3.3), manual editing (2.6), strength/mobility sessions (2.7).
*Done when: you can live off the plan day-to-day.*

**Phase 3 — Logging core**
Manual entry (4.2), session matching (4.5), run history (5.1), basic run detail (4.4 stats-only).
*Done when: full loop works — plan → run → log → completed.*
**← After Phase 3 the app is genuinely usable. Start running on it here.**

**Phase 4 — File import**
GPX parser → TCX → FIT (in that order of difficulty), import preview flow, splits/elevation/HR extraction, map + elevation on run detail (4.3, full 4.4), polyline compression, dedupe.
*Done when: a Zepp export lands as a rich run with map.*

**Phase 5 — Stats & motivation**
PR engine (5.2), charts (5.3), race predictor (5.4), badges/streaks (5.5).

**Phase 6 — Coaching layer (rule-based)**
Weekly recap (6.3), adaptive engine (2.2) with accept/undo UI, coach chat with offline knowledge set (6.1), JSON backup/restore + persistence request.

**Phase 7 — Notifications + polish**
Reminders (7.4), micro-animations, empty states, PR celebrations, light-mode pass, icon/splash.

**Phase LATER — Claude integration (when credits exist)**
One Vercel Edge Function (`/api/coach`), `ClaudeCoach` implementing the existing interface, settings toggle, prompt design for plan-adaptation + recap + chat. **No UI or data changes required.**

---

## 8. Project Structure

```
src/
  app/            router, providers, layout, bottom-nav
  screens/        Today/ Plan/ Log/ Stats/ Coach/ Onboarding/ Settings/
  components/     ui primitives (Card, Sheet, Chip, StatNumber…), session cards, charts
  services/
    db/           dexie schema, migrations, backup/restore
    planEngine/   generator, templates/, adaptation rules
    coach/        CoachEngine interface, RuleBasedCoach, (ClaudeCoach later)
    importers/    gpx.ts, tcx.ts, fit.ts (lazy), preview mapper, dedupe
    zones/        vdot tables, pace zones, hr zones
    stats/        prs, streaks, trends, predictor
    notifications/
  lib/            date utils, polyline codec, haversine, formatters
  theme/          tokens, dark/light
public/           icons, manifest
api/              (empty until Phase LATER: coach.ts edge function)
```

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| IndexedDB data loss (cleared browser data, lost phone) | `storage.persist()`, monthly backup reminder, one-tap JSON export/restore — **build in Phase 6, treat as non-optional** |
| FIT parsing edge cases (vendor quirks, Zepp variants) | GPX first (simplest, universal), FIT last; graceful fallback to totals-only save; keep a few sample exports from your watch as test fixtures |
| iOS PWA notification limits | Android-first assumption; in-app banner fallback; documented, not fought |
| Rule-based plans feel dumb vs Runna | VDOT-grounded paces + 10% progression + cutback weeks covers ~90% of what makes Runna plans feel smart; AI upgrade path already architected |
| Scope creep (this is a big feature list) | Phase gates — the app is usable at Phase 3; everything after is additive |
| Leaflet/FIT bundle weight on mobile | Dynamic imports; both load only when an imported run is opened |

## 10. Deferred / Future Ideas

- Claude-powered coach (architected, waiting on credits)
- Rolling-window PRs inside long runs (fastest 5K *within* a 15K)
- Push-server notifications for iOS reliability
- Shareable run cards (image export) — you skipped 8.4 but it's cheap later
- Optional Supabase backup mirror if JSON backups feel too manual
- Multi-goal seasons (back-to-back plans with recovery blocks)
