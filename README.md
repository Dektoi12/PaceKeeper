# PaceKeeper 🏃

A personal, phone-only, **local-first** running coach PWA — adaptive training plans, structured workouts, and run logging, all on-device. Runna-inspired, no Strava, no account, no backend. Built with the AI coach behind an abstraction so it can be wired to Claude later without touching the rest of the app.

> Working title. Single-user. Dark-mode first. Installable PWA.

---

## Status

Phases **0–7** are built and working — onboarding, plans, logging, file import, stats,
rule-based coaching, and notifications/polish are all in. Only **Phase LATER** (wiring
up the Claude-backed coach) remains.

| Phase | Scope | State |
|---|---|---|
| 0 · Foundation | Vite/React/TS/Tailwind, Dexie schema (all tables), PWA shell, bottom-nav | ✅ Done |
| 1 · Onboarding + plans | 7-step wizard, VDOT pace/HR zones, rule plan generator, templates | ✅ Done |
| 2 · Plan surfaces | Today card, week/month calendar, session detail timeline, move/swap/skip | ✅ Done |
| 3 · Logging | Manual entry, session matching (±25%), run history, run detail w/ vs-target | ✅ Done |
| 4 · File import | GPX/TCX/FIT import, route map, elevation, splits, polyline compression | ✅ Done |
| 5 · Stats & motivation | PR engine, charts, race predictor, badges/streaks | ✅ Done |
| 6 · Coaching (rule) | Weekly recap, adaptive engine, coach chat (offline), JSON backup/restore | ✅ Done |
| 7 · Notifications + polish | Reminders, animations, empty states, light mode, icons | ✅ Done |
| LATER · Claude | `/api/coach` Edge Function + `ClaudeCoach` (same interface) | ⬜ |

See [docs/ROADMAP.md](docs/ROADMAP.md) for how each phase plugs in, and [running-app-plan.md](running-app-plan.md) for the original full spec.

### Since v0.1 (post-Phase-7 refinements)

- Dropdown time pickers (hrs/min/sec) replace free-text `mm:ss` entry in onboarding and run logging.
- A unit-aware **pace calculator** (Settings → Tools) solving pace/time/distance from the other two.
- A **profile editor** (Settings → Profile) for name/age/weight/experience/HR, with a live HR-zones preview.
- A **personal-records editor** (Stats → Personal records) to add or correct PBs — overriding a race
  PB re-derives training paces and regenerates the plan.
- A **training baseline** control (Settings) to set peak weekly mileage; the plan now ramps up to it
  over the block instead of starting there.
- The built-in strength/mobility training feature was removed — plans are running + rest days only,
  in favor of a separate, dedicated strength-training app that interoperates with PaceKeeper.

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
- **Tailwind CSS** — dark/light themes, electric-blue accent, session-type color tokens
- **Dexie.js** (IndexedDB) + `dexie-react-hooks` live queries — all data on-device
- **React Router v6**, **date-fns**, **Framer Motion** (toasts/transitions)
- **Recharts** (stats charts) and **Leaflet / react-leaflet** (route map) — both code-split
  with `React.lazy` so they don't weigh down the everyday screens
- **@garmin/fitsdk** — lazy-loaded FIT binary parsing (GPX/TCX parse via `DOMParser`, no dependency)
- **vite-plugin-pwa** — installable, offline shell

---

## Project structure

```
src/
  app/          router, providers, layout, BottomNav, hooks
  screens/      Today · Plan · Log · Stats · Coach · Onboarding · Settings · Profile · Tools (+ detail screens)
  components/    Card, Chip, StatNumber, SessionCard, StepTimeline, FeelPicker, ZoneChip,
                 DurationPicker, Toast…
  services/
    db/          Dexie schema (all tables), actions (onboarding, logRun, PR/profile edits,
                 weekly-mileage baseline, session edits), backup (export/import JSON), types
    planEngine/  generator, templates, sessionMeta
    zones/       vdot (Daniels/Gilbert), paceZones, hrZones
    stats/       matching, prs, badges, streaks, trends, predictor
    importers/   gpx, tcx, fit (+ dedupe, preview mapper, DOM helpers)
    coach/       CoachEngine interface + RuleBasedCoach (plan/adapt/recap/faq/chat)
    notifications/ Notification API wrapper (reminders)
  lib/          dates, formatters (pace/distance/units), haversine, polyline, id
public/          PWA icons, manifest
scripts/         Node verify harnesses (parsers/import/stats/coach) — see docs/ROADMAP.md
```

### Key design decisions

- **Full DB schema up-front** (`services/db/types.ts` + `db.ts`) — every table from the spec was defined before Phase 4, so later phases added data without a migration. Removing a feature (like strength/mobility sessions) instead ships a one-time startup migration (`main.tsx`) that repairs any legacy rows on-device.
- **AI behind an interface** — `services/coach/CoachEngine.ts`. `RuleBasedCoach` ships now; a `ClaudeCoach` implementing the same interface is the only new code the LATER phase needs.
- **VDOT engine** — race result → VDOT (Gilbert/Daniels), training paces as calibrated fractions of vVDOT. Validated: a 20:00 5K → VDOT ≈ 50. Overriding a race PB in Stats re-derives VDOT and regenerates the plan.
- **Session updates go through `patchSession`** (Collection.modify callback) because Dexie's typed `Table.update` can't express `Session.steps` (the `WorkoutStep.repeat` type is self-referential).
- **Peak-based mileage ramp** — the weekly-mileage baseline (Settings) is treated as the *peak* the plan builds toward, with the starting week scaled by experience level, rather than as the starting volume itself.

---

## Data & privacy

Everything lives in IndexedDB on the device. `navigator.storage.persist()` is requested on launch to reduce eviction risk. Export a JSON backup any time from **Settings → Data & backup** (and restore it there too) — that's your insurance against device loss or browser data clearing.

🤖 Scaffolded with [Claude Code](https://claude.com/claude-code)
