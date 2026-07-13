# PaceKeeper 🏃

A personal, phone-only, **local-first** running coach PWA — adaptive training plans, structured workouts, and run logging, all on-device. Runna-inspired, no Strava, no account, no backend. Built with the AI coach behind an abstraction so it can be wired to Claude later without touching the rest of the app.

> Working title. Single-user. Dark-mode first. Installable PWA.

---

## Status

Phases **0–3** are built and working — the full **onboard → plan → run → log → completed** loop.

| Phase | Scope | State |
|---|---|---|
| 0 · Foundation | Vite/React/TS/Tailwind, Dexie schema (all tables), PWA shell, bottom-nav | ✅ Done |
| 1 · Onboarding + plans | 7-step wizard, VDOT pace/HR zones, rule plan generator, templates | ✅ Done |
| 2 · Plan surfaces | Today card, week/month calendar, session detail timeline, move/swap/skip, strength/mobility | ✅ Done |
| 3 · Logging | Manual entry, session matching (±25%), run history, run detail w/ vs-target | ✅ Done |
| 4 · File import | GPX/TCX/FIT import, route map, elevation, splits, polyline compression | ⬜ Next |
| 5 · Stats & motivation | PR engine, charts, race predictor, badges/streaks | ⬜ |
| 6 · Coaching (rule) | Weekly recap, adaptive engine, coach chat (offline), JSON backup/restore | ⬜ |
| 7 · Notifications + polish | Reminders, animations, empty states, light mode, icons | ⬜ |
| LATER · Claude | `/api/coach` Edge Function + `ClaudeCoach` (same interface) | ⬜ |

See [docs/ROADMAP.md](docs/ROADMAP.md) for concrete implementation notes on 4–7, and [running-app-plan.md](running-app-plan.md) for the original full spec.

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build (generates PWA service worker)
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

Requires Node 18+ (developed on Node 26). First launch drops you into onboarding; finishing it generates a plan into IndexedDB and lands you on Today.

---

## Tech stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** — dark-mode first, electric-blue accent, session-type color tokens
- **Dexie.js** (IndexedDB) + `dexie-react-hooks` live queries — all data on-device
- **React Router v6**, **date-fns**
- **vite-plugin-pwa** — installable, offline shell

Recharts / Leaflet / the FIT parser are intentionally **not** installed yet — they're code-split additions in Phases 4–5 to keep the mobile bundle lean (~112 KB gzip today).

---

## Project structure

```
src/
  app/          router, providers, layout, BottomNav, hooks
  screens/      Today · Plan · Log · Stats · Coach · Onboarding · Settings (+ detail screens)
  components/    Card, Chip, StatNumber, SessionCard, StepTimeline, FeelPicker, ZoneChip, Toast…
  services/
    db/         Dexie schema (all §4 tables), actions (onboarding, logRun, session edits), types
    planEngine/ generator, templates, exercises, sessionMeta
    zones/      vdot (Daniels/Gilbert), paceZones, hrZones
    stats/      matching (session ↔ run)      ← prs/trends/predictor land in Ph5
    coach/      CoachEngine interface + RuleBasedCoach (generatePlan real; adapt/recap/chat stubbed)
  lib/          dates, formatters (pace/distance/units), haversine, id
public/          PWA icons, manifest
```

### Key design decisions

- **Full DB schema up-front** (`services/db/types.ts` + `db.ts`) — every table from the spec exists now, so Phases 4–6 add data without a migration.
- **AI behind an interface** — `services/coach/CoachEngine.ts`. `RuleBasedCoach` ships now; a `ClaudeCoach` implementing the same interface is the only new code the LATER phase needs.
- **VDOT engine** — race result → VDOT (Gilbert/Daniels), training paces as calibrated fractions of vVDOT. Validated: a 20:00 5K → VDOT ≈ 50.
- **Session updates go through `patchSession`** (Collection.modify callback) because Dexie's typed `Table.update` can't express `Session.steps` (the `WorkoutStep.repeat` type is self-referential).

---

## Data & privacy

Everything lives in IndexedDB on the device. `navigator.storage.persist()` is requested on launch to reduce eviction risk. JSON backup/restore is the planned insurance against data loss (Phase 6) — until then, treat the data as device-local and non-portable.

🤖 Scaffolded with [Claude Code](https://claude.com/claude-code)
