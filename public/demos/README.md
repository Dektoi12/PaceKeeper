# Exercise demo media

Demos are addressed by exercise id and resolved in [`src/components/demo/media.ts`](../../src/components/demo/media.ts).
An exercise with no media shows a neutral placeholder, so partial coverage is fine.

Two formats are supported, checked in this order:

| Kind | Files | Notes |
| --- | --- | --- |
| Video | `<id>.mp4` | Preferred. Real motion, and pausable for reduced-motion users. Add the id to `VIDEO_DEMOS` in `media.ts`. |
| Two-frame photos | `<id>-0.jpg`, `<id>-1.jpg` | Start and end position, cross-faded. What the bundled free set uses. Listed in the generated `manifest.ts`. |

## What ships today

26 of the 34 exercises have two-frame photo demos from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) — images by
[Everkinetic](https://github.com/everkinetic/data), used under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They were
centre-cropped to square and resized to 480px; those adaptations remain CC BY-SA 4.0.
The credit is shown in the app under Settings → Credits and **must stay there** —
it is a licence condition, and a test asserts every bundled demo is credited.

These eight show the placeholder. Six have no match in the dataset at all — it is
gym-lift heavy, so it has none of the running drills:

`bulgarian-split-squat` · `bird-dog` · `hollow-hold` · `leg-swings` · `high-knees` · `ankle-hops`

Two were deliberately left blank because the closest dataset entry is a *different
movement*, and a wrong demo teaches the wrong thing:

| Exercise | Closest match | Why rejected |
| --- | --- | --- |
| `quad-stretch` | Quad Stretch | Performed lying down; ours is a standing heel pull. |
| `pike-push-up` | Handstand Push-Ups | A far harder inverted movement, not a pike push-up. |

Where the movement matches but the equipment differs (`band-row` shown on a cable
machine, `calf-raise` and `diamond-push-up` with a dumbbell, `overhead-press`
seated, `negative-pull-up` band-assisted) the demo was kept — the movement pattern
is what the demo is teaching.

Note the source photos come from two different shoots — gym-floor strength lifts
and studio-floor stretches — so the set is consistent within each group but not a
single look across all of it.

## Upgrading to better clips

If you licence a uniform set (e.g. from [gymvisual.com](https://gymvisual.com/)),
drop `<id>.mp4` in here and add the id to `VIDEO_DEMOS`. Video wins over photos, so
you can migrate a few at a time without deleting anything.

| Property | Target |
| --- | --- |
| Container / codec | MP4, H.264, `-pix_fmt yuv420p` |
| Dimensions | 480×480, square |
| Length | 2–4 s, seamless loop |
| Audio | none (strip it) |
| Size | ≤ 250 KB per clip |

```sh
ffmpeg -i input.mov -an -vf "scale=480:480:force_original_aspect_ratio=increase,crop=480:480" \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -movflags +faststart output.mp4
```

## Licensing

Only add media you have the right to redistribute — it ships inside the app.
Most "free" exercise GIF sets are not safe for this: the media in
[exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) is © Gym
visual and requires buying a licence from them directly.

## Regenerating the manifest

`manifest.ts` is generated from the files in this folder. After adding or removing
photo frames, rebuild it so `FRAME_DEMOS` and `DEMO_CREDITS` stay in sync — the
test suite fails if the manifest references a file that isn't here.
