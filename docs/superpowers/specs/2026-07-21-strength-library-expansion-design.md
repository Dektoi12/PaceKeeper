# Strength Library Expansion — Design

Date: 2026-07-21

## Purpose

`STRENGTH_LIBRARY` (`src/services/strength/library.ts`) has 24 exercises across
legs/core/push/pull, plus a 13-item mobility pool used by the warm-up/cool-down
routines. The user wants moderate growth (~doubling) of the strength-category
exercises, now open to dumbbell/band/pull-up-bar equipment (not bodyweight-only
as originally scoped), while keeping the mobility pool untouched.

## Constraint: dataset-verified only

Per explicit user instruction, no new exercise is added unless it is a real,
named entry in [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(`dist/exercises.json`, 873 entries, Unlicense for data / CC BY-SA 4.0 for
Everkinetic images — the same source and licence already used for the 26
existing demos). The 8 exercises already in the library with no dataset match
(`bulgarian-split-squat`, `bird-dog`, `hollow-hold`, `leg-swings`, `high-knees`,
`ankle-hops`, `quad-stretch`, `pike-push-up`) are confirmed to still have no
match after a broad synonym search — **they are not removed**, they simply stay
demo-less, unchanged from today.

## Process

1. Downloaded the dataset directly (`dist/exercises.json`) rather than relying
   on lossy AI summarization of a 22k-line file.
2. Filtered to `equipment` in `{body only, dumbbell, bands, null-but-bar}`,
   category `strength`/`plyometrics`, muscle groups mapping to legs/core/push/pull,
   excluding names already used by the 26 existing demos.
3. Hand-curated a ~23-exercise shortlist for variety and to fill real gaps
   (no lower-back exercise existed in `core`; no isolated biceps/traps exercise
   existed in `pull`; no explosive/plyo push variant existed in `push`).
4. Verified every candidate has a real `images: [".../0.jpg", ".../1.jpg"]` pair
   in the dataset (all 23 do).
5. Mapped each candidate onto the existing `StrengthExercise` schema. Fields the
   dataset doesn't have (`commonMistakes`, `defaultSets/Reps`, `rest/estSeconds`,
   `runInterference`, `progressionOf/regressionOf`) are authored to match the
   voice and tiering convention already present in `library.ts`.

## Difficulty-tiering convention (reverse-engineered from existing data)

Observed in the current library: `X.progressionOf = Y` means X is one
difficulty tier **harder** than Y; `X.regressionOf = Z` means X is one tier
**easier** than Z (e.g. `push-up.progressionOf = incline-push-up` [beginner→
intermediate], `push-up.regressionOf = diamond-push-up` [intermediate→advanced]).
New chains below follow this convention; a few dataset `level` values were
overridden where they conflicted with it or were unrealistic (e.g. dataset
calls Chin-Up and Plyo Push-Up "beginner", which undersells a bodyweight
pull-up variant and an explosive push-up).

## New exercises (23)

Instruction steps and common mistakes are written fresh in the app's terse
3-step / 2-mistake style, informed by the dataset's longer prose instructions,
not copied verbatim (the dataset's prose instructions are its own copyrighted
text style; only the exercise identity, muscles, equipment and image assets are
taken from it).

### Legs (+6)

| id | name | equipment | difficulty | chain | sets/reps | rest/est | interference |
|---|---|---|---|---|---|---|---|
| `freehand-jump-squat` | Freehand Jump Squat | none | intermediate | progressionOf `bw-squat` | 3 × 8–10 | 60s/40s | high |
| `dumbbell-squat` | Dumbbell Squat | dumbbells, gym | beginner | — | 3 × 10–12 | 60s/45s | high |
| `dumbbell-rear-lunge` | Dumbbell Rear Lunge | dumbbells, gym | intermediate | — | 3 × 10/leg | 60s/50s | high |
| `glute-kickback` | Glute Kickback | none | beginner | — | 3 × 12/leg | 40s/40s | medium |
| `stiff-legged-deadlift` | Stiff-Legged Dumbbell Deadlift | dumbbells, gym | beginner | — | 3 × 10–12 | 60s/45s | high |
| `step-up-knee-raise` | Step-Up with Knee Raise | none | beginner | — | 3 × 8/leg | 45s/45s | high |

Source images: `Freehand_Jump_Squat`, `Dumbbell_Squat`, `Dumbbell_Rear_Lunge`,
`Glute_Kickback`, `Stiff-Legged_Dumbbell_Deadlift`, `Step-up_with_Knee_Raise`.

### Core (+6)

