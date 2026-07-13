# Remaining phases — implementation notes

Phases 0–3 are built. This is a working guide for finishing Phases 4–7 (and LATER) on your own machine. It points at the scaffolding already in place so each phase is additive, not a rewrite. The original spec is [../running-app-plan.md](../running-app-plan.md).

The data model already has every field these phases need — see `src/services/db/types.ts`. No Dexie migration should be required for 4–6.

---

## Phase 4 — File import (GPX / TCX / FIT)

**Goal:** a Zepp/watch export lands as a rich run with splits, HR, elevation, and a route map.

**Where it plugs in**
- New folder `src/services/importers/` — create `gpx.ts`, `tcx.ts`, `fit.ts`, plus a shared `preview.ts` mapper and `dedupe.ts`.
- The Log screen already has an **Import file** tab stub: `src/screens/Log/LogScreen.tsx` (`mode === 'import'`). Replace the placeholder card with a `<input type="file" accept=".gpx,.tcx,.fit">` → parse → preview → `logRun({ source, ... })`.
- `logRun` in `src/services/db/actions.ts` already accepts `source` and does session matching — extend `LogRunInput` with `splits`, `avgHR`, `maxHR`, `elevationGainM`, `track`, `rawFileName` (all already exist on the `Run` type).

**Parsers**
- **GPX** & **TCX** are XML — parse with `DOMParser` (no dependency). Extract trackpoints (lat/lng/ele/time). Derive distance via `haversine` / `trackDistanceKm` (already in `src/lib/haversine.ts`), then duration, avg pace, per-km `Split[]`, smoothed elevation gain. HR: GPX needs `gpxtpx` extensions; TCX has native `HeartRateBpm` + laps.
- **FIT** is binary — add `@garmin/fitsdk`, **lazy-loaded** (`const { Decoder } = await import('@garmin/fitsdk')`) so it's not in the main bundle. Map records + laps + session summary.
- Graceful fallback (spec §4.3): if splits can't be read, offer "save as manual entry with these totals".

**Map + elevation** (run detail)
- Add `react-leaflet` + `leaflet`, **code-split** with `React.lazy`. Render only in `src/screens/Stats/RunDetailScreen.tsx` when `run.track` exists (there's already a placeholder note there for exactly this).
- Elevation profile: small Recharts area chart (Recharts arrives in Ph5; you can add it here first).

**Storage**
- Compress `track` with a polyline codec (Google polyline algorithm) before storing — add `src/lib/polyline.ts`. The `Run.track` field is typed as the encoded `string`.
- **Dedupe** on save: reject/merge by matching date + distance + duration within a tolerance.

---

## Phase 5 — Stats & motivation

**Goal:** PRs, charts, race prediction, badges.

**Where it plugs in**
- `src/services/stats/` — add `prs.ts`, `streaks.ts`, `trends.ts`, `predictor.ts` next to the existing `matching.ts`.
- Tables `records` and `achievements` already exist in the schema.
- `src/screens/Stats/StatsScreen.tsx` already has "Personal records" and chart placeholders to fill in.

**Pieces**
- **PR engine** — run on every `logRun`/import save: fastest 5K/10K/Half/Full (whole-run distances ±2%), longest run, biggest week, longest streak → upsert into `records`. v1 keeps whole-run efforts only (rolling-window PRs inside long runs is a Future item).
- **Race predictor** — reuse `predictTimeSec(vdot, distanceKm)` already in `src/services/zones/vdot.ts`. Recompute from the best recent result; show predicted 5K/10K/Half/Full and gap-to-goal.
- **Charts (Recharts)** — weekly mileage bar (planned-vs-actual overlay; planned comes from `sessions.plannedDistanceKm`, actual from `runs`), monthly totals, easy-pace trend line, consistency heatmap.
- **Badges/streaks** — JSON badge definitions; weekly streak = consecutive weeks hitting ≥75% of planned sessions. PR unlock → celebration toast (the `Toast` provider already supports a `success` tone).

---

## Phase 6 — Coaching layer (rule-based)

**Goal:** weekly recap, adaptive engine with accept/undo, offline coach chat, JSON backup/restore.

**Where it plugs in**
- `src/services/coach/RuleBasedCoach.ts` already implements `generatePlan`; `adaptPlan`, `weeklyRecap`, and `chat` currently `throw` — implement them here against the existing `CoachEngine` interface (`CoachEngine.ts` already defines `PlanAdjustment`, `Compliance`, `WeekSummary`).
- Tables `recaps` and `chatMessages` already exist.
- `src/screens/Coach/CoachScreen.tsx` is a stub showing derived paces — build the chat UI + recap archive here.

**Pieces**
- **Weekly recap** — generate Monday / first-open-of-week: sessions planned vs done, mileage vs last week, best split, avg feel, the adaptation decision + reasoning, one focus. Rule-templated text. Store in `recaps`. Surface a card on Today (there's room in `TodayScreen`).
- **Adaptive engine** (spec §2.2) — evaluate at recap time: missed ≥2 → repeat/reduce; crushed 2+ wks → *offer* VDOT +1; struggling (feel ≤2) → add recovery, cut quality 20%. Write changes through `PlanAdjustment` and show accept/undo. Use `regenerateActivePlan` in `actions.ts` as a reference for rewriting sessions.
- **Coach chat (offline)** — answer from a curated local FAQ set; clearly label when a question is beyond offline mode. Persist to `chatMessages`.
- **JSON backup/restore** (spec §4, treat as non-optional) — `services/db/backup.ts`: `exportAll()` → `pacekeeper-backup-YYYY-MM-DD.json` (dump every table), `importAll(json)` restores. Wire the buttons in Settings ("Data & reminders" section is already stubbed). `settings.lastBackupAt` exists; prompt a monthly reminder.

---

## Phase 7 — Notifications + polish

- **Reminders** — service-worker + Notification API: evening-before ("Tomorrow: 6 km tempo"), morning-of, Monday recap, monthly backup. Android/Chrome first (Notification Triggers); iOS Safari PWA degrades to in-app banners — document, don't fight it. `settings.notificationsEnabled` exists.
- **Polish** — Framer Motion sheet transitions + PR celebrations, richer empty states, light-mode pass (Tailwind is already `darkMode: 'class'` — add a real toggle in Settings; `settings.theme` exists), proper app icon/splash (current PWA icons are generated placeholders).

---

## Phase LATER — Claude integration

No UI or data changes required.

1. Add one Vercel Edge Function `api/coach.ts` that proxies to the Anthropic API (keeps the key server-side). Use the latest model (e.g. `claude-sonnet-5` / `claude-opus-4-8`).
2. Add `src/services/coach/ClaudeCoach.ts` implementing `CoachEngine` — it POSTs chat + compact context (profile, current week, last 5 runs, goal) and writes plan changes through the same `PlanAdjustment` structure.
3. Add a settings toggle that switches the exported `coach` engine (`settings.coachEngine` field already exists: `'rule' | 'ai'`).

---

## Handy commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit — keep this green
npm run build      # verify PWA + bundle before shipping
```

Keep the bundle honest: import Leaflet, the FIT SDK, and heavy charts via dynamic `import()` / `React.lazy` so the everyday dashboard stays fast on mobile data.
