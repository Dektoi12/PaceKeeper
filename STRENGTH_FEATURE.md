# Strength Training — Build Progress

Status tracker for the strength feature. Full spec lives in `STRENGTH_FEATURE_PLAN.md`
(design doc). This file records what's built and what remains.

## ✅ Done — Phases 1–3 (branch `feature/strength-training`)

**Data**
- `StrengthPreferences` nested on the `settings` singleton — no Dexie migration. See `src/services/db/types.ts`.
- Scheduled strength/mobility are ordinary `Session` rows with an optional `strength` metadata field (`templateId`, `kind`, `runInterference`).
- `WorkoutStep.exercise` extended with optional `exerciseId` / `restSeconds` / `block` (backward-compatible).
- 24-exercise library (`src/services/strength/library.ts`) + 12 templates (`templates.ts`), bundled TS constants — no seeding.

**Engine** (`src/services/strength/`)
- `StrengthEngine` interface + `RuleBasedStrengthEngine` (mirrors `CoachEngine`). Exposes `scheduleWeek` only so far.
- `scheduler.ts` — placement rules (never high-interference the day before a hard/long run, ≥48h between high sessions, drop-under-load). Strength lands on non-run days only.
- `rotation.ts` — goal-based weekly rotation (derived from week index; no persisted rotation state).
- `resolve.ts` — equipment / duration / difficulty resolution with guaranteed bodyweight fallback.

**Integration**
- `generator.ts` places strength when `prefs.enabled`; legacy behaviour unchanged when off.
- `actions.ts` → `applyStrengthPreferences()` reschedules **future weeks only** (date ≥ today, upcoming), preserving run history. `completeOnboarding` / `regenerateActivePlan` pass prefs through.

**UI**
- 5-step onboarding wizard `src/screens/Strength/StrengthOnboardingScreen.tsx` (route `/strength/onboarding`). Shared primitives extracted to `src/components/wizard.tsx`.
- Plan entry-point banner + reduced-session banner (`PlanScreen.tsx`); strength-enriched cards (`SessionCard.tsx`).
- Block-labelled session detail with tappable exercise-info bottom sheet (`SessionDetailScreen.tsx`, `StepTimeline.tsx`, new `components/BottomSheet.tsx`).
- Settings → Strength section (`SettingsScreen.tsx`).

**Tooling** — Vitest added (`npm run test`). 29 tests: `resolve.test.ts`, `scheduler.test.ts`.

## ⬜ Remaining

### Phase 4 — Session Player (guided in-workout)
- [ ] Exercise-by-exercise player: set counter, rep target, one exercise per screen.
- [ ] Rest timer between sets (auto-start, skippable). No timer components exist yet — greenfield.
- [ ] `inProgress` persistence + "resume or discard" on reopen.
- [ ] Completion flow: perceived effort (1–5) + optional note → mark completed.
- Reuse: `BottomSheet` and `exerciseId`-tagged steps are already in place.

### Phase 5 — Polish + adaptivity
- [ ] Skip reasons (tired / no time / injury) + reschedule to another valid day.
- [ ] Adaptivity prompts (spec §7): skip-streak → reduce frequency; effort ≤2 ×3 → harder progressions, ≥5 → regressions. **Add `suggestAdjustment` to the `StrengthEngine` interface** (only `scheduleWeek` exists today).
- [ ] Manual/external strength log (Runna parity). **This needs the one new Dexie table `strengthActivityLog` → `db.version(2)` bump** (the migration we avoided in Phases 1–3).
- [ ] Surface completed strength sessions in Stats history + weekly strength streak.

### Deferred beyond v1
Demo videos, per-set weight logging, custom workout builder, `ClaudeStrengthEngine`, Strava-style export.

## Resume notes for another machine
- `git fetch && git checkout feature/strength-training`, then `npm install` (Vitest was added).
- Run intensity mapping used by the scheduler: `long → long`, quality run types (`tempo`/`intervals`/`hills`/`fartlek`) → `hard`, `easy → easy`. Defined in both `generator.ts` and `actions.ts`.
- Only Phase 5's external log requires a schema version bump; everything else is additive to existing rows.