| id | name | equipment | difficulty | chain | sets/reps | rest/est | interference |
|---|---|---|---|---|---|---|---|
| `sit-up` | Sit-Up | none | beginner | — | 3 × 15–20 | 30s/35s | low |
| `air-bike` | Air Bike (bicycle crunch) | none | beginner | — | 3 × 15/side | 30s/40s | low |
| `russian-twist` | Russian Twist | none | intermediate | — | 3 × 15/side | 30s/40s | low |
| `reverse-crunch` | Reverse Crunch | none | beginner | — | 3 × 15 | 30s/35s | low |
| `lying-leg-raise` | Flat Bench Lying Leg Raise | none | beginner | — | 3 × 12–15 | 30s/40s | low |
| `hyperextension` | Hyperextension (bench, no equipment) | none | intermediate | — | 3 × 12–15 | 40s/45s | low |

Fills a real gap: no existing `core` exercise targets the lower back.

Source images: `Sit-Up`, `Air_Bike`, `Russian_Twist`, `Reverse_Crunch`,
`Flat_Bench_Lying_Leg_Raise`, `Hyperextensions_With_No_Hyperextension_Bench`.

### Push (+6)

| id | name | equipment | difficulty | chain | sets/reps | rest/est | interference |
|---|---|---|---|---|---|---|---|
| `handstand-push-up` | Handstand Push-Up | none | advanced | progressionOf `pike-push-up` | 3 × 5–8 | 90s/45s | low |
| `bench-dip` | Bench Dip | none | beginner | — | 3 × 12–15 | 45s/40s | low |
| `triceps-dip` | Parallel Bar Dip | none | intermediate | progressionOf `bench-dip` | 3 × 8–10 | 60s/45s | low |
| `push-up-to-side-plank` | Push-Up to Side Plank | none | intermediate | — | 3 × 8/side | 60s/50s | low |
| `plyo-push-up` | Plyo Push-Up | none | advanced | progressionOf `push-up` | 3 × 6–8 | 75s/40s | low |
| `dumbbell-flyes` | Dumbbell Flyes | dumbbells, gym | beginner | — | 3 × 10–12 | 60s/45s | low |

`handstand-push-up` finally gives `pike-push-up` the advanced progression the
existing demo README flagged as missing (Handstand Push-Ups was previously
rejected only as a *demo substitute* for pike-push-up because it's a different,
harder movement — here it's added as its own correctly-attributed exercise).

Source images: `Handstand_Push-Ups`, `Bench_Dips`, `Dips_-_Triceps_Version`,
`Push_Up_to_Side_Plank`, `Plyo_Push-up`, `Dumbbell_Flyes`.

### Pull (+5)

| id | name | equipment | difficulty | chain | sets/reps | rest/est | interference |
|---|---|---|---|---|---|---|---|
| `chin-up` | Chin-Up | pullUpBar, gym | intermediate | regressionOf `pull-up` | 3 × 5–8 | 90s/40s | low |
| `inverted-row` | Inverted Row | gym | intermediate | progressionOf `band-row` | 3 × 10–12 | 60s/45s | low |
| `scapular-pull-up` | Scapular Pull-Up | pullUpBar, gym | beginner | regressionOf `negative-pull-up` | 3 × 10–12 | 45s/35s | low |
| `dumbbell-bicep-curl` | Dumbbell Bicep Curl | dumbbells | beginner | — | 3 × 10–12 | 45s/40s | low |
| `dumbbell-shrug` | Dumbbell Shrug | dumbbells | beginner | — | 3 × 12–15 | 40s/35s | low |

`scapular-pull-up` completes a genuine 3-step chain:
scapular-pull-up → negative-pull-up → pull-up.
Fills a gap: no existing `pull` exercise isolates biceps or traps.

Source images: `Chin-Up`, `Inverted_Row`, `Scapular_Pull-Up`,
`Dumbbell_Bicep_Curl`, `Dumbbell_Shrug`.

## Implementation plan (for writing-plans / execution)

1. Add 23 new `StrengthExercise` entries to `library.ts`, grouped under their
   category comment blocks, following the field order/style of existing entries.
2. Download the 23 image pairs (46 files) from
   `raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<Name>/{0,1}.jpg`,
   apply the same centre-crop-to-square + resize-480px processing documented in
   `public/demos/README.md`, save as `<id>-0.jpg` / `<id>-1.jpg`.
3. Regenerate `manifest.ts`: add the 23 ids to `FRAME_DEMOS` and their source
   exercise names to `DEMO_CREDITS` (license requires the credit to stay, and a
   test asserts every bundled demo is credited).
4. Update `public/demos/README.md`'s "What ships today" count (26 → 49 of 57).
5. Run `npm run typecheck` and `npm test` (the credits test will fail until the
   manifest is updated — that's the check confirming step 3 was done correctly).

## Out of scope

- The 8 exercises with no dataset match are not touched (not removed, no demo
  added).
- No new categories (full-body/cardio/olympic) — user chose "moderate growth,
  same categories."
- No video upgrades — still photo-frame demos, matching what's already shipped.
